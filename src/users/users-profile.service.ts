import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { UserDocument, DocumentType, DocumentStatus } from './entities/user-document.entity';
import { UserIdentityDocument, IdentityDocumentKind } from './entities/user-identity-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { EmailService } from '../common/services/email.service';
import { SecurityService } from '../security/security.service';
import { DocumentType as DocumentTypeEntity } from '../documents/entities/document-type.entity';
import { VerificationsService } from '../verifications/verifications.service';
import { MinioService } from '../storage/minio.service';
import * as fs from 'fs';
import * as path from 'path';
import { Express } from 'express';

@Injectable()
export class UsersProfileService {
    private readonly logger = new Logger(UsersProfileService.name);
    private readonly uploadsDir = path.join(process.cwd(), 'uploads', 'documents');
    private readonly maxFileSize = 10 * 1024 * 1024; // 10 MB
    private readonly allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(UserDocument)
        private userDocumentRepository: Repository<UserDocument>,
        @InjectRepository(DocumentTypeEntity)
        private documentTypeRepository: Repository<DocumentTypeEntity>,
        @InjectRepository(UserIdentityDocument)
        private userIdentityDocumentRepository: Repository<UserIdentityDocument>,
        private emailService: EmailService,
        private securityService: SecurityService,
        private minioService: MinioService,
        @Inject(forwardRef(() => VerificationsService))
        private verificationsService: VerificationsService,
    ) {
        // Créer le dossier uploads s'il n'existe pas (pour compatibilité avec les anciens fichiers)
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
    }

    /**
     * Récupère les documents requis depuis les paramètres de sécurité
     * Retourne les IDs des DocumentType (entity) requis
     */
    private async getRequiredDocumentTypeIds(): Promise<string[]> {
        const settings = await this.securityService.getSettings();

        // Si les documents requis sont désactivés ou vides, retourner une liste vide
        if (!settings.requireDocumentsForRegistration ||
            !settings.requiredDocumentsForRegistration ||
            settings.requiredDocumentsForRegistration.length === 0) {
            return [];
        }

        return settings.requiredDocumentsForRegistration;
    }

    /**
     * Récupère les documents requis depuis les paramètres de sécurité
     * Retourne les types mappés vers l'enum DocumentType
     */
    private async getRequiredDocuments(): Promise<DocumentType[]> {
        const requiredIds = await this.getRequiredDocumentTypeIds();

        if (requiredIds.length === 0) {
            return [];
        }

        // Récupérer les types de documents depuis la base de données
        const documentTypes = await this.documentTypeRepository.find({
            where: requiredIds.map(id => ({ id })),
        });

        // Mapper vers l'enum DocumentType (UserDocument)
        const mappedTypes: DocumentType[] = [];

        for (const dt of documentTypes) {
            const mappedType = this.mapDocumentTypeToEnum(dt.title);
            if (mappedType) {
                mappedTypes.push(mappedType);
            }
        }

        return mappedTypes;
    }

    /**
     * Mappe un titre de DocumentType (entity) vers l'enum DocumentType
     */
    private mapDocumentTypeToEnum(title: string): DocumentType | null {
        const titleUpper = title.toUpperCase().replace(/\s+/g, '_');

        if (titleUpper.includes('CARTE') && titleUpper.includes('IDENTITE')) {
            return DocumentType.CARTE_IDENTITE;
        }
        // Face recto/verso CNI (vérification d'identité)
        if ((titleUpper.includes('CNI') || titleUpper.includes('IDENTITE')) &&
            (titleUpper.includes('RECTO') || titleUpper.includes('VERSO') || titleUpper.includes('AVANT') || titleUpper.includes('ARRIERE') || titleUpper.includes('FACE'))) {
            return DocumentType.CARTE_IDENTITE;
        }
        if (titleUpper.includes('SELFIE')) {
            return DocumentType.SELFIE;
        } else if (titleUpper.includes('CERTIFICAT') && titleUpper.includes('NATIONALITE')) {
            return DocumentType.CERTIFICAT_NATIONALITE;
        } else if (titleUpper.includes('EXTRAIT') && titleUpper.includes('NAISSANCE')) {
            return DocumentType.EXTRAIT_NAISSANCE;
        }

        // Si aucun mapping trouvé, retourner AUTRE
        return DocumentType.AUTRE;
    }

    /**
     * Récupère tous les types de documents disponibles (créés par l'admin)
     * avec indication si ils sont requis pour l'inscription
     */
    async getAvailableDocumentTypes(): Promise<any[]> {
        // Récupérer tous les types de documents actifs
        const allDocumentTypes = await this.documentTypeRepository.find({
            where: { isActive: true },
            order: { title: 'ASC' },
        });

        // Récupérer les IDs des documents requis
        const requiredIds = await this.getRequiredDocumentTypeIds();

        // Mapper chaque type avec son type enum correspondant
        return allDocumentTypes.map(dt => ({
            id: dt.id,
            title: dt.title,
            hasExpirationDate: dt.hasExpirationDate,
            isForIdentityVerification: dt.isForIdentityVerification,
            mappedType: this.mapDocumentTypeToEnum(dt.title) || DocumentType.AUTRE,
            isRequired: requiredIds.includes(dt.id),
        }));
    }

    /**
     * Calcule le pourcentage de complétion du profil
     * Base : 50% après inscription
     * + 50% répartis progressivement sur les documents requis
     * 
     * Exemple avec 3 documents requis :
     * - 0 document : 50%
     * - 1 document : 50% + 16.67% = 66.67%
     * - 2 documents : 50% + 33.33% = 83.33%
     * - 3 documents : 50% + 50% = 100%
     * 
     * La complétion augmente dès qu'un document est uploadé (même en attente de validation)
     */
    async getProfileCompletion(userId: string): Promise<number> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        // Base : 50% après inscription
        let completion = 50;

        // Récupérer les IDs des documents requis depuis les paramètres de sécurité
        const requiredDocumentIds = await this.getRequiredDocumentTypeIds();

        // Si aucun document requis configuré, la complétion reste à 50%
        // (pas 100% car l'utilisateur doit quand même compléter son profil)
        if (requiredDocumentIds.length === 0) {
            return 50;
        }

        // Vérifier les documents requis (uploadés, peu importe le statut)
        // On vérifie par documentTypeId pour être sûr de compter uniquement les documents créés par l'admin
        const documents = await this.userDocumentRepository.find({
            where: { userId },
        });

        // Compter uniquement les documents qui correspondent aux types requis (par documentTypeId)
        const uploadedDocumentsCount = documents.filter((doc) =>
            doc.documentTypeId && requiredDocumentIds.includes(doc.documentTypeId),
        ).length;

        // Si aucun document n'est uploadé, la complétion reste à 50%
        if (uploadedDocumentsCount === 0) {
            return 50;
        }

        // Calculer le pourcentage ajouté par chaque document
        // Chaque document requis vaut 50% / nombre de documents requis
        // Exemple : 4 documents requis = 50% / 4 = 12.5% par document
        const percentagePerDocument = 50 / requiredDocumentIds.length;
        const documentCompletion = uploadedDocumentsCount * percentagePerDocument;
        completion += documentCompletion;

        // Arrondir et s'assurer qu'on ne dépasse pas 100%
        return Math.min(Math.round(completion * 100) / 100, 100);
    }

    /**
     * Récupère les informations de complétion du profil
     */
    async getProfileCompletionInfo(userId: string) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        const documents = await this.userDocumentRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });

        // Récupérer les documents requis depuis les paramètres de sécurité
        let requiredDocumentIds = await this.getRequiredDocumentTypeIds();

        // Récupérer TOUS les types de documents actifs créés par l'admin
        const allActiveDocumentTypes = await this.documentTypeRepository.find({
            where: { isActive: true },
            order: { title: 'ASC' },
        });

        // Valider que les IDs configurés dans les paramètres de sécurité correspondent à des DocumentType existants et actifs
        if (requiredDocumentIds.length > 0) {
            const validDocumentTypeIds = allActiveDocumentTypes.map(dt => dt.id);
            const invalidIds = requiredDocumentIds.filter(id => !validDocumentTypeIds.includes(id));

            if (invalidIds.length > 0) {
                this.logger.warn(`[Completion] Invalid document type IDs in settings: ${JSON.stringify(invalidIds)}. These will be ignored.`);
                // Filtrer pour ne garder que les IDs valides
                requiredDocumentIds = requiredDocumentIds.filter(id => validDocumentTypeIds.includes(id));
            }
        }

        // Si aucun document requis valide n'est configuré dans les paramètres de sécurité,
        // considérer TOUS les types de documents actifs comme requis
        if (requiredDocumentIds.length === 0 && allActiveDocumentTypes.length > 0) {
            requiredDocumentIds = allActiveDocumentTypes.map(dt => dt.id);
            this.logger.debug(`[Completion] No valid required documents configured, considering all ${allActiveDocumentTypes.length} active document types as required`);
        }

        // Afficher tous les types de documents actifs
        const requiredDocumentTypes = allActiveDocumentTypes;

        // Base : 50% après inscription
        let completion = 50;

        // Debug: Log pour comprendre le problème
        this.logger.debug(`[Completion] UserId: ${userId}`);
        this.logger.debug(`[Completion] Required Document IDs: ${JSON.stringify(requiredDocumentIds)}`);
        this.logger.debug(`[Completion] Required Document Types count: ${requiredDocumentTypes.length}`);
        this.logger.debug(`[Completion] All user documents: ${documents.length}`);
        this.logger.debug(`[Completion] All active document types IDs: ${JSON.stringify(allActiveDocumentTypes.map(dt => ({ id: dt.id, title: dt.title })))}`);
        this.logger.debug(`[Completion] User documents with documentTypeId: ${JSON.stringify(documents.filter(d => d.documentTypeId).map(d => ({ id: d.id, documentTypeId: d.documentTypeId, status: d.status })))}`);

        // Après l'assignation à la ligne 219, requiredDocumentIds contient soit les IDs configurés, soit tous les IDs actifs
        const totalRequiredDocuments = requiredDocumentIds.length;

        if (totalRequiredDocuments > 0) {
            // Compter les documents uploadés qui correspondent aux documents requis
            const documentsWithDetails = documents.map((doc) => ({
                id: doc.id,
                documentTypeId: doc.documentTypeId,
                status: doc.status,
                matches: doc.documentTypeId ? requiredDocumentIds.includes(doc.documentTypeId) : false,
            }));

            this.logger.debug(`[Completion] User documents details: ${JSON.stringify(documentsWithDetails)}`);
            this.logger.debug(`[Completion] Required Document IDs to match: ${JSON.stringify(requiredDocumentIds)}`);

            const uploadedDocumentsCount = documents.filter((doc) => {
                if (!doc.documentTypeId) {
                    this.logger.debug(`[Completion] Document ${doc.id} has no documentTypeId`);
                    return false;
                }
                const matches = requiredDocumentIds.includes(doc.documentTypeId);
                this.logger.debug(`[Completion] Document ${doc.id} with documentTypeId ${doc.documentTypeId} matches: ${matches}`);
                return matches;
            }).length;

            this.logger.debug(`[Completion] Total required documents: ${totalRequiredDocuments}`);
            this.logger.debug(`[Completion] Uploaded documents count matching required: ${uploadedDocumentsCount}`);

            // Si aucun document requis n'est uploadé, la complétion reste à 50%
            if (uploadedDocumentsCount === 0) {
                completion = 50;
                this.logger.debug(`[Completion] No matching documents found, completion stays at 50%`);
            } else {
                // Calculer le pourcentage ajouté par chaque document
                // Chaque document requis vaut 50% / nombre de documents requis
                const percentagePerDocument = 50 / totalRequiredDocuments;
                const documentCompletion = uploadedDocumentsCount * percentagePerDocument;
                completion += documentCompletion;
                completion = Math.min(Math.round(completion * 100) / 100, 100);
                this.logger.debug(`[Completion] Calculated: ${completion}% (${uploadedDocumentsCount}/${totalRequiredDocuments} documents, ${percentagePerDocument.toFixed(2)}% per document)`);
            }
        } else {
            // Si aucun document requis n'est configuré et aucun document actif, la complétion reste à 50%
            this.logger.debug(`[Completion] No required documents configured. Required IDs: ${requiredDocumentIds.length}, Active types: ${allActiveDocumentTypes.length}`);
        }

        // Calculer le pourcentage ajouté par chaque document requis (une seule fois, avant le map)
        // Utiliser requiredDocumentIds.length (qui contient soit les IDs configurés, soit tous les IDs actifs après l'assignation)
        const percentagePerDocument = requiredDocumentIds.length > 0 ? 50 / requiredDocumentIds.length : 0;

        // Créer la liste des documents avec leur statut
        // Afficher tous les types de documents actifs, avec indication si requis
        const requiredDocumentsInfo = requiredDocumentTypes.map((docType) => {
            const mappedType = this.mapDocumentTypeToEnum(docType.title) || DocumentType.AUTRE;
            // Trouver le document par documentTypeId (plus précis que par type enum)
            const userDocument = documents.find((doc) => doc.documentTypeId === docType.id);
            const isUploaded = !!userDocument;
            const isValidated = userDocument?.status === DocumentStatus.VALIDE;
            const isRequired = requiredDocumentIds.includes(docType.id); // Indiquer si ce document est requis

            return {
                id: docType.id,
                type: mappedType,
                title: docType.title,
                label: this.getDocumentLabel(mappedType),
                isUploaded,
                isValidated,
                status: userDocument?.status || null,
                documentId: userDocument?.id || null,
                uploadedAt: userDocument?.createdAt || null,
                hasExpirationDate: docType.hasExpirationDate,
                isForIdentityVerification: docType.isForIdentityVerification,
                isRequired, // Indiquer si ce document est requis pour la complétion
                // Pourcentage ajouté par ce document (seulement si requis et uploadé)
                completionAdded: (isRequired && isUploaded) ? Math.round(percentagePerDocument * 100) / 100 : 0,
            };
        });

        // Construire la liste des documents uploadés avec URL d'aperçu (présignée)
        const uploadedDocuments: Array<{
            id: string;
            type: string;
            label: string;
            fileName: string;
            status: string;
            issueDate: Date | null;
            expirationDate: Date | null;
            createdAt: Date;
            previewUrl?: string | null;
            mimeType?: string | null;
        }> = [];
        for (const doc of documents) {
            let previewUrl: string | null = null;
            if (doc.filePath) {
                let minioPath: string | null = null;
                if (doc.filePath.startsWith('documents/')) {
                    minioPath = doc.filePath;
                } else if (doc.filePath.includes('/documents/')) {
                    const urlMatch = doc.filePath.match(/\/documents\/[^?]+/);
                    if (urlMatch) minioPath = urlMatch[0].substring(1);
                }
                if (minioPath) {
                    try {
                        previewUrl = await this.minioService.getPresignedUrl(minioPath);
                    } catch (err) {
                        this.logger.warn(`[Completion] Presigned URL for ${minioPath}:`, err);
                    }
                }
            }
            uploadedDocuments.push({
                id: doc.id,
                type: doc.type,
                label: this.getDocumentLabel(doc.type),
                fileName: doc.fileName,
                status: doc.status,
                issueDate: doc.issueDate,
                expirationDate: doc.expirationDate,
                createdAt: doc.createdAt,
                previewUrl: previewUrl || undefined,
                mimeType: doc.mimeType || undefined,
            });
        }

        return {
            completion,
            requiredDocuments: requiredDocumentsInfo,
            uploadedDocuments,
        };
    }

    /**
     * Upload un document pour un utilisateur
     * Le client ne peut uploader que les types de documents créés par l'admin
     */
    async uploadDocument(
        userId: string,
        file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
        uploadDto: UploadDocumentDto,
    ): Promise<UserDocument> {
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('Utilisateur non trouvé');
        }

        // Vérifier que le type de document existe et est actif (créé par l'admin)
        const documentType = await this.documentTypeRepository.findOne({
            where: { id: uploadDto.documentTypeId },
        });

        if (!documentType) {
            throw new NotFoundException('Type de document non trouvé. Veuillez utiliser un type de document créé par l\'administrateur.');
        }

        if (!documentType.isActive) {
            throw new BadRequestException('Ce type de document n\'est plus actif. Veuillez contacter l\'administrateur.');
        }

        // Mapper le type de document vers l'enum
        const mappedType = this.mapDocumentTypeToEnum(documentType.title) || DocumentType.AUTRE;

        // Vérifier le type de fichier
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException(
                'Type de fichier non autorisé. Formats acceptés : PDF, JPG, PNG',
            );
        }

        // Vérifier la taille du fichier
        if (file.size > this.maxFileSize) {
            throw new BadRequestException('Fichier trop volumineux. Taille maximale : 10 MB');
        }

        // Vérifier si un document de ce type existe déjà (même documentTypeId)
        const existingDocument = await this.userDocumentRepository.findOne({
            where: { userId, documentTypeId: uploadDto.documentTypeId },
        });

        // Générer un nom de fichier unique pour MinIO
        const fileExtension = path.extname(file.originalname);
        const fileName = `${userId}-${documentType.id}-${Date.now()}${fileExtension}`;
        const minioFileName = `documents/${fileName}`;

        // Uploader le fichier vers MinIO
        await this.minioService.uploadFile(minioFileName, file.buffer, file.mimetype);

        // Générer une URL présignée pour le fichier (valide 7 jours)
        const presignedUrl = await this.minioService.getPresignedUrl(minioFileName);

        // Convertir les dates si fournies
        let issueDate: Date | undefined;
        let expirationDate: Date | undefined;

        if (uploadDto.issueDate) {
            const [day, month, year] = uploadDto.issueDate.split('/');
            issueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        if (uploadDto.expirationDate) {
            const [day, month, year] = uploadDto.expirationDate.split('/');
            expirationDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        if (existingDocument) {
            // Supprimer l'ancien fichier depuis MinIO ou du stockage local (pour compatibilité)
            if (existingDocument.filePath) {
                // Extraire le chemin MinIO depuis l'URL présignée ou utiliser directement si c'est un chemin
                let oldMinioPath: string | null = null;

                if (existingDocument.filePath.startsWith('documents/')) {
                    // C'est déjà un chemin MinIO (ancien format)
                    oldMinioPath = existingDocument.filePath;
                } else if (existingDocument.filePath.includes('/documents/')) {
                    // C'est une URL présignée, extraire le chemin
                    const urlMatch = existingDocument.filePath.match(/\/documents\/[^?]+/);
                    if (urlMatch) {
                        oldMinioPath = urlMatch[0].substring(1); // Enlever le premier /
                    }
                }

                if (oldMinioPath) {
                    try {
                        await this.minioService.deleteFile(oldMinioPath);
                    } catch (error) {
                        this.logger.warn(`Erreur lors de la suppression de l'ancien fichier MinIO ${oldMinioPath}:`, error);
                    }
                } else {
                    // Ancien fichier local - supprimer depuis le disque
                    const oldFilePath = path.join(this.uploadsDir, existingDocument.fileName);
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
            }

            // Mettre à jour le document existant
            existingDocument.fileName = fileName;
            existingDocument.filePath = presignedUrl; // Stocker l'URL présignée
            existingDocument.fileSize = `${(file.size / 1024).toFixed(2)} KB`;
            existingDocument.mimeType = file.mimetype;
            existingDocument.issueDate = issueDate;
            existingDocument.expirationDate = expirationDate;
            existingDocument.status = DocumentStatus.EN_VERIFICATION; // Passer en vérification
            existingDocument.isVerified = false;

            const savedDocument = await this.userDocumentRepository.save(existingDocument);

            // Créer ou mettre à jour la vérification pour ce document
            try {
                const user = await this.userRepository.findOne({ where: { id: userId } });
                if (user) {
                    const sector = user.organisationId ? 'BANQUE' : 'BANQUE'; // TODO: Récupérer le secteur réel

                    // Vérifier si une vérification existe déjà pour ce document
                    const existingVerification = await this.verificationsService.findByDocumentId(savedDocument.id);
                    if (!existingVerification) {
                        await this.verificationsService.createFromDocument({
                            documentId: savedDocument.id,
                            clientId: userId,
                            clientName: user.name || user.firstName + ' ' + user.lastName,
                            documentType: existingDocument.type,
                            sector: sector as any,
                        });
                    }
                }
            } catch (error) {
                this.logger.error(`Erreur lors de la création/mise à jour de la vérification pour le document ${savedDocument.id}:`, error);
            }

            return savedDocument;
        }

        // Créer un nouveau document
        const newDocument = this.userDocumentRepository.create({
            userId,
            type: mappedType,
            documentTypeId: uploadDto.documentTypeId, // Stocker l'ID du DocumentType créé par l'admin
            fileName,
            filePath: presignedUrl, // Stocker l'URL présignée
            fileSize: `${(file.size / 1024).toFixed(2)} KB`,
            mimeType: file.mimetype,
            issueDate,
            expirationDate,
            status: DocumentStatus.EN_VERIFICATION, // Passer directement en vérification
            isVerified: false,
        });

        const savedDocument = await this.userDocumentRepository.save(newDocument);

        // Créer automatiquement une vérification pour ce document
        try {
            const user = await this.userRepository.findOne({ where: { id: userId } });
            if (user) {
                // Récupérer le secteur depuis l'organisation ou utiliser une valeur par défaut
                const sector = user.organisationId ? 'BANQUE' : 'BANQUE'; // TODO: Récupérer le secteur réel

                await this.verificationsService.createFromDocument({
                    documentId: savedDocument.id,
                    clientId: userId,
                    clientName: user.name || user.firstName + ' ' + user.lastName,
                    documentType: mappedType,
                    sector: sector as any,
                });
            }
        } catch (error) {
            this.logger.error(`Erreur lors de la création de la vérification pour le document ${savedDocument.id}:`, error);
            // Ne pas bloquer l'upload si la création de la vérification échoue
        }

        return savedDocument;
    }

    /**
     * Récupère tous les documents d'un utilisateur
     */
    async getUserDocuments(userId: string): Promise<UserDocument[]> {
        return await this.userDocumentRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Récupère les documents du profil avec une URL d'aperçu fraîche (présignée).
     * Utilisé par le front pour afficher les miniatures (images et 1re page PDF).
     */
    async getUserDocumentsWithPreviews(userId: string): Promise<Array<Record<string, unknown> & { id: string; documentTypeId?: string; fileName: string; mimeType: string; previewUrl?: string | null }>> {
        const documents = await this.getUserDocuments(userId);
        const result: Array<Record<string, unknown> & { id: string; documentTypeId?: string; fileName: string; mimeType: string; previewUrl?: string | null }> = [];
        for (const doc of documents) {
            let previewUrl: string | null = null;
            if (doc.filePath) {
                let minioPath: string | null = null;
                if (doc.filePath.startsWith('documents/')) {
                    minioPath = doc.filePath;
                } else if (doc.filePath.includes('/documents/')) {
                    const urlMatch = doc.filePath.match(/\/documents\/[^?]+/);
                    if (urlMatch) minioPath = urlMatch[0].substring(1);
                }
                if (minioPath) {
                    try {
                        previewUrl = await this.minioService.getPresignedUrl(minioPath);
                    } catch (err) {
                        this.logger.warn(`[Profile documents] Presigned URL for ${minioPath}:`, err);
                    }
                }
            }
            result.push({
                id: doc.id,
                userId: doc.userId,
                type: doc.type,
                documentTypeId: doc.documentTypeId ?? undefined,
                fileName: doc.fileName,
                filePath: doc.filePath,
                fileSize: doc.fileSize,
                mimeType: doc.mimeType,
                issueDate: doc.issueDate,
                expirationDate: doc.expirationDate,
                status: doc.status,
                rejectionReason: doc.rejectionReason,
                isVerified: doc.isVerified,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                previewUrl: previewUrl ?? undefined,
            });
        }
        return result;
    }

    /**
     * Récupère tous les documents (pour admin) avec filtres optionnels
     */
    async findAllDocuments(
        userId?: string,
        type?: DocumentType,
        status?: DocumentStatus,
        isVerified?: boolean,
    ): Promise<UserDocument[]> {
        const queryBuilder = this.userDocumentRepository.createQueryBuilder('document')
            .leftJoinAndSelect('document.user', 'user')
            .orderBy('document.createdAt', 'DESC');

        if (userId) {
            queryBuilder.where('document.userId = :userId', { userId });
        }

        if (type) {
            queryBuilder.andWhere('document.type = :type', { type });
        }

        if (status) {
            queryBuilder.andWhere('document.status = :status', { status });
        }

        if (isVerified !== undefined) {
            queryBuilder.andWhere('document.isVerified = :isVerified', { isVerified });
        }

        return await queryBuilder.getMany();
    }

    /**
     * Met à jour un document (dates uniquement)
     */
    async updateDocument(
        userId: string,
        documentId: string,
        updateDto: { issueDate?: string; expirationDate?: string },
    ): Promise<UserDocument> {
        const document = await this.userDocumentRepository.findOne({
            where: { id: documentId, userId },
        });

        if (!document) {
            throw new NotFoundException('Document non trouvé');
        }

        // Convertir les dates si fournies
        if (updateDto.issueDate) {
            const [day, month, year] = updateDto.issueDate.split('/');
            document.issueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        if (updateDto.expirationDate) {
            const [day, month, year] = updateDto.expirationDate.split('/');
            document.expirationDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }

        // Si le document est validé et qu'on modifie les dates, remettre en attente
        if (document.status === DocumentStatus.VALIDE && (updateDto.issueDate || updateDto.expirationDate)) {
            document.status = DocumentStatus.EN_ATTENTE;
            document.isVerified = false;
        }

        return await this.userDocumentRepository.save(document);
    }

    /**
     * Supprime un document
     */
    async deleteDocument(userId: string, documentId: string): Promise<void> {
        const document = await this.userDocumentRepository.findOne({
            where: { id: documentId, userId },
        });

        if (!document) {
            throw new NotFoundException('Document non trouvé');
        }

        // Supprimer le fichier depuis MinIO ou du stockage local (pour compatibilité)
        if (document.filePath) {
            // Extraire le chemin MinIO depuis l'URL présignée ou utiliser directement si c'est un chemin
            let minioPath: string | null = null;

            if (document.filePath.startsWith('documents/')) {
                // C'est déjà un chemin MinIO (ancien format)
                minioPath = document.filePath;
            } else if (document.filePath.includes('/documents/')) {
                // C'est une URL présignée, extraire le chemin
                const urlMatch = document.filePath.match(/\/documents\/[^?]+/);
                if (urlMatch) {
                    minioPath = urlMatch[0].substring(1); // Enlever le premier /
                }
            }

            if (minioPath) {
                try {
                    await this.minioService.deleteFile(minioPath);
                } catch (error) {
                    this.logger.warn(`Erreur lors de la suppression du fichier MinIO ${minioPath}:`, error);
                    // Continuer même si la suppression échoue
                }
            } else {
                // Ancien fichier local - supprimer depuis le disque
                const filePath = path.join(this.uploadsDir, document.fileName);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        await this.userDocumentRepository.remove(document);
    }

    /**
     * Récupère le fichier d'un document (pour aperçu/miniature via proxy, évite CORS).
     */
    async getDocumentFile(userId: string, documentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const document = await this.userDocumentRepository.findOne({
            where: { id: documentId, userId },
        });
        if (!document) {
            throw new NotFoundException('Document non trouvé');
        }
        return this.getDocumentFileBuffer(document);
    }

    /**
     * Récupère le fichier d'un document par ID (pour l'admin, sans vérification userId).
     * Utilisé par la page de vérification des documents (admin).
     */
    async getDocumentFileForAdmin(documentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const document = await this.userDocumentRepository.findOne({
            where: { id: documentId },
        });
        if (!document) {
            throw new NotFoundException('Document non trouvé');
        }
        return this.getDocumentFileBuffer(document);
    }

    private async getDocumentFileBuffer(document: UserDocument): Promise<{ buffer: Buffer; mimeType: string }> {
        let minioPath: string | null = null;
        if (document.filePath.startsWith('documents/')) {
            minioPath = document.filePath;
        } else if (document.filePath.includes('/documents/')) {
            const urlMatch = document.filePath.match(/\/documents\/[^?]+/);
            if (urlMatch) minioPath = urlMatch[0].substring(1);
        }
        if (!minioPath) {
            throw new NotFoundException('Fichier non disponible');
        }
        const buffer = await this.minioService.getFile(minioPath);
        return { buffer, mimeType: document.mimeType || 'application/octet-stream' };
    }

    // ─── Documents d'identité (recto, verso, selfie) – hors document_types ───

    async uploadIdentityDocument(
        userId: string,
        file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
        kind: IdentityDocumentKind,
    ): Promise<UserIdentityDocument> {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException('Utilisateur non trouvé');
        if (!this.allowedMimeTypes.includes(file.mimetype)) {
            throw new BadRequestException('Type de fichier non autorisé. Formats acceptés : PDF, JPG, PNG');
        }
        if (file.size > this.maxFileSize) {
            throw new BadRequestException('Fichier trop volumineux. Taille maximale : 10 MB');
        }
        const existing = await this.userIdentityDocumentRepository.findOne({
            where: { userId, kind },
        });
        const fileExtension = path.extname(file.originalname);
        const fileName = `identity-${userId}-${kind}-${Date.now()}${fileExtension}`;
        const minioFileName = `identity-documents/${fileName}`;
        await this.minioService.uploadFile(minioFileName, file.buffer, file.mimetype);
        if (existing) {
            if (existing.filePath.startsWith('identity-documents/')) {
                try {
                    await this.minioService.deleteFile(existing.filePath);
                } catch (e) {
                    this.logger.warn(`Delete old identity doc ${existing.filePath}:`, e);
                }
            }
            existing.fileName = fileName;
            existing.filePath = minioFileName;
            existing.fileSize = `${(file.size / 1024).toFixed(2)} KB`;
            existing.mimeType = file.mimetype;
            return await this.userIdentityDocumentRepository.save(existing);
        }
        const doc = this.userIdentityDocumentRepository.create({
            userId,
            kind,
            fileName,
            filePath: minioFileName,
            fileSize: `${(file.size / 1024).toFixed(2)} KB`,
            mimeType: file.mimetype,
        });
        return await this.userIdentityDocumentRepository.save(doc);
    }

    async getIdentityDocuments(userId: string): Promise<UserIdentityDocument[]> {
        return await this.userIdentityDocumentRepository.find({
            where: { userId },
            order: { kind: 'ASC' },
        });
    }

    async getIdentityDocumentFile(userId: string, documentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const doc = await this.userIdentityDocumentRepository.findOne({
            where: { id: documentId, userId },
        });
        if (!doc) throw new NotFoundException('Document non trouvé');
        return this.getIdentityDocumentFileBuffer(doc);
    }

    async getIdentityDocumentFileForAdmin(documentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
        const doc = await this.userIdentityDocumentRepository.findOne({
            where: { id: documentId },
        });
        if (!doc) throw new NotFoundException('Document non trouvé');
        return this.getIdentityDocumentFileBuffer(doc);
    }

    private async getIdentityDocumentFileBuffer(doc: UserIdentityDocument): Promise<{ buffer: Buffer; mimeType: string }> {
        let minioPath: string | null = null;
        if (doc.filePath.startsWith('identity-documents/')) {
            minioPath = doc.filePath;
        } else if (doc.filePath.includes('/identity-documents/')) {
            const m = doc.filePath.match(/\/identity-documents\/[^?]+/);
            if (m) minioPath = m[0].substring(1);
        }
        if (!minioPath) throw new NotFoundException('Fichier non disponible');
        const buffer = await this.minioService.getFile(minioPath);
        return { buffer, mimeType: doc.mimeType || 'application/octet-stream' };
    }

    /**
     * Récupère les documents expirant bientôt (dans les 60 prochains jours)
     */
    async getExpiringDocuments(userId: string, daysThreshold: number = 60): Promise<any[]> {
        const documents = await this.userDocumentRepository.find({
            where: { userId },
            order: { expirationDate: 'ASC' },
        });

        const now = new Date();
        const thresholdDate = new Date();
        thresholdDate.setDate(now.getDate() + daysThreshold);

        return documents
            .filter((doc) => {
                if (!doc.expirationDate) return false;
                const expirationDate = new Date(doc.expirationDate);
                return expirationDate >= now && expirationDate <= thresholdDate;
            })
            .map((doc) => {
                const expirationDate = new Date(doc.expirationDate);
                const daysUntilExpiration = Math.ceil(
                    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );

                return {
                    id: doc.id,
                    type: this.getDocumentLabel(doc.type),
                    expirationDate: doc.expirationDate,
                    status: doc.status,
                    daysUntilExpiration,
                };
            });
    }

    /**
     * Récupère le label d'un type de document
     */
    private getDocumentLabel(type: DocumentType): string {
        const labels = {
            [DocumentType.CARTE_IDENTITE]: 'Carte d\'identité',
            [DocumentType.SELFIE]: 'Selfie',
            [DocumentType.CERTIFICAT_NATIONALITE]: 'Certificat de nationalité',
            [DocumentType.EXTRAIT_NAISSANCE]: 'Extrait de naissance',
        };
        return labels[type] || type;
    }

    /**
     * Envoie des emails de rappel pour les documents expirant bientôt
     * Peut être appelé périodiquement (cron job) pour notifier les utilisateurs
     */
    async sendExpiringDocumentsReminders(daysThreshold: number = 15): Promise<void> {
        const allDocuments = await this.userDocumentRepository
            .createQueryBuilder('document')
            .leftJoinAndSelect('document.user', 'user')
            .where('document.status = :status', { status: DocumentStatus.VALIDE })
            .andWhere('document.expirationDate IS NOT NULL')
            .getMany();

        const now = new Date();
        const thresholdDate = new Date();
        thresholdDate.setDate(now.getDate() + daysThreshold);

        const expiringDocuments = allDocuments.filter((doc) => {
            if (!doc.expirationDate) return false;
            const expirationDate = new Date(doc.expirationDate);
            return expirationDate >= now && expirationDate <= thresholdDate;
        });

        for (const doc of expiringDocuments) {
            if (!doc.user) {
                // Récupérer l'utilisateur si la relation n'est pas chargée
                const user = await this.userRepository.findOne({ where: { id: doc.userId } });
                if (!user) continue;

                const expirationDate = new Date(doc.expirationDate);
                const daysUntilExpiration = Math.ceil(
                    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );

                if (daysUntilExpiration <= daysThreshold) {
                    try {
                        await this.emailService.sendDocumentExpiringEmail(
                            user.email,
                            user.name,
                            this.getDocumentLabel(doc.type),
                            daysUntilExpiration,
                        );
                    } catch (error) {
                        console.error(`Erreur lors de l'envoi de l'email de rappel pour le document ${doc.id}:`, error);
                    }
                }
            } else {
                const expirationDate = new Date(doc.expirationDate);
                const daysUntilExpiration = Math.ceil(
                    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                );

                if (daysUntilExpiration <= daysThreshold) {
                    try {
                        await this.emailService.sendDocumentExpiringEmail(
                            doc.user.email,
                            doc.user.name,
                            this.getDocumentLabel(doc.type),
                            daysUntilExpiration,
                        );
                    } catch (error) {
                        console.error(`Erreur lors de l'envoi de l'email de rappel pour le document ${doc.id}:`, error);
                    }
                }
            }
        }
    }
}


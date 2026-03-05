import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CreateFormDto } from './dto/create-form.dto';
import { Form, FormStatus } from './entities/form.entity';
import { FormType as FormTypeEnum } from './dto/create-form.dto';
import { Organisation } from '../organisations/entities/organisation.entity';
import { DocumentType } from '../documents/entities/document-type.entity';
import { Sector as SectorEnum } from '../organisations/dto/create-organisation.dto';
import { Sector as SectorEntity } from '../settings/entities/sector.entity';
import { FormType as FormTypeEntity } from '../settings/entities/form-type.entity';
import { SettingsService } from '../settings/settings.service';
import { MinioService } from '../storage/minio.service';
import * as path from 'path';
import { PDFDocument, rgb } from 'pdf-lib';

@Injectable()
export class FormsService {
    constructor(
        @InjectRepository(Form)
        private formRepository: Repository<Form>,
        @InjectRepository(Organisation)
        private organisationRepository: Repository<Organisation>,
        @InjectRepository(DocumentType)
        private documentTypeRepository: Repository<DocumentType>,
        @InjectRepository(SectorEntity)
        private sectorRepository: Repository<SectorEntity>,
        @InjectRepository(FormTypeEntity)
        private formTypeRepository: Repository<FormTypeEntity>,
        private settingsService: SettingsService,
        private minioService: MinioService,
    ) { }

    /**
     * Obtient toutes les options nécessaires pour créer un formulaire
     */
    async getCreateOptions() {
        // Récupérer les secteurs depuis la base de données
        const sectorsFromDb = await this.settingsService.findAllSectors();
        const sectors = sectorsFromDb.map(sector => ({
            id: sector.id,
            value: sector.name.toUpperCase().replace(/\s+/g, '_'), // Convertir en format enum
            label: sector.name,
            description: sector.description,
        }));

        // Récupérer les types de formulaires depuis la base de données
        const formTypesFromDb = await this.settingsService.findAllFormTypes();
        const formTypes = formTypesFromDb.map(formType => ({
            id: formType.id,
            value: formType.name.toUpperCase().replace(/\s+/g, '_'), // Convertir en format enum
            label: formType.name,
            description: formType.description,
        }));

        // Récupérer les rôles principaux depuis la base de données
        // Note: Les rôles d'organisation (ADMINISTRATION, SUPERVISEUR, AGENT) sont gérés par l'enum OrganisationRole
        const rolesFromDb = await this.settingsService.findAllRoles();
        // Mapper les noms de rôles vers des labels plus lisibles
        const roleLabels: { [key: string]: string } = {
            'ADMIN': 'Administrateur',
            'CLIENT': 'Client',
            'ORGANISATION': 'Organisation',
        };
        const roles = rolesFromDb.map(role => ({
            id: role.id,
            value: role.name,
            label: roleLabels[role.name] || role.name,
            description: role.description,
        }));

        // Rôles d'organisation (sous-rôles pour les utilisateurs ORGANISATION)
        const organisationRoles = [
            { value: 'ADMINISTRATION', label: 'Administration', description: 'Gère l\'organisation : création d\'utilisateurs, validation finale, supervision de l\'équipe.' },
            { value: 'SUPERVISEUR', label: 'Superviseur', description: 'Supervise les agents, valide les actions importantes et consulte les rapports.' },
            { value: 'AGENT', label: 'Agent', description: 'Consulte et traite les demandes des clients.' },
        ];

        // Récupérer les types de documents depuis la base de données
        const documentTypesFromDb = await this.documentTypeRepository.find({
            where: { isActive: true },
            order: { title: 'ASC' },
        });
        const documentTypes = documentTypesFromDb.map(docType => ({
            id: docType.id,
            title: docType.title,
            hasExpirationDate: docType.hasExpirationDate,
            isForIdentityVerification: docType.isForIdentityVerification,
        }));

        // Organisations actives
        const activeOrganisations = await this.organisationRepository.find({
            where: { isActive: true },
            select: ['id', 'name', 'sector'],
            order: { name: 'ASC' },
        });

        const organisationsList = activeOrganisations.map(org => ({
            id: org.id,
            name: org.name,
            sector: org.sector,
        }));

        return {
            sectors,
            formTypes,
            documentTypes, // Types de documents disponibles depuis la base de données
            roles,
            organisationRoles, // Rôles spécifiques aux utilisateurs d'organisation
            organisations: organisationsList,
        };
    }

    async create(createFormDto: CreateFormDto, pdfFile?: { buffer: Buffer; originalname: string; mimetype: string; size: number }): Promise<any> {
        // Vérifier que l'organisation existe et est active
        const organisation = await this.organisationRepository.findOne({
            where: { id: createFormDto.organisationId },
        });

        if (!organisation) {
            throw new NotFoundException('Organisation non trouvée');
        }

        if (!organisation.isActive) {
            throw new BadRequestException('L\'organisation sélectionnée n\'est pas active');
        }

        // Vérifier que le secteur existe dans la base de données
        const sector = await this.sectorRepository.findOne({
            where: { id: createFormDto.sectorId, isActive: true },
        });

        if (!sector) {
            throw new NotFoundException('Secteur non trouvé ou inactif');
        }

        // Mapper le nom du secteur vers l'enum Sector pour la compatibilité avec l'entité
        const sectorEnumMap: { [key: string]: SectorEnum } = {
            'Banque': SectorEnum.BANQUE,
            'Notaire': SectorEnum.NOTAIRE,
            'Assurance': SectorEnum.ASSURANCE,
            'Huissiers': SectorEnum.HUISSIER,
        };

        const sectorEnum = sectorEnumMap[sector.name] || sector.name.toUpperCase().replace(/\s+/g, '_') as SectorEnum;

        // Vérifier que le secteur correspond à celui de l'organisation
        if (organisation.sector !== sectorEnum) {
            throw new BadRequestException(`Le secteur sélectionné (${sector.name}) ne correspond pas au secteur de l'organisation (${organisation.sector})`);
        }

        // Vérifier que le type de formulaire existe dans la base de données
        const formType = await this.formTypeRepository.findOne({
            where: { id: createFormDto.formTypeId, isActive: true },
        });

        if (!formType) {
            throw new NotFoundException('Type de formulaire non trouvé ou inactif');
        }

        // Mapper le nom du type de formulaire vers l'enum FormType pour la compatibilité avec l'entité
        const formTypeEnumMap: { [key: string]: FormTypeEnum } = {
            'Transaction': FormTypeEnum.TRANSACTION,
            'Demande': FormTypeEnum.DEMANDE,
            'Déclaration': FormTypeEnum.DECLARATION,
            'Résiliation': FormTypeEnum.RESILIATION,
        };

        const formTypeEnum = formTypeEnumMap[formType.name] || formType.name.toUpperCase().replace(/\s+/g, '_') as FormTypeEnum;

        // Vérifier que les documents requis existent et sont actifs dans la base de données
        if (createFormDto.requiredDocuments && createFormDto.requiredDocuments.length > 0) {
            const documentTypes = await this.documentTypeRepository.find({
                where: {
                    id: In(createFormDto.requiredDocuments),
                    isActive: true, // Vérifier que les documents sont actifs
                },
            });

            if (documentTypes.length !== createFormDto.requiredDocuments.length) {
                const foundIds = documentTypes.map(dt => dt.id);
                const missingIds = createFormDto.requiredDocuments.filter(id => !foundIds.includes(id));
                throw new BadRequestException(
                    `Certains types de documents requis n'existent pas ou sont inactifs dans la base de données. IDs manquants ou inactifs: ${missingIds.join(', ')}`
                );
            }
        }

        // Créer le formulaire avec les enums mappés
        const newForm = this.formRepository.create({
            name: createFormDto.name,
            version: createFormDto.version,
            description: createFormDto.description,
            sector: sectorEnum,
            formType: formTypeEnum,
            organisationId: createFormDto.organisationId,
            requiredDocuments: createFormDto.requiredDocuments || [],
            editableFields: [],
            status: FormStatus.DRAFT, // Par défaut DRAFT, l'organisation le mettra ONLINE/OFFLINE
            isActive: false, // Par défaut inactif, l'admin l'activera
        });

        const savedForm = await this.formRepository.save(newForm);

        // Si un PDF est fourni, le traiter et extraire les champs
        let extractedFields: any[] = [];
        if (pdfFile) {
            // Vérifier le type de fichier
            if (pdfFile.mimetype !== 'application/pdf') {
                throw new BadRequestException('Le fichier doit être un PDF');
            }

            // Vérifier la taille (max 10 MB)
            const maxSize = 10 * 1024 * 1024; // 10 MB
            if (pdfFile.size > maxSize) {
                throw new BadRequestException('Le fichier PDF est trop volumineux (max 10 MB)');
            }

            // Générer un nom de fichier unique
            const fileExtension = path.extname(pdfFile.originalname);
            const minioFileName = `forms/form-${savedForm.id}-${Date.now()}${fileExtension}`;

            // Uploader le fichier vers MinIO
            await this.minioService.uploadFile(minioFileName, pdfFile.buffer, 'application/pdf');

            // Extraire les champs du PDF
            extractedFields = await this.extractPdfFields(pdfFile.buffer);

            // Générer une URL présignée pour le fichier (valide 7 jours)
            const presignedUrl = await this.minioService.getPresignedUrl(minioFileName);

            // Mettre à jour le formulaire avec le PDF et les champs extraits
            savedForm.pdfFilePath = minioFileName; // Stocker le nom du fichier MinIO
            savedForm.pdfFileName = pdfFile.originalname;
            savedForm.pdfTemplate = presignedUrl; // Stocker l'URL présignée
            savedForm.editableFields = extractedFields;

            await this.formRepository.save(savedForm);
        }

        // Charger les relations pour la réponse
        const formWithRelations = await this.formRepository.findOne({
            where: { id: savedForm.id },
            relations: ['organisation'],
        });

        // Récupérer les détails des documents requis
        let requiredDocumentsDetails = [];
        if (savedForm.requiredDocuments && savedForm.requiredDocuments.length > 0) {
            requiredDocumentsDetails = await this.documentTypeRepository.find({
                where: { id: In(savedForm.requiredDocuments) },
            });
        }

        // Retourner une réponse enrichie
        return {
            id: formWithRelations.id,
            name: formWithRelations.name,
            version: formWithRelations.version,
            description: formWithRelations.description,
            sector: formWithRelations.sector,
            formType: formWithRelations.formType,
            organisationId: formWithRelations.organisationId,
            organisation: formWithRelations.organisation ? {
                id: formWithRelations.organisation.id,
                name: formWithRelations.organisation.name,
                sector: formWithRelations.organisation.sector,
                adminEmail: formWithRelations.organisation.adminEmail,
                isActive: formWithRelations.organisation.isActive,
            } : null,
            status: formWithRelations.status,
            requiredDocuments: savedForm.requiredDocuments,
            requiredDocumentsDetails: requiredDocumentsDetails.map(doc => ({
                id: doc.id,
                title: doc.title,
                isForIdentityVerification: doc.isForIdentityVerification,
                hasExpirationDate: doc.hasExpirationDate,
            })),
            editableFields: formWithRelations.editableFields || [],
            extractedFields: extractedFields, // Champs extraits du PDF si fourni
            pdfFilePath: formWithRelations.pdfFilePath,
            pdfFileName: formWithRelations.pdfFileName,
            pdfTemplate: formWithRelations.pdfTemplate, // URL présignée pour accéder au PDF
            createdAt: formWithRelations.createdAt,
            updatedAt: formWithRelations.updatedAt,
        };
    }

    async uploadPdfTemplate(
        formId: string,
        file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    ): Promise<{ form: Form; extractedFields: any[] }> {
        const form = await this.formRepository.findOne({
            where: { id: formId },
        });

        if (!form) {
            throw new NotFoundException('Formulaire non trouvé');
        }

        // Vérifier le type de fichier
        if (file.mimetype !== 'application/pdf') {
            throw new BadRequestException('Le fichier doit être un PDF');
        }

        // Vérifier la taille (max 10 MB)
        const maxSize = 10 * 1024 * 1024; // 10 MB
        if (file.size > maxSize) {
            throw new BadRequestException('Le fichier PDF est trop volumineux (max 10 MB)');
        }

        // Générer un nom de fichier unique
        const fileExtension = path.extname(file.originalname);
        const minioFileName = `forms/form-${formId}-${Date.now()}${fileExtension}`;

        // Uploader le fichier vers MinIO
        await this.minioService.uploadFile(minioFileName, file.buffer, 'application/pdf');

        // Extraire les champs du PDF
        const extractedFields = await this.extractPdfFields(file.buffer);

        // Générer une URL présignée pour le fichier (valide 7 jours)
        const presignedUrl = await this.minioService.getPresignedUrl(minioFileName);

        // Mettre à jour le formulaire
        form.pdfFilePath = minioFileName; // Stocker le nom du fichier MinIO
        form.pdfFileName = file.originalname;
        form.pdfTemplate = presignedUrl; // Stocker l'URL présignée

        const updatedForm = await this.formRepository.save(form);

        return {
            form: updatedForm,
            extractedFields,
        };
    }

    /**
     * Extrait les champs de formulaire d'un PDF
     */
    private async extractPdfFields(pdfBuffer: Buffer): Promise<any[]> {
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);
            const form = pdfDoc.getForm();
            const fields = form.getFields();

            const extractedFields: any[] = [];

            for (const field of fields) {
                const fieldName = field.getName();
                const fieldType = field.constructor.name;

                // Déterminer le type de champ
                let type = 'text';
                if (fieldType.includes('TextField')) {
                    type = 'text';
                } else if (fieldType.includes('CheckBox')) {
                    type = 'checkbox';
                } else if (fieldType.includes('RadioGroup')) {
                    type = 'radio';
                } else if (fieldType.includes('Dropdown')) {
                    type = 'select';
                } else if (fieldType.includes('Button')) {
                    type = 'button';
                }

                // Extraire les propriétés du champ
                const fieldObj: any = {
                    name: fieldName,
                    type: type,
                    label: fieldName, // Par défaut, utiliser le nom comme label
                    required: false, // Par défaut, on ne peut pas savoir si c'est requis
                    placeholder: '',
                };

                // Pour les TextField, essayer d'extraire plus d'infos
                if (fieldType.includes('TextField')) {
                    try {
                        const textField = field as any;
                        if (textField.getDefaultValue) {
                            const defaultValue = textField.getDefaultValue();
                            if (defaultValue) {
                                fieldObj.placeholder = defaultValue;
                            }
                        }
                    } catch (e) {
                        // Ignorer les erreurs
                    }
                }

                extractedFields.push(fieldObj);
            }

            return extractedFields;
        } catch (error) {
            // Si l'extraction échoue, retourner un tableau vide
            console.error('Erreur lors de l\'extraction des champs PDF:', error);
            return [];
        }
    }

    /**
     * Récupère le fichier PDF d'un formulaire depuis MinIO
     */
    async getPdfFile(formId: string): Promise<{ buffer: Buffer; fileName: string; contentType: string }> {
        const form = await this.formRepository.findOne({
            where: { id: formId },
        });

        if (!form) {
            throw new NotFoundException('Formulaire non trouvé');
        }

        if (!form.pdfFilePath) {
            throw new NotFoundException('Fichier PDF non trouvé pour ce formulaire');
        }

        // Vérifier si c'est un chemin MinIO (commence par "forms/") ou un ancien chemin local
        const isMinioPath = form.pdfFilePath.startsWith('forms/');

        if (!isMinioPath) {
            // Ancien fichier local - essayer de le lire depuis le disque
            const fs = require('fs');
            if (fs.existsSync(form.pdfFilePath)) {
                const buffer = fs.readFileSync(form.pdfFilePath);
                return {
                    buffer,
                    fileName: form.pdfFileName || `form-${formId}.pdf`,
                    contentType: 'application/pdf',
                };
            } else {
                throw new NotFoundException('Fichier PDF non trouvé (ancien chemin local)');
            }
        }

        // Vérifier si le fichier existe dans MinIO
        const fileExists = await this.minioService.fileExists(form.pdfFilePath);
        if (!fileExists) {
            throw new NotFoundException('Fichier PDF non trouvé dans le stockage MinIO');
        }

        // Récupérer le fichier depuis MinIO
        const buffer = await this.minioService.getFile(form.pdfFilePath);

        return {
            buffer,
            fileName: form.pdfFileName || `form-${formId}.pdf`,
            contentType: 'application/pdf',
        };
    }

    async findAll(): Promise<Form[]> {
        return await this.formRepository.find({
            relations: ['organisation'],
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Form> {
        const form = await this.formRepository.findOne({
            where: { id },
            relations: ['organisation'],
        });

        if (!form) {
            throw new NotFoundException('Formulaire non trouvé');
        }

        return form;
    }

    async findByOrganisation(organisationId: string): Promise<Form[]> {
        return await this.formRepository.find({
            where: { organisationId },
            relations: ['organisation'],
            order: { createdAt: 'DESC' },
        });
    }

    async updateStatus(id: string, status: FormStatus): Promise<Form> {
        const form = await this.findOne(id);

        // Vérifier que le formulaire est activé avant de le mettre en ligne
        if (status === FormStatus.ONLINE && !form.isActive) {
            throw new BadRequestException('Le formulaire doit être activé par l\'admin avant de pouvoir être mis en ligne');
        }

        // L'organisation ne peut mettre que ONLINE ou OFFLINE (pas DRAFT)
        if (status === FormStatus.DRAFT) {
            throw new BadRequestException('L\'organisation ne peut pas remettre un formulaire en DRAFT. Seul l\'admin peut le faire.');
        }

        form.status = status;
        return await this.formRepository.save(form);
    }

    async activate(id: string): Promise<Form> {
        const form = await this.findOne(id);
        form.isActive = true;
        return await this.formRepository.save(form);
    }

    async deactivate(id: string): Promise<Form> {
        const form = await this.findOne(id);
        form.isActive = false;
        // Si le formulaire est en ligne, le mettre hors ligne automatiquement
        if (form.status === FormStatus.ONLINE) {
            form.status = FormStatus.OFFLINE;
        }
        return await this.formRepository.save(form);
    }

    async updateFields(
        id: string,
        updateFieldsDto: { editableFields?: any[]; requiredDocuments?: string[] },
    ): Promise<Form> {
        const form = await this.findOne(id);

        // Si des champs modifiables sont fournis et qu'un PDF existe, mettre à jour le PDF
        if (updateFieldsDto.editableFields !== undefined && form.pdfFilePath) {
            try {
                // Vérifier si c'est un chemin MinIO (commence par "forms/") ou un ancien chemin local
                const isMinioPath = form.pdfFilePath.startsWith('forms/');

                if (isMinioPath) {
                    try {
                        const fileExists = await this.minioService.fileExists(form.pdfFilePath);
                        if (fileExists) {
                            try {
                                await this.updatePdfWithFields(form, updateFieldsDto.editableFields);
                            } catch (pdfUpdateError) {
                                console.error(`Erreur lors de la mise à jour du PDF: ${pdfUpdateError.message}`, pdfUpdateError.stack);
                                // Ne pas bloquer la mise à jour des champs même si le PDF échoue
                                // L'utilisateur pourra toujours mettre à jour les champs dans la base de données
                            }
                        } else {
                            console.warn(`Le fichier PDF n'existe pas dans MinIO pour le formulaire ${form.id}: ${form.pdfFilePath}`);
                        }
                    } catch (minioError) {
                        console.error(`Erreur MinIO lors de la vérification du fichier: ${minioError.message}`, minioError.stack);
                        // Ne pas bloquer la mise à jour des champs même si MinIO échoue
                    }
                } else {
                    // Ancien fichier local - ne pas essayer de le modifier via MinIO
                    console.warn(`Formulaire ${form.id} utilise un ancien chemin local: ${form.pdfFilePath}. Migration nécessaire vers MinIO.`);
                }
            } catch (error) {
                console.error(`Erreur lors de la vérification du fichier PDF: ${error.message}`, error.stack);
                // Ne pas bloquer la mise à jour des champs même si le PDF échoue
            }
        }

        if (updateFieldsDto.editableFields !== undefined) {
            form.editableFields = updateFieldsDto.editableFields;
        }

        if (updateFieldsDto.requiredDocuments !== undefined) {
            form.requiredDocuments = updateFieldsDto.requiredDocuments;
        }

        return await this.formRepository.save(form);
    }

    /**
     * Met à jour le PDF en ajoutant les nouveaux champs avec labels visibles
     */
    private async updatePdfWithFields(form: Form, editableFields: any[]): Promise<void> {
        try {
            // Vérifier que c'est bien un chemin MinIO
            if (!form.pdfFilePath.startsWith('forms/')) {
                throw new Error(`Le fichier PDF n'est pas dans MinIO: ${form.pdfFilePath}`);
            }

            // Charger le PDF original depuis MinIO
            const pdfBytes = await this.minioService.getFile(form.pdfFilePath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const pages = pdfDoc.getPages();
            const formObj = pdfDoc.getForm();

            // Obtenir les champs existants dans le PDF
            const existingFields = formObj.getFields();
            const existingFieldNames = new Set(existingFields.map((f) => f.getName()));

            // Identifier les nouveaux champs à ajouter
            const newFields = editableFields.filter((field) => !existingFieldNames.has(field.name));

            // Grouper les champs par page pour le positionnement automatique
            const fieldsByPage: { [pageIndex: number]: any[] } = {};
            for (const field of newFields) {
                const pageIndex = field.page !== undefined ? field.page : 0;
                if (!fieldsByPage[pageIndex]) {
                    fieldsByPage[pageIndex] = [];
                }
                fieldsByPage[pageIndex].push(field);
            }

            // Ajouter les nouveaux champs au PDF avec labels
            for (const [pageIndexStr, fields] of Object.entries(fieldsByPage)) {
                const pageIndex = parseInt(pageIndexStr);
                if (pageIndex >= pages.length) {
                    console.warn(`Page ${pageIndex} n'existe pas, utilisation de la page 0`);
                    continue;
                }

                const page = pages[pageIndex];
                const pageHeight = page.getHeight();

                // Position verticale de départ (en partant du haut de la page)
                // On commence à 50 points du haut pour laisser de la marge
                let currentY = pageHeight - 50;
                const labelHeight = 12; // Hauteur du label
                const labelMargin = 2; // Marge entre le label et le champ

                for (const field of fields) {
                    // Dimensions du champ
                    const width = field.width !== undefined ? field.width : 200;
                    const height = field.height !== undefined ? field.height : 20;

                    // Position X : utiliser celle fournie ou position par défaut
                    let x = field.x !== undefined ? field.x : 50;

                    // Si la position Y n'est pas fournie, utiliser le positionnement automatique
                    let y: number;
                    if (field.y !== undefined) {
                        // Position Y fournie : utiliser celle-ci (depuis le bas)
                        y = pageHeight - field.y - height;
                    } else {
                        // Positionnement automatique : empiler les champs verticalement
                        y = currentY - height - labelHeight - labelMargin;
                        currentY = y - 5; // Réserver de l'espace pour le prochain champ
                    }

                    // S'assurer que le champ ne dépasse pas de la page
                    if (y < 50) {
                        console.warn(`Champ ${field.name} dépasse de la page, ajustement de la position`);
                        y = 50;
                    }

                    // Créer le label texte visible
                    const labelText = field.label || field.name;
                    const typeText = `[${field.type}]`;
                    const fullLabel = `${labelText} ${typeText}`;

                    try {
                        // Dessiner le label au-dessus du champ
                        page.drawText(fullLabel, {
                            x: x,
                            y: y + height + labelMargin,
                            size: 10,
                            color: rgb(0, 0, 0), // Noir
                        });

                        // Créer et ajouter le champ selon son type
                        switch (field.type) {
                            case 'text':
                            case 'email':
                            case 'number':
                            case 'date':
                                const textField = formObj.createTextField(field.name);
                                textField.addToPage(page, {
                                    x: x,
                                    y: y,
                                    width: width,
                                    height: height,
                                });
                                if (field.placeholder) {
                                    textField.updateAppearances(field.placeholder);
                                }
                                if (field.required) {
                                    textField.enableRequired();
                                }
                                break;

                            case 'checkbox':
                                const checkbox = formObj.createCheckBox(field.name);
                                checkbox.addToPage(page, {
                                    x: x,
                                    y: y,
                                    width: Math.min(width, 20), // Les checkboxes sont généralement carrées
                                    height: Math.min(height, 20),
                                });
                                break;

                            case 'radio':
                                // Pour les radio buttons, on crée un checkbox à la place
                                const radioCheckbox = formObj.createCheckBox(field.name);
                                radioCheckbox.addToPage(page, {
                                    x: x,
                                    y: y,
                                    width: Math.min(width, 20),
                                    height: Math.min(height, 20),
                                });
                                break;

                            case 'select':
                            case 'dropdown':
                                const dropdown = formObj.createDropdown(field.name);
                                dropdown.addToPage(page, {
                                    x: x,
                                    y: y,
                                    width: width,
                                    height: height,
                                });
                                break;

                            default:
                                // Par défaut, créer un text field
                                const defaultField = formObj.createTextField(field.name);
                                defaultField.addToPage(page, {
                                    x: x,
                                    y: y,
                                    width: width,
                                    height: height,
                                });
                                break;
                        }
                    } catch (error) {
                        console.error(`Erreur lors de l'ajout du champ ${field.name}:`, error);
                        // Continuer avec les autres champs
                    }
                }
            }

            // Sauvegarder le PDF modifié dans MinIO
            const modifiedPdfBytes = await pdfDoc.save();
            const pdfBuffer = Buffer.from(modifiedPdfBytes);

            // Uploader le PDF modifié vers MinIO (remplace l'ancien)
            await this.minioService.uploadFile(form.pdfFilePath, pdfBuffer, 'application/pdf');

            // Générer une nouvelle URL présignée
            const presignedUrl = await this.minioService.getPresignedUrl(form.pdfFilePath);
            form.pdfTemplate = presignedUrl;
        } catch (error) {
            console.error('Erreur lors de la mise à jour du PDF avec les nouveaux champs:', error);
            // Re-lancer l'erreur pour que l'appelant puisse la gérer
            throw error;
        }
    }

    async remove(id: string): Promise<void> {
        const form = await this.findOne(id);

        // Supprimer le fichier PDF depuis MinIO s'il existe
        if (form.pdfFilePath) {
            try {
                const fileExists = await this.minioService.fileExists(form.pdfFilePath);
                if (fileExists) {
                    await this.minioService.deleteFile(form.pdfFilePath);
                }
            } catch (error) {
                // Logger l'erreur mais ne pas bloquer la suppression du formulaire
                console.error(`Erreur lors de la suppression du fichier PDF depuis MinIO: ${error.message}`);
            }
        }

        await this.formRepository.remove(form);
    }
}

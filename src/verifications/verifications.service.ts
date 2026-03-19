import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { RequestAdditionalDto, AdditionalInfoReason } from './dto/request-additional.dto';
import { CreateFromDocumentDto } from './dto/create-from-document.dto';
import { Verification, VerificationStatus } from './entities/verification.entity';
import { Sector } from '../organisations/dto/create-organisation.dto';
import { User } from '../auth/entities/user.entity';
import { UserDocument, DocumentStatus, DocumentType as DocumentTypeEnum } from '../users/entities/user-document.entity';
import { EmailService } from '../common/services/email.service';
import { UserIdentityDocument, IdentityDocumentKind } from '../users/entities/user-identity-document.entity';
import { DocumentType } from '../documents/entities/document-type.entity';

/** Infos d’un document pour l’affichage (vérification d’identité) */
export type IdentityDocumentInfo = {
  id: string;
  type: string;
  fileName: string;
  mimeType: string;
  issueDate?: string;
  expirationDate?: string;
};

export type VerificationListItem = Verification & { documentTypeTitle?: string };

@Injectable()
export class VerificationsService {
  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDocument)
    private readonly userDocumentRepository: Repository<UserDocument>,
    @InjectRepository(UserIdentityDocument)
    private readonly userIdentityDocumentRepository: Repository<UserIdentityDocument>,
    @InjectRepository(DocumentType)
    private readonly documentTypeRepository: Repository<DocumentType>,
    private readonly emailService: EmailService,
  ) {}

  /** Libellé humain du document (préférer document_types.title). */
  private async getDocumentDisplayTitle(documentId: string, fallbackType?: string): Promise<string> {
    try {
      const userDocument = await this.userDocumentRepository.findOne({ where: { id: documentId } });
      if (userDocument?.documentTypeId) {
        const docType = await this.documentTypeRepository.findOne({ where: { id: userDocument.documentTypeId } });
        if (docType?.title?.trim()) return docType.title.trim();
      }
      const t = String(userDocument?.type ?? fallbackType ?? '').toUpperCase();
      if (t === 'CARTE_IDENTITE') return 'Carte d’identité';
      if (t === 'CERTIFICAT_NATIONALITE') return 'Certificat de nationalité';
      if (t === 'EXTRAIT_NAISSANCE') return 'Extrait de naissance';
      if (t === 'PASSEPORT') return 'Passeport';
      if (t === 'PERMIS_CONDUIRE') return 'Permis de conduire';
      if (t === 'SELFIE') return 'Selfie';
    } catch {
      // ignore
    }
    return fallbackType || 'Document';
  }

  /** Normalise un champ date (DB: string YYYY-MM-DD ou Date) vers YYYY-MM-DD. */
  private toYyyyMmDd(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return undefined;
      // souvent déjà au format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      // fallback : tenter de parser
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      return undefined;
    }
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    return undefined;
  }

  async create(verifyDocumentDto: VerifyDocumentDto): Promise<Verification> {
    // Simulation de la vérification IA
    const aiResults = {
      formatConforme: Math.random() > 0.2,
      bonneLisibilite: Math.random() > 0.2,
      coherenceInformations: Math.random() > 0.2,
    };

    const score = Math.floor(
      ((aiResults.formatConforme ? 1 : 0) +
        (aiResults.bonneLisibilite ? 1 : 0) +
        (aiResults.coherenceInformations ? 1 : 0)) *
        (100 / 3) +
        Math.random() * 20,
    );

    // Le statut ne peut jamais être VALIDE automatiquement - nécessite une validation humaine
    // Tous les documents sont mis en EN_COURS (en attente de validation) peu importe le score
    // Le score sert uniquement à l'affichage et à la priorisation
    const status = VerificationStatus.EN_COURS;

    const newVerification = this.verificationRepository.create({
      documentId: verifyDocumentDto.documentId,
      documentType: 'CNI',
      clientId: verifyDocumentDto.clientId,
      clientName: 'Client Name',
      sector: Sector.BANQUE,
      status,
      score,
      aiResults,
      submittedAt: new Date(),
      requestId: verifyDocumentDto.formId,
    });

    return await this.verificationRepository.save(newVerification);
  }

  async findAll(status?: string, sector?: string): Promise<VerificationListItem[]> {
    const queryBuilder = this.verificationRepository.createQueryBuilder('verification');

    if (status) {
      queryBuilder.where('verification.status = :status', { status });
    }

    if (sector) {
      queryBuilder.andWhere('verification.sector = :sector', { sector });
    }

    const list = await queryBuilder
      .orderBy('verification.submittedAt', 'DESC')
      .getMany();

    // Enrichir avec le titre du type de document (depuis document_types)
    const result: VerificationListItem[] = [];
    for (const v of list) {
      const item: VerificationListItem = { ...v };
      try {
        const userDoc = await this.userDocumentRepository.findOne({
          where: { id: v.documentId },
        });
        if (userDoc?.documentTypeId) {
          const docType = await this.documentTypeRepository.findOne({
            where: { id: userDoc.documentTypeId },
          });
          if (docType?.title) {
            item.documentTypeTitle = docType.title;
          }
        }
      } catch {
        // ignorer si document ou type introuvable
      }
      result.push(item);
    }
    return result;
  }

  async findOne(id: string): Promise<Verification & {
    document?: IdentityDocumentInfo;
    selfieDocument?: IdentityDocumentInfo;
    /** Face recto CNI (pour vérification humaine) */
    identityRectoDocument?: IdentityDocumentInfo;
    /** Face verso CNI (pour vérification humaine) */
    identityVersoDocument?: IdentityDocumentInfo;
    /** Selfie (pour vérification humaine) */
    identitySelfieDocument?: IdentityDocumentInfo;
  }> {
    const verification = await this.verificationRepository.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!verification) {
      throw new NotFoundException('Vérification non trouvée');
    }
    const result = {
      id: verification.id,
      documentId: verification.documentId,
      documentType: verification.documentType,
      clientId: verification.clientId,
      clientName: verification.clientName,
      sector: verification.sector,
      status: verification.status,
      score: verification.score,
      aiResults: verification.aiResults,
      humanVerification: verification.humanVerification,
      requestId: verification.requestId,
      submittedAt: verification.submittedAt,
      validatedAt: verification.validatedAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
      client: verification.client
        ? {
            id: verification.client.id,
            name: verification.client.name,
            firstName: verification.client.firstName,
            lastName: verification.client.lastName,
            email: verification.client.email,
            phone: verification.client.phone,
          }
        : undefined,
    } as Verification & {
      document?: IdentityDocumentInfo;
      selfieDocument?: IdentityDocumentInfo;
      identityRectoDocument?: IdentityDocumentInfo;
      identityVersoDocument?: IdentityDocumentInfo;
      identitySelfieDocument?: IdentityDocumentInfo;
    };

    try {
      const document = await this.userDocumentRepository.findOne({
        where: { id: verification.documentId },
      });
      if (document) {
        // Enrichir avec le titre du type de document (document_types.title) si disponible
        try {
          if (document.documentTypeId) {
            const docType = await this.documentTypeRepository.findOne({
              where: { id: document.documentTypeId },
            });
            if (docType?.title) {
              (result as any).documentTypeTitle = docType.title;
            }
          }
        } catch {
          // ignorer si type introuvable
        }
        result.document = {
          id: document.id,
          type: String(document.type),
          fileName: document.fileName,
          mimeType: document.mimeType,
          issueDate: this.toYyyyMmDd((document as any).issueDate),
          expirationDate: this.toYyyyMmDd((document as any).expirationDate),
        };
      }
    } catch {
      // Document introuvable ou erreur
    }

    try {
      const selfieDoc = await this.userDocumentRepository.findOne({
        where: { userId: verification.clientId, type: DocumentTypeEnum.SELFIE },
        order: { createdAt: 'DESC' },
      });
      if (selfieDoc) {
        result.selfieDocument = {
          id: selfieDoc.id,
          type: String(selfieDoc.type),
          fileName: selfieDoc.fileName,
          mimeType: selfieDoc.mimeType,
        };
      }
    } catch {
      // Selfie ou erreur
    }
    // Vérification d’identité : recto CNI, verso CNI, selfie (par types de documents créés par l’admin)
    let identityDocs: UserIdentityDocument[] = [];
    try {
      identityDocs = await this.userIdentityDocumentRepository.find({
        where: { userId: verification.clientId },
      });
    } catch {
      // Table user_identity_documents absente ou erreur : ne pas faire échouer GET /verifications/:id
    }
    const toDocInfo = (d: UserIdentityDocument): IdentityDocumentInfo => ({
      id: d.id,
      type: String(d.kind),
      fileName: d.fileName,
      mimeType: d.mimeType,
    });
    for (const d of identityDocs) {
      if (d.kind === IdentityDocumentKind.RECTO) result.identityRectoDocument = toDocInfo(d);
      else if (d.kind === IdentityDocumentKind.VERSO) result.identityVersoDocument = toDocInfo(d);
      else if (d.kind === IdentityDocumentKind.SELFIE) result.identitySelfieDocument = toDocInfo(d);
    }
    // Si identitySelfieDocument pas trouvé par type mais selfieDocument existe, l’utiliser
    if (!result.identitySelfieDocument && result.selfieDocument) {
      result.identitySelfieDocument = result.selfieDocument;
    }
    return result;
  }

  /**
   * Trouve une vérification par documentId
   */
  async findByDocumentId(documentId: string): Promise<Verification | null> {
    return await this.verificationRepository.findOne({
      where: { documentId },
      relations: ['client', 'request'],
    });
  }

  /**
   * Quand un client remplace/ré-upload un document rejeté,
   * on doit remettre la vérification humaine en état "à traiter" (EN_COURS),
   * sinon l'admin verra encore REJETE et les boutons restent bloqués.
   */
  async resetForDocumentReupload(documentId: string): Promise<Verification | null> {
    const verification = await this.findByDocumentId(documentId);
    if (!verification) return null;

    // Simulation "nouveau scan" pour l'affichage (facultatif mais utile)
    const aiResults = {
      formatConforme: Math.random() > 0.2,
      bonneLisibilite: Math.random() > 0.2,
      coherenceInformations: Math.random() > 0.2,
    };
    const score = Math.floor(
      ((aiResults.formatConforme ? 1 : 0) +
        (aiResults.bonneLisibilite ? 1 : 0) +
        (aiResults.coherenceInformations ? 1 : 0)) *
        (100 / 3) +
        Math.random() * 20,
    );

    verification.status = VerificationStatus.EN_COURS;
    verification.score = score;
    verification.aiResults = aiResults;
    // TypeORM peut ne pas considérer `undefined` comme un changement,
    // on force donc à `null` pour remettre à zéro.
    verification.humanVerification = null;
    verification.validatedAt = null;
    verification.submittedAt = new Date();

    return await this.verificationRepository.save(verification);
  }

  /**
   * Crée une vérification automatiquement depuis un document uploadé
   */
  async createFromDocument(createDto: CreateFromDocumentDto): Promise<Verification> {
    // Vérifier si une vérification existe déjà pour ce document
    const existingVerification = await this.findByDocumentId(createDto.documentId);
    if (existingVerification) {
      return existingVerification;
    }

    // Simulation de la vérification IA
    const aiResults = {
      formatConforme: Math.random() > 0.2,
      bonneLisibilite: Math.random() > 0.2,
      coherenceInformations: Math.random() > 0.2,
    };

    const score = Math.floor(
      ((aiResults.formatConforme ? 1 : 0) +
        (aiResults.bonneLisibilite ? 1 : 0) +
        (aiResults.coherenceInformations ? 1 : 0)) *
        (100 / 3) +
        Math.random() * 20,
    );

    // Le statut ne peut jamais être VALIDE automatiquement - nécessite une validation humaine
    // Tous les documents sont mis en EN_COURS (en attente de validation) peu importe le score
    // Le score sert uniquement à l'affichage et à la priorisation
    // A_VERIFIER est utilisé uniquement lors d'une demande d'informations complémentaires
    const status = VerificationStatus.EN_COURS;

    const newVerification = this.verificationRepository.create({
      documentId: createDto.documentId,
      documentType: createDto.documentType,
      clientId: createDto.clientId,
      clientName: createDto.clientName,
      sector: createDto.sector,
      status,
      score,
      aiResults,
      submittedAt: new Date(),
    });

    return await this.verificationRepository.save(newVerification);
  }

  /**
   * Valide une vérification (peut être appelée pour EN_COURS ou A_VERIFIER)
   * Seule une validation humaine peut passer le statut à VALIDE
   * Le statut initial est toujours EN_COURS, A_VERIFIER est utilisé uniquement pour les demandes de complément
   */
  async validate(id: string, userId: string): Promise<Verification> {
    // Essayer de trouver la vérification par ID
    let verification = await this.verificationRepository.findOne({
      where: { id },
      relations: ['client', 'request'],
    });

    // Si la vérification n'existe pas, essayer de la trouver par documentId
    if (!verification) {
      verification = await this.findByDocumentId(id);
    }

    // Si toujours pas trouvée, créer une vérification à partir du document
    if (!verification) {
      const userDocument = await this.userDocumentRepository.findOne({
        where: { id },
        relations: ['user'],
      });

      if (!userDocument) {
        throw new NotFoundException('Document non trouvé. Impossible de créer une vérification.');
      }

      // Créer une vérification automatiquement
      const user = userDocument.user;
      const sector = user.organisationId ? 'BANQUE' : 'BANQUE'; // TODO: Récupérer le secteur réel
      
      verification = await this.createFromDocument({
        documentId: userDocument.id,
        clientId: userDocument.userId,
        clientName: user.name || `${user.firstName} ${user.lastName}`,
        documentType: userDocument.type,
        sector: sector as any,
      });
    }

    verification.status = VerificationStatus.VALIDE;
    verification.validatedAt = new Date();
    verification.humanVerification = {
      verifiedBy: userId,
      verifiedAt: new Date(),
    };
    const savedVerification = await this.verificationRepository.save(verification);
    
    // Mettre à jour le statut du UserDocument correspondant
    try {
      const userDocument = await this.userDocumentRepository.findOne({
        where: { id: verification.documentId },
      });
      if (userDocument) {
        userDocument.status = DocumentStatus.VALIDE;
        userDocument.isVerified = true;
        await this.userDocumentRepository.save(userDocument);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document:', error);
    }
    
    // Envoyer un email de notification au client
    try {
      const client = await this.userRepository.findOne({ where: { id: verification.clientId } });
      if (client) {
        const documentTitle = await this.getDocumentDisplayTitle(
          verification.documentId,
          String(verification.documentType),
        );
        await this.emailService.sendDocumentValidatedEmail(
          client.email,
          client.name,
          documentTitle,
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de validation:', error);
    }
    
    return savedVerification;
  }

  async reject(id: string, userId: string, rejectDto: RejectDocumentDto): Promise<Verification> {
    const verification = await this.findOne(id);
    verification.status = VerificationStatus.REJETE;
    verification.humanVerification = {
      verifiedBy: userId,
      verifiedAt: new Date(),
      comments: rejectDto.reason,
    };
    const savedVerification = await this.verificationRepository.save(verification);
    
    // Mettre à jour le statut du UserDocument correspondant
    try {
      const userDocument = await this.userDocumentRepository.findOne({
        where: { id: verification.documentId },
      });
      if (userDocument) {
        userDocument.status = DocumentStatus.REJETE;
        userDocument.rejectionReason = rejectDto.reason;
        userDocument.isVerified = false;
        await this.userDocumentRepository.save(userDocument);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document:', error);
    }
    
    // Envoyer un email de notification au client
    try {
      const client = await this.userRepository.findOne({ where: { id: verification.clientId } });
      if (client) {
        const documentTitle = await this.getDocumentDisplayTitle(
          verification.documentId,
          String(verification.documentType),
        );
        await this.emailService.sendDocumentRejectedEmail(
          client.email,
          client.name,
          documentTitle,
          rejectDto.reason,
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de rejet:', error);
    }
    
    return savedVerification;
  }

  async requestAdditionalInfo(
    id: string,
    userId: string,
    requestDto: RequestAdditionalDto,
  ): Promise<Verification> {
    const verification = await this.findOne(id);
    verification.status = VerificationStatus.A_VERIFIER;
    
    // Construire le message avec les raisons
    const reasonLabels: Record<AdditionalInfoReason, string> = {
      [AdditionalInfoReason.IMAGE_FLOUE]: 'Image floue',
      [AdditionalInfoReason.PIECE_EXPIREE]: 'Pièce expirée',
      [AdditionalInfoReason.NUMERO_ILLISIBLE]: 'Numéro illisible',
      [AdditionalInfoReason.MAUVAIS_DOCUMENT]: 'Mauvais document',
      [AdditionalInfoReason.INFORMATION_INCOHERENTES]: 'Information incohérentes',
    };

    const reasonsText = requestDto.reasons.map((r) => reasonLabels[r]).join(', ');
    const comments = requestDto.message
      ? `${reasonsText}. ${requestDto.message}`
      : reasonsText;

    verification.humanVerification = {
      verifiedBy: userId,
      verifiedAt: new Date(),
      comments,
      additionalInfoReasons: requestDto.reasons,
    };
    
    const savedVerification = await this.verificationRepository.save(verification);
    
    // Mettre à jour le statut du UserDocument correspondant
    try {
      const userDocument = await this.userDocumentRepository.findOne({
        where: { id: verification.documentId },
      });
      if (userDocument) {
        userDocument.status = DocumentStatus.EN_VERIFICATION;
        userDocument.rejectionReason = comments;
        await this.userDocumentRepository.save(userDocument);
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour du document:', error);
    }
    
    return savedVerification;
  }

  async getStatistics() {
    const [total, validated, rejected, inProgress] = await Promise.all([
      this.verificationRepository.count(),
      this.verificationRepository.count({ where: { status: VerificationStatus.VALIDE } }),
      this.verificationRepository.count({ where: { status: VerificationStatus.REJETE } }),
      this.verificationRepository.count({ where: { status: VerificationStatus.EN_COURS } }),
    ]);

    return {
      total,
      validated,
      rejected,
      inProgress,
      pending: total - validated - rejected - inProgress,
    };
  }
}




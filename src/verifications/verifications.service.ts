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
import { UserDocument, DocumentStatus, DocumentType } from '../users/entities/user-document.entity';
import { EmailService } from '../common/services/email.service';

@Injectable()
export class VerificationsService {
  constructor(
    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDocument)
    private readonly userDocumentRepository: Repository<UserDocument>,
    private readonly emailService: EmailService,
  ) {}

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

  async findAll(status?: string, sector?: string): Promise<Verification[]> {
    const queryBuilder = this.verificationRepository.createQueryBuilder('verification');

    if (status) {
      queryBuilder.where('verification.status = :status', { status });
    }

    if (sector) {
      queryBuilder.andWhere('verification.sector = :sector', { sector });
    }

    return await queryBuilder
      .orderBy('verification.submittedAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Verification & {
    document?: { id: string; type: string; fileName: string; mimeType: string };
    selfieDocument?: { id: string; type: string; fileName: string; mimeType: string };
  }> {
    const verification = await this.verificationRepository.findOne({
      where: { id },
      relations: ['client', 'request'],
    });
    if (!verification) {
      throw new NotFoundException('Vérification non trouvée');
    }
    const document = await this.userDocumentRepository.findOne({
      where: { id: verification.documentId },
    });
    const result = { ...verification } as Verification & {
      document?: { id: string; type: string; fileName: string; mimeType: string };
      selfieDocument?: { id: string; type: string; fileName: string; mimeType: string };
    };
    if (document) {
      result.document = {
        id: document.id,
        type: document.type,
        fileName: document.fileName,
        mimeType: document.mimeType,
      };
    }
    // Retourner aussi le selfie du même client pour que l'admin voie CNI + selfie dans le détail
    const selfieDoc = await this.userDocumentRepository.findOne({
      where: { userId: verification.clientId, type: DocumentType.SELFIE },
      order: { createdAt: 'DESC' },
    });
    if (selfieDoc) {
      result.selfieDocument = {
        id: selfieDoc.id,
        type: selfieDoc.type,
        fileName: selfieDoc.fileName,
        mimeType: selfieDoc.mimeType,
      };
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
        await this.emailService.sendDocumentValidatedEmail(
          client.email,
          client.name,
          verification.documentType,
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
        await this.emailService.sendDocumentRejectedEmail(
          client.email,
          client.name,
          verification.documentType,
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




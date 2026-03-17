import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { CreateRequestDto } from './dto/create-request.dto';
import { SaveDraftRequestDto } from './dto/save-draft-request.dto';
import { Request, RequestStatus, RequestTrackingStatus } from './entities/request.entity';
import { FormType } from '../forms/dto/create-form.dto';
import { RequestStatisticsDto } from './dto/request-statistics.dto';
import { User } from '../auth/entities/user.entity';
import { Form, FormStatus } from '../forms/entities/form.entity';
import { UserDocument, DocumentStatus } from '../users/entities/user-document.entity';
import { DocumentType as DocumentTypeEntity } from '../documents/entities/document-type.entity';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { MinioService } from '../storage/minio.service';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../auth/dto/register.dto';

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);
  private readonly OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes
  private readonly OTP_LENGTH = 6;
  private readonly UPLOAD_TOKEN_EXPIRATION = '15m';

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(UserDocument)
    private userDocumentRepository: Repository<UserDocument>,
    @InjectRepository(DocumentTypeEntity)
    private documentTypeRepository: Repository<DocumentTypeEntity>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    private emailService: EmailService,
    private smsService: SmsService,
    private minioService: MinioService,
    private jwtService: JwtService,
  ) { }

  /**
   * Génère un code OTP de 6 chiffres
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Génère un numéro de demande unique en vérifiant dans la base de données
   */
  private async generateUniqueRequestNumber(): Promise<string> {
    // Récupérer tous les numéros de demande existants
    const existingRequests = await this.requestRepository
      .createQueryBuilder('request')
      .where('request.requestNumber IS NOT NULL')
      .andWhere("request.requestNumber LIKE 'DEM-%'")
      .select('request.requestNumber', 'requestNumber')
      .getRawMany();

    // Trouver le numéro le plus élevé
    let maxNumber = 991; // Commencer à 991 pour que le premier soit DEM-992
    for (const row of existingRequests) {
      const match = row.requestNumber?.match(/DEM-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    }

    // Générer le prochain numéro et vérifier l'unicité
    let nextNumber = maxNumber + 1;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const requestNumber = `DEM-${nextNumber}`;

      // Vérifier si ce numéro existe déjà
      const exists = await this.requestRepository.findOne({
        where: { requestNumber },
      });

      if (!exists) {
        return requestNumber;
      }

      // Si le numéro existe, incrémenter et réessayer
      nextNumber++;
      attempts++;
    }

    // Si on n'a pas trouvé de numéro unique après maxAttempts tentatives, utiliser un timestamp
    return `DEM-${Date.now()}`;
  }

  /**
   * Vérifie que le client a tous les documents requis pour le formulaire
   * requiredDocumentIds contient les IDs des DocumentType (entity)
   */
  private async verifyRequiredDocuments(clientId: string, requiredDocumentIds: string[]): Promise<void> {
    const ids = Array.isArray(requiredDocumentIds) ? requiredDocumentIds : [];
    if (ids.length === 0) {
      return; // Aucun document requis
    }

    // Récupérer les types de documents requis
    const requiredDocumentTypes = await this.documentTypeRepository.find({
      where: ids.map((id) => ({ id })),
    });

    if (requiredDocumentTypes.length !== ids.length) {
      throw new BadRequestException('Certains types de documents requis sont introuvables');
    }

    // Récupérer tous les documents du client avec statut VALIDE et leurs documentTypeId
    const clientDocuments = await this.userDocumentRepository.find({
      where: {
        userId: clientId,
        status: DocumentStatus.VALIDE,
      },
    });

    // Date actuelle pour vérifier l'expiration
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Vérifier que le client a des documents validés et non expirés pour tous les types requis
    const missingDocuments: string[] = [];
    for (const docType of requiredDocumentTypes) {
      // Vérifier si le client a un document validé et non expiré pour ce type spécifique
      const hasValidDocument = clientDocuments.some((doc) => {
        // Vérifier que le document correspond au type requis via documentTypeId
        // documentTypeId doit être défini et correspondre à l'ID du type requis
        if (!doc.documentTypeId || doc.documentTypeId !== docType.id || doc.status !== DocumentStatus.VALIDE) {
          return false;
        }

        // Vérifier que le document n'est pas expiré
        // Si expirationDate est null, le document n'a pas de date d'expiration (valide)
        // Si expirationDate existe, elle doit être dans le futur
        if (doc.expirationDate) {
          const expirationDate = new Date(doc.expirationDate);
          expirationDate.setHours(0, 0, 0, 0);
          if (expirationDate <= today) {
            return false; // Document expiré
          }
        }

        return true;
      });

      if (!hasValidDocument) {
        missingDocuments.push(docType.title);
      }
    }

    if (missingDocuments.length > 0) {
      const documentTitles = missingDocuments.join(', ');
      throw new BadRequestException(
        `Vous devez avoir tous les documents requis validés pour soumettre cette demande. Documents manquants ou non validés : ${documentTitles}. Veuillez uploader et faire valider ces documents avant de soumettre votre demande.`,
      );
    }
  }

  /**
   * Crée ou met à jour un brouillon de demande (pour le processus par étapes)
   */
  async saveDraft(clientId: string, draftDto: SaveDraftRequestDto, existingDraftId?: string): Promise<Request> {
    // Récupérer le client
    const client = await this.userRepository.findOne({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    // Si un brouillon existe, le mettre à jour
    if (existingDraftId) {
      const existingDraft = await this.requestRepository.findOne({
        where: { id: existingDraftId, clientId, status: RequestStatus.BROUILLON },
      });

      if (existingDraft) {
        // Mettre à jour le brouillon existant
        if (draftDto.formId) {
          const form = await this.formRepository.findOne({ where: { id: draftDto.formId } });
          if (!form) {
            throw new NotFoundException('Formulaire non trouvé');
          }
          // Vérifier que le formulaire est ONLINE
          if (form.status !== FormStatus.ONLINE) {
            throw new BadRequestException('Ce formulaire n\'est pas disponible pour le moment');
          }
          existingDraft.formId = draftDto.formId;
          existingDraft.formName = form.name;
          existingDraft.formType = form.formType;
          existingDraft.formSchemaSnapshot = {
            formId: form.id,
            name: form.name,
            version: form.version,
            editableFields: form.editableFields ?? [],
          };
        }

        if (draftDto.organisationId) {
          existingDraft.organisationId = draftDto.organisationId;
        }

        if (draftDto.beneficiary !== undefined) {
          existingDraft.beneficiary = draftDto.beneficiary;
        }

        if (draftDto.amount !== undefined) {
          existingDraft.amount = draftDto.amount;
        }

        if (draftDto.formData !== undefined) {
          existingDraft.formData = draftDto.formData;
        }

        existingDraft.updatedAt = new Date();
        return await this.requestRepository.save(existingDraft);
      }
    }

    // Créer un nouveau brouillon
    let formName: string | undefined = undefined;
    let formType: FormType | undefined = undefined;

    let formSchemaSnapshot:
      | {
        formId: string;
        name: string;
        version: string;
        editableFields?: any[];
      }
      | undefined;

    if (draftDto.formId) {
      const form = await this.formRepository.findOne({ where: { id: draftDto.formId } });
      if (!form) {
        throw new NotFoundException('Formulaire non trouvé');
      }
      // Vérifier que le formulaire est ONLINE
      if (form.status !== FormStatus.ONLINE) {
        throw new BadRequestException('Ce formulaire n\'est pas disponible pour le moment');
      }
      formName = form.name;
      formType = form.formType;
      formSchemaSnapshot = {
        formId: form.id,
        name: form.name,
        version: form.version,
        editableFields: form.editableFields ?? [],
      };
    }

    // Les brouillons n'ont pas de numéro de demande
    // Le numéro sera généré lors de la soumission

    const newDraft = this.requestRepository.create({
      requestNumber: null, // Pas de numéro pour un brouillon
      formId: draftDto.formId || undefined, // undefined si non fourni
      formName: formName || 'Brouillon',
      formType: formType || FormType.DEMANDE, // Valeur par défaut pour les brouillons
      clientId,
      clientName: client.name,
      organisationId: draftDto.organisationId || undefined, // undefined si non fourni
      status: RequestStatus.BROUILLON,
      beneficiary: draftDto.beneficiary,
      amount: draftDto.amount,
      formData: draftDto.formData,
      formSchemaSnapshot,
      tracking: [],
      // Pas de submittedAt pour un brouillon
      // Pas d'OTP pour un brouillon
    });

    return await this.requestRepository.save(newDraft);
  }

  /**
   * Soumet une demande (passe de BROUILLON à EN_ATTENTE après vérification OTP)
   */
  async submitRequest(requestId: string, clientEmail?: string): Promise<Request> {
    try {
      const draft = await this.requestRepository.findOne({
        where: { id: requestId },
        relations: ['form', 'client'],
      });

      if (!draft) {
        throw new NotFoundException('Demande non trouvée');
      }

      if (draft.status !== RequestStatus.BROUILLON) {
        throw new BadRequestException('Cette demande a déjà été soumise');
      }

      // Vérifier que le formulaire est défini
      if (!draft.formId) {
        throw new BadRequestException('Veuillez sélectionner un formulaire');
      }

      // Vérifier que l'organisation est définie
      if (!draft.organisationId) {
        throw new BadRequestException('Veuillez sélectionner une organisation');
      }

      // Récupérer le formulaire pour vérifier les documents requis
      const form = await this.formRepository.findOne({
        where: { id: draft.formId },
      });

      if (!form) {
        throw new NotFoundException('Formulaire non trouvé');
      }

      // Vérifier que le formulaire est ONLINE
      if (form.status !== FormStatus.ONLINE) {
        throw new BadRequestException('Ce formulaire n\'est pas disponible pour le moment');
      }

      // S'assurer que le brouillon possède un snapshot de formulaire
      if (!draft.formSchemaSnapshot) {
        draft.formSchemaSnapshot = {
          formId: form.id,
          name: form.name,
          version: form.version,
          editableFields: form.editableFields ?? [],
        };
      }

      // Vérifier que le client a tous les documents requis validés
      const requiredDocIds = Array.isArray(form.requiredDocuments) ? form.requiredDocuments : [];
      if (requiredDocIds.length > 0) {
        await this.verifyRequiredDocuments(draft.clientId, requiredDocIds);
      }

      // Récupérer le client
      const client = await this.userRepository.findOne({
        where: { id: draft.clientId },
      });

      if (!client) {
        throw new NotFoundException('Client non trouvé');
      }

      // Générer un code OTP de 6 chiffres
      const otpCode = this.generateOtp();
      const otpExpiry = new Date(Date.now() + this.OTP_EXPIRATION);

      // Utiliser l'email fourni ou celui du client
      const verificationEmail = clientEmail || client.email;

      // Générer le numéro de demande définitif (uniquement si pas déjà généré)
      if (!draft.requestNumber) {
        draft.requestNumber = await this.generateUniqueRequestNumber();
      }

      // Mettre à jour la demande : passer en EN_ATTENTE et ajouter l'OTP
      draft.status = RequestStatus.EN_ATTENTE;
      draft.otpCode = otpCode;
      draft.otpExpiry = otpExpiry;
      draft.otpVerified = false;
      draft.verificationEmail = verificationEmail;
      draft.tracking = [
        {
          status: RequestTrackingStatus.SOUMISE,
          date: new Date(),
        },
      ];
      draft.updatedAt = new Date();
      // submittedAt sera défini après vérification OTP

      const maxSaveAttempts = 5;
      let savedRequest: Request | null = null;
      for (let attempt = 1; attempt <= maxSaveAttempts; attempt++) {
        try {
          savedRequest = await this.requestRepository.save(draft);
          break;
        } catch (saveErr: any) {
          const pgCode = saveErr?.code ?? saveErr?.driverError?.code;
          const isDuplicateRequestNumber =
            saveErr instanceof QueryFailedError && pgCode === '23505';
          if (isDuplicateRequestNumber && attempt < maxSaveAttempts) {
            draft.requestNumber = await this.generateUniqueRequestNumber();
            this.logger.warn(
              `Conflit de numéro de demande (tentative ${attempt}/${maxSaveAttempts}), nouveau numéro: ${draft.requestNumber}`,
            );
            continue;
          }
          throw saveErr;
        }
      }
      if (!savedRequest) {
        throw new InternalServerErrorException('Erreur lors de l\'enregistrement de la demande.');
      }

      // Envoyer l'OTP par email (non bloquant)
      const finalRequestNumber = savedRequest.requestNumber ?? draft.requestNumber;
      try {
        await this.emailService.sendRequestOtpEmail(
          verificationEmail,
          otpCode,
          finalRequestNumber!,
          client.name,
        );
      } catch (emailError: any) {
        this.logger.warn(`Envoi OTP email pour demande ${finalRequestNumber} échoué: ${emailError?.message}`);
      }

      // Envoyer l'OTP par SMS si le client a un numéro de téléphone (non bloquant)
      if (client.phone) {
        try {
          await this.smsService.sendOtpSms(
            client.phone,
            otpCode,
            finalRequestNumber!,
          );
        } catch (smsError: any) {
          this.logger.warn(`Envoi OTP SMS pour demande ${finalRequestNumber} échoué: ${smsError?.message}`);
        }
      }

      return savedRequest;
    } catch (error: any) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        `submitRequest ${requestId} erreur inattendue: ${error?.message ?? error}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Erreur lors de la soumission de la demande. Veuillez réessayer.',
      );
    }
  }

  async create(createRequestDto: CreateRequestDto, clientEmail?: string): Promise<Request> {
    // Cette méthode est maintenant utilisée pour la soumission directe (ancien comportement)
    // Pour le nouveau processus par étapes, utiliser saveDraft() puis submitRequest()

    // Récupérer le formulaire pour vérifier les documents requis
    const form = await this.formRepository.findOne({
      where: { id: createRequestDto.formId },
    });

    if (!form) {
      throw new NotFoundException('Formulaire non trouvé');
    }

    // Vérifier que le formulaire est ONLINE
    if (form.status !== FormStatus.ONLINE) {
      throw new BadRequestException('Ce formulaire n\'est pas disponible pour le moment');
    }

    // Vérification des documents requis est optionnelle
    // On ne bloque pas la soumission si les documents ne sont pas fournis
    // L'organisation pourra demander les documents complémentaires plus tard si nécessaire
    // if (form.requiredDocuments && form.requiredDocuments.length > 0) {
    //   await this.verifyRequiredDocuments(createRequestDto.clientId!, form.requiredDocuments);
    // }

    // Récupérer le client pour obtenir son email et nom
    const client = await this.userRepository.findOne({
      where: { id: createRequestDto.clientId },
    });

    if (!client) {
      throw new NotFoundException('Client non trouvé');
    }

    // Générer un code OTP de 6 chiffres
    const otpCode = this.generateOtp();
    const otpExpiry = new Date(Date.now() + this.OTP_EXPIRATION);

    // Utiliser l'email fourni ou celui du client
    const verificationEmail = clientEmail || client.email;

    const requestNumber = await this.generateUniqueRequestNumber();

    // Créer la demande avec l'OTP
    const newRequest = this.requestRepository.create({
      formId: createRequestDto.formId,
      formName: form.name,
      formType: form.formType,
      clientId: createRequestDto.clientId!,
      clientName: client.name,
      organisationId: createRequestDto.organisationId,
      status: RequestStatus.EN_ATTENTE,
      beneficiary: (createRequestDto as any).beneficiary,
      amount: (createRequestDto as any).amount,
      formData: (createRequestDto as any).formData,
      formSchemaSnapshot: {
        formId: form.id,
        name: form.name,
        version: form.version,
        editableFields: form.editableFields ?? [],
      },
      tracking: [
        {
          status: RequestTrackingStatus.SOUMISE,
          date: new Date(),
        },
      ],
      submittedAt: new Date(),
      otpCode,
      otpExpiry,
      otpVerified: false,
      verificationEmail,
    });

    const savedRequest = await this.requestRepository.save(newRequest);

    // Envoyer l'OTP par email
    try {
      await this.emailService.sendRequestOtpEmail(
        verificationEmail,
        otpCode,
        requestNumber,
        client.name,
      );
    } catch (error) {
      // Si l'envoi d'email échoue, on garde quand même la demande mais on log l'erreur
      console.error(`Erreur lors de l'envoi de l'OTP par email pour la demande ${requestNumber}:`, error);
    }

    // Envoyer l'OTP par SMS si le client a un numéro de téléphone
    if (client.phone) {
      try {
        await this.smsService.sendOtpSms(
          client.phone,
          otpCode,
          requestNumber,
        );
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'OTP par SMS pour la demande ${requestNumber}:`, error);
      }
    }

    return savedRequest;
  }

  async findAll(status?: string, formType?: string): Promise<Request[]> {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organisation', 'organisation');

    // Exclure les brouillons et les demandes avec OTP non vérifié pour admin/organisation
    queryBuilder.andWhere(
      '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
      {
        draftStatus: RequestStatus.BROUILLON,
        enAttenteStatus: RequestStatus.EN_ATTENTE,
      },
    );

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType });
    }

    return queryBuilder.getMany();
  }

  async findByClient(clientId: string, status?: string, formType?: string, includeDrafts: boolean = false): Promise<Request[]> {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .where('request.clientId = :clientId', { clientId });

    // Par défaut, exclure les brouillons et les demandes avec OTP non vérifié sauf si explicitement demandé
    if (!includeDrafts) {
      queryBuilder.andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );
    }

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType });
    }

    return queryBuilder.getMany();
  }

  /**
   * Liste paginée des demandes d'un client avec recherche (numéro, formulaire, organisation).
   */
  async findByClientPaginated(
    clientId: string,
    options: { page?: number; limit?: number; search?: string; status?: string; formType?: string },
  ): Promise<{ items: Request[]; total: number }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .where('request.clientId = :clientId', { clientId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    if (options.status) {
      queryBuilder.andWhere('request.status = :status', { status: options.status });
    }
    if (options.formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType: options.formType });
    }
    if (options.search?.trim()) {
      const term = `%${options.search.trim()}%`;
      queryBuilder.andWhere(
        '(request.requestNumber ILIKE :term OR request.formName ILIKE :term OR request.organisationName ILIKE :term OR organisation.name ILIKE :term)',
        { term },
      );
    }

    const [items, total] = await queryBuilder
      .orderBy('request.updatedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  /**
   * Récupère les demandes récentes d'un client avec l'organisation chargée (pour institution / secteur).
   * Filtres optionnels : status, category, institution, type, search (recherche globale).
   */
  async findRecentByClient(
    clientId: string,
    limit: number,
    filters?: { status?: string; category?: string; institution?: string; type?: string; search?: string },
  ): Promise<Request[]> {
    const qb = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .where('request.clientId = :clientId', { clientId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    if (filters?.status) {
      qb.andWhere('request.status = :status', { status: filters.status });
    }
    if (filters?.category?.trim()) {
      qb.andWhere('organisation.sector = :sector', { sector: filters.category.trim().toUpperCase() });
    }
    if (filters?.institution?.trim()) {
      qb.andWhere('(organisation.name ILIKE :institution OR request.organisationName ILIKE :institution)', {
        institution: `%${filters.institution.trim()}%`,
      });
    }
    if (filters?.type?.trim()) {
      qb.andWhere('(request.formName ILIKE :formName)', {
        formName: `%${filters.type.trim()}%`,
      });
    }
    if (filters?.search?.trim()) {
      const searchTerm = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(request.requestNumber ILIKE :search OR request.formName ILIKE :search OR request.organisationName ILIKE :search OR organisation.name ILIKE :search)',
        { search: searchTerm },
      );
    }

    return qb.orderBy('request.submittedAt', 'DESC').take(limit).getMany();
  }

  /**
   * Récupère uniquement les brouillons d'un client
   * Inclut :
   * - Les demandes avec status BROUILLON
   * - Les demandes avec status EN_ATTENTE mais otpVerified = false (OTP non vérifié)
   */
  async findDraftsByClient(clientId: string): Promise<Request[]> {
    return this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.form', 'form')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .where('request.clientId = :clientId', { clientId })
      .andWhere(
        '(request.status = :brouillonStatus OR (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          brouillonStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      )
      .orderBy('request.updatedAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Request> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: ['form', 'client', 'organisation'],
    });

    if (!request) {
      throw new NotFoundException('Demande non trouvée');
    }

    return request;
  }

  /**
   * Détail d'une demande avec documents justificatifs requis (types du formulaire).
   * Utilisé pour la page détail client : requiredDocuments = liste des pièces à fournir (Carte d'identité, etc.).
   */
  async findOneWithRequiredDocuments(id: string): Promise<Request & { requiredDocuments?: Array<{ id?: string; label: string; size?: string; fileUrl?: string }> }> {
    const request = await this.findOne(id);
    const requiredDocuments: Array<{ id?: string; label: string; size?: string; fileUrl?: string }> = [];

    const form = request.form;
    const requiredDocIds = form?.requiredDocuments && Array.isArray(form.requiredDocuments) ? form.requiredDocuments : [];
    if (requiredDocIds.length > 0) {
      const docTypes = await this.documentTypeRepository.find({
        where: { id: In(requiredDocIds) },
      });
      for (const dt of docTypes) {
        requiredDocuments.push({ id: dt.id, label: dt.title || 'Document' });
      }
    }

    return { ...request, requiredDocuments };
  }

  /**
   * Génère un JWT court terme pour l'upload du PDF rempli depuis l'app PDF (cross-origin).
   * Le token est validé par JwtOrUploadTokenGuard sur POST/PUT upload-filled-pdf.
   */
  async getUploadToken(requestId: string, userId: string, userRole: string): Promise<string> {
    const request = await this.findOne(requestId);
    if (userRole !== UserRole.ADMIN && request.clientId !== userId) {
      throw new ForbiddenException('Vous ne pouvez obtenir un token d\'upload que pour vos propres demandes');
    }
    return this.jwtService.sign(
      { requestId, type: 'upload' },
      { expiresIn: this.UPLOAD_TOKEN_EXPIRATION },
    );
  }

  async findByOrganisation(organisationId: string, status?: string, formType?: string): Promise<Request[]> {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.organisation', 'organisation')
      .where('request.organisationId = :organisationId', { organisationId });

    // Exclure les brouillons et les demandes avec OTP non vérifié pour l'organisation
    queryBuilder.andWhere(
      '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
      {
        draftStatus: RequestStatus.BROUILLON,
        enAttenteStatus: RequestStatus.EN_ATTENTE,
      },
    );

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType });
    }

    return queryBuilder.getMany();
  }

  /**
   * Trouve les demandes traitées par un agent (processedBy)
   */
  async findByProcessor(processorId: string, status?: string, formType?: string): Promise<Request[]> {
    const queryBuilder = this.requestRepository.createQueryBuilder('request')
      .where('request.processedBy = :processorId', { processorId });

    // Exclure les brouillons et les demandes avec OTP non vérifié
    queryBuilder.andWhere(
      '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
      {
        draftStatus: RequestStatus.BROUILLON,
        enAttenteStatus: RequestStatus.EN_ATTENTE,
      },
    );

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType });
    }

    return queryBuilder.getMany();
  }

  /**
   * Trouve les demandes pour un superviseur (validées par lui + toutes les demandes de l'organisation)
   */
  async findBySupervisor(supervisorId: string, organisationId: string, status?: string, formType?: string): Promise<Request[]> {
    // Demandes validées par ce superviseur
    const validatedQuery = this.requestRepository.createQueryBuilder('request')
      .where('request.validatedBy = :supervisorId', { supervisorId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    // Toutes les demandes de l'organisation
    const orgQuery = this.requestRepository.createQueryBuilder('request')
      .where('request.organisationId = :organisationId', { organisationId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      );

    // Appliquer les filtres optionnels
    if (status) {
      validatedQuery.andWhere('request.status = :status', { status });
      orgQuery.andWhere('request.status = :status', { status });
    }

    if (formType) {
      validatedQuery.andWhere('request.formType = :formType', { formType });
      orgQuery.andWhere('request.formType = :formType', { formType });
    }

    const [validatedBySupervisor, orgRequests] = await Promise.all([
      validatedQuery.getMany(),
      orgQuery.getMany(),
    ]);

    // Combiner et dédupliquer en utilisant une Map
    const requestsMap = new Map<string, Request>();

    validatedBySupervisor.forEach((r) => {
      requestsMap.set(r.id, r);
    });

    orgRequests.forEach((r) => {
      requestsMap.set(r.id, r);
    });

    return Array.from(requestsMap.values());
  }

  async updateStatus(id: string, status: RequestStatus): Promise<Request> {
    const request = await this.findOne(id);
    request.status = status;

    // Mettre à jour le tracking
    if (status === RequestStatus.EN_COURS) {
      request.tracking.push({
        status: RequestTrackingStatus.EN_COURS,
        date: new Date(),
      });
    } else if (status === RequestStatus.VALIDEE) {
      request.tracking.push({
        status: RequestTrackingStatus.VALIDATION_FINALE,
        date: new Date(),
      });
      request.processedAt = new Date();
    } else if (status === RequestStatus.REJETEE) {
      request.processedAt = new Date();
    }

    request.updatedAt = new Date();
    return await this.requestRepository.save(request);
  }

  async getStatistics(): Promise<RequestStatisticsDto> {
    // Exclure les brouillons et les demandes avec OTP non vérifié pour l'admin
    const [total, pending, inProgress, validated, rejected] = await Promise.all([
      this.requestRepository
        .createQueryBuilder('request')
        .where(
          '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
          {
            draftStatus: RequestStatus.BROUILLON,
            enAttenteStatus: RequestStatus.EN_ATTENTE,
          },
        )
        .getCount(),
      this.requestRepository
        .createQueryBuilder('request')
        .where('request.status = :status', { status: RequestStatus.EN_ATTENTE })
        .andWhere('(request.otpVerified = true OR request.otpVerified IS NOT NULL)')
        .getCount(),
      this.requestRepository.count({ where: { status: RequestStatus.EN_COURS } }),
      this.requestRepository.count({ where: { status: RequestStatus.VALIDEE } }),
      this.requestRepository.count({ where: { status: RequestStatus.REJETEE } }),
    ]);

    return {
      total,
      pending,
      inProgress,
      validated,
      rejected,
      totalChangeThisMonth: '+12%',
      validatedChangeThisMonth: '-3.1%',
      rejectedChangeThisMonth: '+15.3%',
    };
  }

  async getClientStatistics(clientId: string): Promise<RequestStatisticsDto> {
    const [total, pending, inProgress, validated, rejected] = await Promise.all([
      this.requestRepository.count({ where: { clientId } }),
      this.requestRepository.count({ where: { clientId, status: RequestStatus.EN_ATTENTE } }),
      this.requestRepository.count({ where: { clientId, status: RequestStatus.EN_COURS } }),
      this.requestRepository.count({ where: { clientId, status: RequestStatus.VALIDEE } }),
      this.requestRepository.count({ where: { clientId, status: RequestStatus.REJETEE } }),
    ]);

    return {
      total,
      pending,
      inProgress,
      validated,
      rejected,
      totalChangeThisMonth: '+12%',
      validatedChangeThisMonth: '-3.1%',
      rejectedChangeThisMonth: '+15.3%',
    };
  }

  async getOrganisationStatistics(organisationId: string): Promise<RequestStatisticsDto> {
    // Exclure les brouillons et les demandes avec OTP non vérifié pour l'organisation
    const [total, pending, inProgress, validated, rejected] = await Promise.all([
      this.requestRepository
        .createQueryBuilder('request')
        .where('request.organisationId = :organisationId', { organisationId })
        .andWhere(
          '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
          {
            draftStatus: RequestStatus.BROUILLON,
            enAttenteStatus: RequestStatus.EN_ATTENTE,
          },
        )
        .getCount(),
      this.requestRepository
        .createQueryBuilder('request')
        .where('request.organisationId = :organisationId', { organisationId })
        .andWhere('request.status = :status', { status: RequestStatus.EN_ATTENTE })
        .andWhere('(request.otpVerified = true OR request.otpVerified IS NOT NULL)')
        .getCount(),
      this.requestRepository.count({ where: { organisationId, status: RequestStatus.EN_COURS } }),
      this.requestRepository.count({ where: { organisationId, status: RequestStatus.VALIDEE } }),
      this.requestRepository.count({ where: { organisationId, status: RequestStatus.REJETEE } }),
    ]);

    return {
      total,
      pending,
      inProgress,
      validated,
      rejected,
      totalChangeThisMonth: '+12%',
      validatedChangeThisMonth: '-3.1%',
      rejectedChangeThisMonth: '+15.3%',
    };
  }

  async reject(id: string, reason: string, userId: string): Promise<Request> {
    const request = await this.findOne(id);
    request.status = RequestStatus.REJETEE;
    request.processedAt = new Date();

    // Stocker le motif du rejet dans formData ou créer un nouveau champ
    if (!request.formData) {
      request.formData = {};
    }
    request.formData.rejectionReason = reason;
    request.formData.rejectedBy = userId;
    request.formData.rejectedAt = new Date();

    request.updatedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);

    // Envoyer un email de notification au client
    try {
      const client = await this.userRepository.findOne({ where: { id: request.clientId } });
      if (client) {
        await this.emailService.sendRequestRejectedEmail(
          client.email,
          client.name,
          request.requestNumber,
          reason,
          request.formType,
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de rejet:', error);
    }

    return savedRequest;
  }

  async requestAdditionalDocuments(id: string, documents: string[], message: string | undefined, userId: string): Promise<Request> {
    const request = await this.findOne(id);

    // Stocker la demande de documents complémentaires
    if (!request.formData) {
      request.formData = {};
    }
    request.formData.additionalDocumentsRequest = {
      documents,
      message,
      requestedBy: userId,
      requestedAt: new Date(),
    };

    // Mettre le statut en attente si nécessaire
    if (request.status === RequestStatus.EN_COURS) {
      request.status = RequestStatus.EN_ATTENTE;
    }

    request.updatedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);

    // Envoyer un email de notification au client
    try {
      const client = await this.userRepository.findOne({ where: { id: request.clientId } });
      if (client) {
        await this.emailService.sendAdditionalDocumentsRequestEmail(
          client.email,
          client.name,
          request.requestNumber,
          documents,
          message,
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de demande de documents:', error);
    }

    return savedRequest;
  }

  async validate(id: string, userId: string): Promise<Request> {
    const request = await this.findOne(id);
    request.status = RequestStatus.VALIDEE;
    request.processedAt = new Date();

    // Ajouter au tracking
    request.tracking.push({
      status: RequestTrackingStatus.VALIDATION_FINALE,
      date: new Date(),
    });

    // Stocker qui a validé (SUPERVISEUR)
    request.validatedBy = userId;

    // Stocker aussi dans formData pour compatibilité
    if (!request.formData) {
      request.formData = {};
    }
    request.formData.validatedBy = userId;
    request.formData.validatedAt = new Date();

    request.updatedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);

    // Envoyer un email de notification au client
    try {
      const client = await this.userRepository.findOne({ where: { id: request.clientId } });
      if (client) {
        await this.emailService.sendRequestValidatedEmail(
          client.email,
          client.name,
          request.requestNumber,
          request.formType,
        );
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de validation:', error);
    }

    return savedRequest;
  }

  /**
   * Upload du vrai PDF rempli de la demande (provenant d'une app externe).
   * Si label est fourni : ajout/mise à jour dans submittedForms (multi-PDF avec nom).
   * Sinon : comportement historique (un seul submittedForm).
   */
  async uploadFilledPdf(
    requestId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    label?: string,
  ): Promise<Request> {
    const request = await this.findOne(requestId);

    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Le fichier doit être un PDF');
    }

    const maxSize = 20 * 1024 * 1024; // 20 MB
    if (file.size > maxSize) {
      throw new BadRequestException('Le fichier PDF est trop volumineux (max 20 MB)');
    }

    const version =
      request.formSchemaSnapshot?.version ||
      request.form?.version ||
      '1.0';
    const fileName = `request-${request.id}-${Date.now()}-${(label || 'doc').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const minioPath = `requests/${fileName}`;

    await this.minioService.uploadFile(minioPath, file.buffer, 'application/pdf');
    const presignedUrl = await this.minioService.getPresignedUrl(minioPath);

    if (label != null && String(label).trim() !== '') {
      // Multi-PDF : ajouter ou mettre à jour l'entrée dans submittedForms
      if (!request.submittedForms) {
        request.submittedForms = [];
      }
      const existingIndex = request.submittedForms.findIndex((e) => e.label === label);
      const entry = {
        label: String(label).trim(),
        fileName: file.originalname || fileName,
        pdfUrl: presignedUrl,
        version,
      };
      if (existingIndex >= 0) {
        request.submittedForms[existingIndex] = entry;
      } else {
        request.submittedForms.push(entry);
      }
      // Premier PDF de la liste = submittedForm pour compatibilité
      if (request.submittedForms.length > 0) {
        request.submittedForm = {
          pdfUrl: request.submittedForms[0].pdfUrl,
          version: request.submittedForms[0].version || version,
        };
      }
    } else {
      // Comportement historique : un seul PDF
      request.submittedForm = {
        pdfUrl: presignedUrl,
        version,
      };
    }

    request.updatedAt = new Date();
    return this.requestRepository.save(request);
  }

  async startProcess(id: string, userId: string): Promise<Request> {
    const request = await this.findOne(id);

    if (request.status !== RequestStatus.EN_ATTENTE) {
      throw new Error('Seules les demandes en attente peuvent être démarrées');
    }

    request.status = RequestStatus.EN_COURS;
    request.tracking.push({
      status: RequestTrackingStatus.EN_COURS,
      date: new Date(),
    });

    // Stocker qui a démarré/traité le processus (AGENT)
    request.processedBy = userId;

    // Stocker aussi dans formData pour compatibilité
    if (!request.formData) {
      request.formData = {};
    }
    request.formData.startedBy = userId;
    request.formData.startedAt = new Date();

    request.updatedAt = new Date();
    return await this.requestRepository.save(request);
  }

  async remove(id: string): Promise<void> {
    const request = await this.findOne(id);
    await this.requestRepository.remove(request);
  }

  /**
   * Vérifie le code OTP d'une demande et finalise la soumission
   */
  async verifyOtp(requestId: string, otp: string): Promise<Request> {
    const request = await this.findOne(requestId);

    if (request.otpVerified) {
      throw new BadRequestException('Cette demande a déjà été vérifiée');
    }

    if (!request.otpCode || !request.otpExpiry) {
      throw new BadRequestException('Aucun code OTP trouvé pour cette demande');
    }

    if (new Date() > request.otpExpiry) {
      throw new BadRequestException('Le code OTP a expiré. Veuillez en demander un nouveau.');
    }

    if (request.otpCode !== otp) {
      throw new BadRequestException('Code OTP incorrect');
    }

    // Marquer comme vérifié et finaliser la soumission
    request.otpVerified = true;
    request.submittedAt = new Date(); // Date de soumission finale
    request.status = RequestStatus.EN_ATTENTE; // S'assurer que le statut est EN_ATTENTE
    request.updatedAt = new Date();

    return await this.requestRepository.save(request);
  }

  /**
   * Met à jour l'email de vérification et renvoie un nouveau code OTP
   */
  async updateVerificationEmail(requestId: string, newEmail: string): Promise<Request> {
    const request = await this.findOne(requestId);

    if (request.otpVerified) {
      throw new BadRequestException('Cette demande a déjà été vérifiée. Impossible de modifier l\'email.');
    }

    // Générer un nouveau code OTP
    const otpCode = this.generateOtp();
    const otpExpiry = new Date(Date.now() + this.OTP_EXPIRATION);

    request.verificationEmail = newEmail;
    request.otpCode = otpCode;
    request.otpExpiry = otpExpiry;
    request.updatedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);

    // Envoyer le nouveau code OTP par email
    try {
      await this.emailService.sendRequestOtpEmail(
        newEmail,
        otpCode,
        request.requestNumber,
        request.clientName,
      );
    } catch (error) {
      console.error(`Erreur lors de l'envoi de l'OTP par email à ${newEmail}:`, error);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }

    // Envoyer l'OTP par SMS si le client a un numéro de téléphone
    const client = await this.userRepository.findOne({ where: { id: request.clientId } });
    if (client?.phone) {
      try {
        await this.smsService.sendOtpSms(
          client.phone,
          otpCode,
          request.requestNumber,
        );
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'OTP par SMS:`, error);
      }
    }

    return savedRequest;
  }

  /**
   * Renvoie le code OTP pour une demande
   */
  async resendOtp(requestId: string): Promise<Request> {
    const request = await this.findOne(requestId);

    if (request.otpVerified) {
      throw new BadRequestException('Cette demande a déjà été vérifiée. Aucun code OTP nécessaire.');
    }

    if (!request.verificationEmail) {
      throw new BadRequestException('Aucun email de vérification trouvé pour cette demande');
    }

    // Générer un nouveau code OTP
    const otpCode = this.generateOtp();
    const otpExpiry = new Date(Date.now() + this.OTP_EXPIRATION);

    request.otpCode = otpCode;
    request.otpExpiry = otpExpiry;
    request.updatedAt = new Date();

    const savedRequest = await this.requestRepository.save(request);

    // Envoyer le nouveau code OTP par email
    try {
      await this.emailService.sendRequestOtpEmail(
        request.verificationEmail,
        otpCode,
        request.requestNumber,
        request.clientName,
      );
    } catch (error) {
      console.error(`Erreur lors de l'envoi de l'OTP par email à ${request.verificationEmail}:`, error);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }

    // Envoyer l'OTP par SMS si le client a un numéro de téléphone
    const client = await this.userRepository.findOne({ where: { id: request.clientId } });
    if (client?.phone) {
      try {
        await this.smsService.sendOtpSms(
          client.phone,
          otpCode,
          request.requestNumber,
        );
      } catch (error) {
        console.error(`Erreur lors de l'envoi de l'OTP par SMS:`, error);
      }
    }

    return savedRequest;
  }
}


import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { Organisation } from './entities/organisation.entity';
import { Sector as SectorEntity } from '../settings/entities/sector.entity';
import { Sector } from './dto/create-organisation.dto';
import { User } from '../auth/entities/user.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { Form, FormStatus } from '../forms/entities/form.entity';
import { UserDocument, DocumentStatus } from '../users/entities/user-document.entity';
import { Verification, VerificationStatus } from '../verifications/entities/verification.entity';
import { UserRole, OrganisationRole, UserType } from '../auth/dto/register.dto';
import { EmailService } from '../common/services/email.service';
import { NotificationDto, NotificationType, NotificationSeverity } from '../users/dto/notification.dto';

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger(OrganisationsService.name);
  private readonly logosDir = path.join(process.cwd(), 'uploads', 'logos');
  private readonly maxLogoSize = 5 * 1024 * 1024; // 5 MB
  private readonly allowedLogoTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  constructor(
    @InjectRepository(Organisation)
    private organisationRepository: Repository<Organisation>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(UserDocument)
    private userDocumentRepository: Repository<UserDocument>,
    @InjectRepository(Verification)
    private verificationRepository: Repository<Verification>,
    @InjectRepository(SectorEntity)
    private sectorRepository: Repository<SectorEntity>,
    private emailService: EmailService,
  ) {
    // Créer le dossier uploads/logos s'il n'existe pas
    if (!fs.existsSync(this.logosDir)) {
      fs.mkdirSync(this.logosDir, { recursive: true });
      this.logger.log(`Dossier logos créé : ${this.logosDir}`);
    }
  }

  /**
   * Sauvegarde le logo d'une organisation dans un dossier
   */
  async saveLogo(logo: { buffer?: Buffer; originalname?: string; mimetype?: string; size?: number }): Promise<string> {
    if (!logo || !Buffer.isBuffer(logo.buffer)) {
      throw new BadRequestException(
        'Fichier logo invalide. Envoyez le formulaire en multipart/form-data avec le champ "logo" contenant une image.',
      );
    }

    // Vérifier le type de fichier
    if (!logo.mimetype || !this.allowedLogoTypes.includes(logo.mimetype)) {
      throw new BadRequestException(
        'Type de fichier non autorisé. Formats acceptés : JPG, PNG, WEBP',
      );
    }

    // Vérifier la taille du fichier
    if (logo.size == null || logo.size > this.maxLogoSize) {
      throw new BadRequestException('Fichier trop volumineux. Taille maximale : 5 MB');
    }

    // S'assurer que le dossier existe et est accessible
    try {
      if (!fs.existsSync(this.logosDir)) {
        fs.mkdirSync(this.logosDir, { recursive: true });
        this.logger.log(`Dossier logos créé : ${this.logosDir}`);
      }
    } catch (dirError: any) {
      this.logger.error(`Impossible de créer le dossier logos : ${dirError.message}`);
      throw new BadRequestException(
        `Impossible d'accéder au dossier de stockage : ${dirError.code === 'EACCES' ? 'permissions insuffisantes' : dirError.message}`,
      );
    }

    const fileExtension = path.extname(logo.originalname || '') || '.jpg';
    const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
    const filePath = path.join(this.logosDir, fileName);

    try {
      fs.writeFileSync(filePath, logo.buffer);
      this.logger.log(`Logo sauvegardé : ${filePath}`);
      return `logos/${fileName}`;
    } catch (error: any) {
      this.logger.error(`Erreur lors de la sauvegarde du logo : ${error.message}`, error.stack);
      const hint = error.code === 'EACCES'
        ? ' Vérifiez les permissions du dossier uploads sur le serveur.'
        : error.code === 'ENOENT'
          ? ' Le dossier uploads/logos n\'existe pas ou n\'est pas accessible.'
          : '';
      throw new BadRequestException(`Erreur lors de la sauvegarde du logo.${hint}`);
    }
  }

  /**
   * Obtient les options nécessaires pour créer une organisation
   */
  async getCreateOptions() {
    const sectors = await this.sectorRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    return {
      sectors: sectors.map(sector => ({
        id: sector.id,
        name: sector.name,
        description: sector.description,
      })),
    };
  }

  async create(createOrganisationDto: CreateOrganisationDto): Promise<{
    organisation: Organisation;
    adminUser?: User;
    temporaryPassword?: string;
  }> {
    // Vérifier que le secteur existe dans la base de données
    const sector = await this.sectorRepository.findOne({
      where: { id: createOrganisationDto.sectorId, isActive: true },
    });

    if (!sector) {
      throw new NotFoundException('Secteur non trouvé ou inactif');
    }

    // Mapper le nom du secteur vers l'enum Sector pour la compatibilité avec l'entité
    const sectorEnumMap: { [key: string]: Sector } = {
      'Banque': Sector.BANQUE,
      'Notaire': Sector.NOTAIRE,
      'Assurance': Sector.ASSURANCE,
      'Huissiers': Sector.HUISSIER,
    };

    const sectorEnum = sectorEnumMap[sector.name] || sector.name.toUpperCase().replace(/\s+/g, '_') as Sector;

    // Vérifier si l'email existe déjà (seulement si adminEmail est fourni)
    if (createOrganisationDto.adminEmail) {
      // Vérifier si l'email existe déjà dans les organisations
      const existingOrg = await this.organisationRepository.findOne({
        where: { adminEmail: createOrganisationDto.adminEmail },
      });
      if (existingOrg) {
        throw new ConflictException('Cet email est déjà utilisé pour une organisation');
      }

      // Vérifier si l'email existe déjà dans les utilisateurs
      const existingUser = await this.userRepository.findOne({
        where: { email: createOrganisationDto.adminEmail },
      });
      if (existingUser) {
        throw new ConflictException('Cet email est déjà utilisé par un utilisateur');
      }
    }

    // Créer l'organisation avec le secteur depuis l'enum
    const newOrg = this.organisationRepository.create({
      name: createOrganisationDto.name,
      sector: sectorEnum,
      adminEmail: createOrganisationDto.adminEmail,
      phone: createOrganisationDto.phone,
      logo: createOrganisationDto.logo,
      isActive: true,
      registrationDate: new Date(),
    });

    const savedOrg = await this.organisationRepository.save(newOrg);

    // Créer l'utilisateur administrateur seulement si adminEmail est fourni
    let savedAdminUser: User | undefined;
    let temporaryPassword: string | undefined;

    if (createOrganisationDto.adminEmail) {
      // Utiliser le mot de passe fourni par l'admin ou générer un mot de passe temporaire sécurisé
      temporaryPassword = createOrganisationDto.adminPassword || this.generateTemporaryPassword();
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

      // Mapper le secteur de l'organisation vers le type utilisateur
      // Sector (BANQUE, NOTAIRE, ASSURANCE, HUISSIER) -> UserType (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)
      // Les valeurs sont identiques, donc on peut utiliser directement
      const userType = savedOrg.sector as unknown as UserType;

      // Créer l'utilisateur administrateur de l'organisation
      const adminUser = this.userRepository.create({
        name: `Admin ${savedOrg.name}`, // Nom par défaut, peut être modifié plus tard
        email: createOrganisationDto.adminEmail,
        password: hashedPassword,
        phone: createOrganisationDto.phone,
        role: UserRole.ORGANISATION,
        type: userType,
        organisationId: savedOrg.id,
        organisationRole: OrganisationRole.ADMINISTRATION, // L'admin de l'organisation a le rôle ADMINISTRATION
        isActive: true,
        isEmailVerified: false,
      });

      savedAdminUser = await this.userRepository.save(adminUser);

      // Envoyer un email avec les détails de connexion à l'administrateur
      try {
        await this.emailService.sendOrganisationAdminWelcomeEmail(
          savedAdminUser.email,
          savedAdminUser.name,
          savedOrg.name,
          sector.name, // Utiliser le nom du secteur depuis la base de données
          temporaryPassword,
        );
      } catch (error) {
        this.logger.error(`Erreur lors de l'envoi de l'email de bienvenue à ${savedAdminUser.email}:`, error);
        // Ne pas faire échouer la création si l'email échoue
      }
    }

    return {
      organisation: savedOrg,
      adminUser: savedAdminUser,
      temporaryPassword: temporaryPassword, // Retourné dans la réponse API seulement si un utilisateur a été créé
    };
  }

  /**
   * Génère un mot de passe temporaire sécurisé
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    // S'assurer qu'il y a au moins une majuscule, une minuscule, un chiffre et un caractère spécial
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    // Remplir le reste avec des caractères aléatoires
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    // Mélanger les caractères
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  async findAll(sector?: string, isActive?: boolean, search?: string): Promise<Organisation[]> {
    const queryBuilder = this.organisationRepository.createQueryBuilder('organisation');

    if (sector) {
      queryBuilder.where('organisation.sector = :sector', { sector });
    }

    if (isActive !== undefined) {
      if (sector) {
        queryBuilder.andWhere('organisation.isActive = :isActive', { isActive });
      } else {
        queryBuilder.where('organisation.isActive = :isActive', { isActive });
      }
    }

    if (search) {
      const searchCondition = '(organisation.name ILIKE :search OR organisation.adminEmail ILIKE :search)';
      if (sector || isActive !== undefined) {
        queryBuilder.andWhere(searchCondition, { search: `%${search}%` });
      } else {
        queryBuilder.where(searchCondition, { search: `%${search}%` });
      }
    }

    return await queryBuilder
      .select([
        'organisation.id',
        'organisation.name',
        'organisation.sector',
        'organisation.adminEmail',
        'organisation.phone',
        'organisation.logo',
        'organisation.isActive',
        'organisation.registrationDate',
      ])
      .orderBy('organisation.name', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Organisation> {
    const org = await this.organisationRepository.findOne({
      where: { id },
      relations: ['users', 'forms', 'requests'],
    });
    if (!org) {
      throw new NotFoundException('Organisation non trouvée');
    }
    return org;
  }

  /**
   * Retourne le fichier logo d'une organisation (pour affichage via API, évite CORS).
   */
  async getLogoFile(organisationId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const org = await this.organisationRepository.findOne({
      where: { id: organisationId },
      select: ['id', 'logo'],
    });
    if (!org || !org.logo?.trim()) {
      throw new NotFoundException('Logo non trouvé');
    }
    const fileName = path.basename(org.logo);
    const filePath = path.join(this.logosDir, fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Fichier logo introuvable');
    }
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';
    return { buffer, mimeType };
  }

  async update(id: string, updateOrganisationDto: UpdateOrganisationDto): Promise<Organisation> {
    const organisation = await this.findOne(id);

    // Si un nouveau logo est fourni, supprimer l'ancien logo s'il existe
    if (updateOrganisationDto.logo && organisation.logo && organisation.logo.startsWith('logos/')) {
      const oldLogoPath = path.join(this.logosDir, path.basename(organisation.logo));
      try {
        if (fs.existsSync(oldLogoPath)) {
          fs.unlinkSync(oldLogoPath);
          this.logger.log(`Ancien logo supprimé : ${oldLogoPath}`);
        }
      } catch (error) {
        this.logger.warn(`Impossible de supprimer l'ancien logo : ${error.message}`);
      }
    }

    Object.assign(organisation, updateOrganisationDto);
    return await this.organisationRepository.save(organisation);
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id);
    await this.organisationRepository.remove(org);
  }

  async activate(id: string): Promise<Organisation> {
    const org = await this.findOne(id);
    org.isActive = true;
    const savedOrg = await this.organisationRepository.save(org);

    // Réactiver tous les employés de cette organisation
    const employees = await this.userRepository.find({
      where: {
        organisationId: id,
        role: UserRole.ORGANISATION,
      },
    });

    if (employees.length > 0) {
      employees.forEach((employee) => {
        employee.isActive = true;
      });
      await this.userRepository.save(employees);
      this.logger.log(`Organisation ${org.name} activée : ${employees.length} employé(s) réactivé(s)`);
    }

    return savedOrg;
  }

  async deactivate(id: string): Promise<Organisation> {
    const org = await this.findOne(id);
    org.isActive = false;
    const savedOrg = await this.organisationRepository.save(org);

    // Désactiver tous les employés de cette organisation (administrateur, superviseur, agent)
    const employees = await this.userRepository.find({
      where: {
        organisationId: id,
        role: UserRole.ORGANISATION,
      },
    });

    if (employees.length > 0) {
      employees.forEach((employee) => {
        employee.isActive = false;
      });
      await this.userRepository.save(employees);
      this.logger.log(`Organisation ${org.name} désactivée : ${employees.length} employé(s) désactivé(s)`);
    }

    return savedOrg;
  }

  async getRequests(
    id: string,
    status?: RequestStatus,
    formType?: string,
  ): Promise<Request[]> {
    const queryBuilder = this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.form', 'form')
      .where('request.organisationId = :id', { id });

    if (status) {
      queryBuilder.andWhere('request.status = :status', { status });
    }

    if (formType) {
      queryBuilder.andWhere('request.formType = :formType', { formType });
    }

    return await queryBuilder.orderBy('request.createdAt', 'DESC').getMany();
  }

  async getUsers(id: string, status?: string, role?: string): Promise<User[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.organisationId = :id', { id })
      // Filtrer uniquement les employés (ORGANISATION), pas les clients (CLIENT)
      .andWhere('user.role = :orgRole', { orgRole: UserRole.ORGANISATION });

    if (status === 'active') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
    } else if (status === 'inactive') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
    }

    if (role) {
      queryBuilder.andWhere('user.organisationRole = :role', { role });
    }

    return await queryBuilder
      .select([
        'user.id',
        'user.name',
        'user.firstName',
        'user.lastName',
        'user.email',
        'user.phone',
        'user.role',
        'user.organisationRole',
        'user.isActive',
        'user.lastLogin',
        'user.createdAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }

  async getForms(id: string, status?: FormStatus, sector?: string): Promise<Form[]> {
    const queryBuilder = this.formRepository
      .createQueryBuilder('form')
      .where('form.organisationId = :id', { id });

    if (status) {
      queryBuilder.andWhere('form.status = :status', { status });
    }

    if (sector) {
      queryBuilder.andWhere('form.sector = :sector', { sector });
    }

    return await queryBuilder.orderBy('form.createdAt', 'DESC').getMany();
  }

  async getStatistics(id: string) {
    // Exclure les brouillons et les demandes avec OTP non vérifié
    const [totalRequests, pendingRequests, inProgressRequests, validatedRequests, rejectedRequests] =
      await Promise.all([
        this.requestRepository
          .createQueryBuilder('request')
          .where('request.organisationId = :id', { id })
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
          .where('request.organisationId = :id', { id })
          .andWhere('request.status = :status', { status: RequestStatus.EN_ATTENTE })
          .andWhere('(request.otpVerified = true OR request.otpVerified IS NOT NULL)')
          .getCount(),
        this.requestRepository.count({
          where: { organisationId: id, status: RequestStatus.EN_COURS },
        }),
        this.requestRepository.count({
          where: { organisationId: id, status: RequestStatus.VALIDEE },
        }),
        this.requestRepository.count({
          where: { organisationId: id, status: RequestStatus.REJETEE },
        }),
      ]);

    const [totalUsers, activeUsers] = await Promise.all([
      this.userRepository.count({ where: { organisationId: id } }),
      this.userRepository.count({ where: { organisationId: id, isActive: true } }),
    ]);

    const [totalForms, onlineForms] = await Promise.all([
      this.formRepository.count({ where: { organisationId: id } }),
      this.formRepository.count({
        where: { organisationId: id, status: FormStatus.ONLINE },
      }),
    ]);

    return {
      requests: {
        total: totalRequests,
        pending: pendingRequests,
        inProgress: inProgressRequests,
        validated: validatedRequests,
        rejected: rejectedRequests,
        totalChangeThisMonth: '+12%',
        validatedChangeThisMonth: '-3.1%',
        rejectedChangeThisMonth: '+15.3%',
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
      },
      forms: {
        total: totalForms,
        online: onlineForms,
        offline: totalForms - onlineForms,
      },
    };
  }

  /**
   * Retourne les demandes récentes de l'organisation (limitées)
   */
  async getRecentRequests(organisationId: string, limit: number = 5): Promise<any[]> {
    const requests = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .leftJoinAndSelect('request.form', 'form')
      .where('request.organisationId = :organisationId', { organisationId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      )
      .orderBy('request.submittedAt', 'DESC')
      .addOrderBy('request.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return requests.map((req) => ({
      id: req.id,
      requestNumber: req.requestNumber,
      client: req.clientName,
      clientId: req.clientId,
      type: req.formName || 'N/A',
      formType: req.formType,
      receivedAt: req.submittedAt || req.createdAt,
      status: req.status,
      timeAgo: this.getTimeAgo(req.submittedAt || req.createdAt),
    }));
  }

  /**
   * Retourne les statistiques des demandes par type (pour le graphique)
   */
  async getRequestsByType(organisationId: string): Promise<any[]> {
    const requests = await this.requestRepository
      .createQueryBuilder('request')
      .select('request.formType', 'formType')
      .addSelect('COUNT(request.id)', 'count')
      .where('request.organisationId = :organisationId', { organisationId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      )
      .groupBy('request.formType')
      .getRawMany();

    // Mapper les types de formulaires vers des labels plus lisibles
    const typeLabels: { [key: string]: string } = {
      TRANSACTION: 'Transfer',
      DEMANDE: 'KYC',
      LOAN: 'Prêt',
      DECLARATION: 'Déclaration',
      RESILIATION: 'Résiliation',
    };

    return requests.map((item) => ({
      type: item.formType || 'Autres',
      label: typeLabels[item.formType] || item.formType || 'Autres',
      count: parseInt(item.count, 10),
    }));
  }

  /**
   * Retourne l'activité récente de l'organisation (basée sur les demandes)
   */
  async getRecentActivity(organisationId: string, limit: number = 10): Promise<any[]> {
    const requests = await this.requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.client', 'client')
      .where('request.organisationId = :organisationId', { organisationId })
      .andWhere(
        '(request.status != :draftStatus AND NOT (request.status = :enAttenteStatus AND (request.otpVerified = false OR request.otpVerified IS NULL)))',
        {
          draftStatus: RequestStatus.BROUILLON,
          enAttenteStatus: RequestStatus.EN_ATTENTE,
        },
      )
      .orderBy('request.updatedAt', 'DESC')
      .limit(limit)
      .getMany();

    const activities: any[] = [];

    requests.forEach((req) => {
      // Activité de soumission
      if (req.submittedAt) {
        activities.push({
          id: `submitted-${req.id}`,
          type: 'REQUEST_SUBMITTED',
          icon: 'check',
          color: 'green',
          title: 'Demande de transfert soumise',
          description: `Demande ${req.requestNumber} soumise par ${req.clientName}`,
          date: req.submittedAt,
          timeAgo: this.getTimeAgo(req.submittedAt),
        });
      }

      // Activité de validation
      if (req.status === RequestStatus.VALIDEE && req.processedAt) {
        activities.push({
          id: `validated-${req.id}`,
          type: 'REQUEST_VALIDATED',
          icon: 'check',
          color: 'green',
          title: 'Demande validée',
          description: `Demande ${req.requestNumber} validée`,
          date: req.processedAt,
          timeAgo: this.getTimeAgo(req.processedAt),
        });
      }

      // Activité de traitement
      if (req.status === RequestStatus.EN_COURS && req.processedAt) {
        activities.push({
          id: `processing-${req.id}`,
          type: 'REQUEST_PROCESSING',
          icon: 'clock',
          color: 'blue',
          title: 'Demande en cours de traitement',
          description: `Demande ${req.requestNumber} en cours`,
          date: req.processedAt,
          timeAgo: this.getTimeAgo(req.processedAt),
        });
      }
    });

    // Trier par date (plus récent en premier)
    activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return activities.slice(0, limit);
  }

  /**
   * Notifications pour l'organisation
   */
  async getOrganisationNotifications(organisationId: string, unreadOnly?: boolean): Promise<NotificationDto[]> {
    const notifications: NotificationDto[] = [];

    // 1. Demandes en attente de traitement pour cette organisation
    const pendingRequests = await this.requestRepository.find({
      where: {
        organisationId,
        status: RequestStatus.EN_ATTENTE,
      },
      relations: ['client', 'form'],
      order: { createdAt: 'ASC' },
      take: 10,
    });

    pendingRequests.forEach((request) => {
      const hoursSinceCreation = Math.floor(
        (Date.now() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60),
      );

      notifications.push({
        id: `req-pending-${request.id}`,
        type: NotificationType.VERIFICATION_PENDING,
        severity: hoursSinceCreation >= 24 ? NotificationSeverity.WARNING : NotificationSeverity.INFO,
        title: 'Demande en attente de traitement',
        message: `La demande ${request.requestNumber} de ${request.clientName} est en attente depuis ${hoursSinceCreation} heure${hoursSinceCreation > 1 ? 's' : ''}`,
        date: request.createdAt,
        timeAgo: this.getTimeAgo(request.createdAt),
        relatedId: request.id,
        relatedType: 'request',
        isRead: false,
      });
    });

    // 2. Demandes validées récemment (dernières 7 jours)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const validatedRequests = await this.requestRepository.find({
      where: {
        organisationId,
        status: RequestStatus.VALIDEE,
      },
      relations: ['client'],
      order: { processedAt: 'DESC' },
      take: 5,
    });

    validatedRequests
      .filter((req) => req.processedAt && new Date(req.processedAt) >= sevenDaysAgo)
      .forEach((request) => {
        notifications.push({
          id: `req-validated-${request.id}`,
          type: NotificationType.REQUEST_VALIDATED,
          severity: NotificationSeverity.SUCCESS,
          title: 'Demande validée',
          message: `La demande ${request.requestNumber} de ${request.clientName} a été validée avec succès`,
          date: request.processedAt!,
          timeAgo: this.getTimeAgo(request.processedAt!),
          relatedId: request.id,
          relatedType: 'request',
          isRead: false,
        });
      });

    // 3. Documents en attente de vérification pour les clients de cette organisation
    // Récupérer les clients qui ont des demandes avec cette organisation
    const orgRequests = await this.requestRepository.find({
      where: { organisationId },
      select: ['clientId'],
    });
    const clientIds = [...new Set(orgRequests.map((r) => r.clientId))];

    if (clientIds.length > 0) {
      const pendingDocuments = await this.userDocumentRepository.find({
        where: {
          userId: clientIds as any,
          status: DocumentStatus.EN_VERIFICATION,
        },
        relations: ['user'],
        order: { createdAt: 'ASC' },
        take: 10,
      });

      pendingDocuments.forEach((doc) => {
        const hoursSinceCreation = Math.floor(
          (Date.now() - new Date(doc.createdAt).getTime()) / (1000 * 60 * 60),
        );

        if (hoursSinceCreation >= 24) {
          notifications.push({
            id: `doc-pending-${doc.id}`,
            type: NotificationType.VERIFICATION_PENDING,
            severity: NotificationSeverity.WARNING,
            title: 'Document en attente de vérification',
            message: `Le document ${doc.type} de ${doc.user.name} est en attente depuis ${Math.floor(hoursSinceCreation / 24)} jour${Math.floor(hoursSinceCreation / 24) > 1 ? 's' : ''}`,
            date: doc.createdAt,
            timeAgo: this.getTimeAgo(doc.createdAt),
            relatedId: doc.id,
            relatedType: 'document',
            isRead: false,
          });
        }
      });
    }

    // 4. Documents expirant bientôt pour les clients de cette organisation
    const fifteenDaysFromNow = new Date();
    fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

    if (clientIds.length > 0) {
      const expiringDocuments = await this.userDocumentRepository.find({
        where: {
          userId: clientIds as any,
          expirationDate: LessThanOrEqual(fifteenDaysFromNow),
          status: DocumentStatus.VALIDE,
        },
        relations: ['user'],
        order: { expirationDate: 'ASC' },
        take: 10,
      });

      expiringDocuments.forEach((doc) => {
        if (doc.expirationDate) {
          const daysUntilExpiration = Math.floor(
            (new Date(doc.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
          );

          if (daysUntilExpiration >= 0 && daysUntilExpiration <= 15) {
            notifications.push({
              id: `doc-expiring-${doc.id}`,
              type: NotificationType.DOCUMENT_EXPIRING,
              severity: daysUntilExpiration <= 7 ? NotificationSeverity.ERROR : NotificationSeverity.WARNING,
              title: 'Document expirant bientôt',
              message: `Le document ${doc.type} de ${doc.user.name} expire dans ${daysUntilExpiration} jour${daysUntilExpiration > 1 ? 's' : ''}`,
              date: new Date(),
              timeAgo: 'Aujourd\'hui',
              relatedId: doc.id,
              relatedType: 'document',
              isRead: false,
            });
          }
        }
      });
    }

    // Trier par date (plus récent en premier)
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filtrer les non lues si demandé
    if (unreadOnly) {
      return notifications.filter((n) => !n.isRead);
    }

    return notifications;
  }

  /**
   * Calcule le temps écoulé depuis une date
   */
  private getTimeAgo(date: Date | string): string {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Il y a quelques secondes';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} minute${Math.floor(diffInSeconds / 60) > 1 ? 's' : ''}`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} heure${Math.floor(diffInSeconds / 3600) > 1 ? 's' : ''}`;
    if (diffInSeconds < 604800) return `Il y a ${Math.floor(diffInSeconds / 86400)} jour${Math.floor(diffInSeconds / 86400) > 1 ? 's' : ''}`;
    if (diffInSeconds < 2592000) return `Il y a ${Math.floor(diffInSeconds / 604800)} semaine${Math.floor(diffInSeconds / 604800) > 1 ? 's' : ''}`;
    return `Il y a ${Math.floor(diffInSeconds / 2592000)} mois`;
  }
}




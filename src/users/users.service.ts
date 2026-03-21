import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateOrganisationUserDto } from './dto/create-organisation-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '../auth/entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { UserRole, UserType, OrganisationRole } from '../auth/dto/register.dto';
import { MinioService } from '../storage/minio.service';
import { Role } from '../settings/entities/role.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly profilesDir = path.join(process.cwd(), 'uploads', 'profiles');
  private readonly maxProfilePictureSize = 5 * 1024 * 1024; // 5 MB
  private readonly allowedProfilePictureTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationRepository: Repository<Organisation>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private minioService: MinioService,
  ) {
    // Créer le dossier uploads/profiles s'il n'existe pas
    if (!fs.existsSync(this.profilesDir)) {
      fs.mkdirSync(this.profilesDir, { recursive: true });
      this.logger.log(`Dossier profiles créé : ${this.profilesDir}`);
    }
  }

  /**
   * Sauvegarde la photo de profil d'un utilisateur dans un dossier
   */
  async saveProfilePicture(
    userId: string,
    profilePicture: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ): Promise<string> {
    // Vérifier le type de fichier
    if (!this.allowedProfilePictureTypes.includes(profilePicture.mimetype)) {
      throw new BadRequestException(
        'Type de fichier non autorisé. Formats acceptés : JPG, PNG, WEBP',
      );
    }

    // Vérifier la taille du fichier
    if (profilePicture.size > this.maxProfilePictureSize) {
      throw new BadRequestException('Fichier trop volumineux. Taille maximale : 5 MB');
    }

    // Générer un nom de fichier unique
    const fileExtension = path.extname(profilePicture.originalname) || '.jpg';
    const fileName = `profile-${userId}-${Date.now()}${fileExtension}`;
    const filePath = path.join(this.profilesDir, fileName);

    // Sauvegarder le fichier
    try {
      fs.writeFileSync(filePath, profilePicture.buffer);
      this.logger.log(`Photo de profil sauvegardée : ${filePath}`);
      // Upload aussi sur MinIO (pour les environnements sans stockage disque persistant)
      try {
        await this.minioService.uploadFile(`profiles/${fileName}`, profilePicture.buffer, profilePicture.mimetype);
      } catch (err) {
        this.logger.warn(`Upload MinIO photo de profil échoué: ${err?.message || err}`);
      }
      
      // Retourner le chemin relatif pour stockage en base de données
      return `profiles/${fileName}`;
    } catch (error) {
      this.logger.error(`Erreur lors de la sauvegarde de la photo de profil : ${error.message}`);
      throw new BadRequestException('Erreur lors de la sauvegarde de la photo de profil');
    }
  }

  /**
   * Génère un mot de passe temporaire aléatoire
   */
  private generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@$!%*?&';
    let password = '';
    
    // S'assurer qu'il y a au moins une majuscule, une minuscule, un chiffre et un caractère spécial
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '@$!%*?&'[Math.floor(Math.random() * 7)];
    
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Mélanger le mot de passe
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  private extractRequester(currentUser: any): { id: string | null; role: UserRole | null; organisationId: string | null } {
    const id = currentUser?.userId ?? currentUser?.id ?? currentUser?.sub ?? null;
    const role = (currentUser?.role as UserRole) ?? null;
    const organisationId = currentUser?.organisationId ?? null;
    return { id, role, organisationId };
  }

  private async assertOrganisationRoleIsActive(organisationRole: string): Promise<void> {
    const normalized = (organisationRole || '').trim().toUpperCase();
    if (!normalized) {
      throw new BadRequestException('Le rôle organisation est obligatoire');
    }
    const exists = await this.roleRepository
      .createQueryBuilder('role')
      .where('UPPER(role.name) = :name', { name: normalized })
      .andWhere('role.isActive = :isActive', { isActive: true })
      .getOne();
    if (!exists) {
      throw new BadRequestException('Rôle organisation invalide ou inactif');
    }
  }

  private assertCanAccessTarget(currentUser: any, target: User): void {
    const requester = this.extractRequester(currentUser);
    if (!requester.id || !requester.role) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    if (requester.role === UserRole.ADMIN) return;

    if (requester.role === UserRole.ORGANISATION) {
      if (!requester.organisationId) {
        throw new ForbiddenException('Compte organisation invalide (organisationId manquant)');
      }
      if (target.role !== UserRole.ORGANISATION || target.organisationId !== requester.organisationId) {
        throw new ForbiddenException('Accès interdit à un utilisateur hors de votre organisation');
      }
      return;
    }

    if (requester.role === UserRole.CLIENT) {
      if (target.id !== requester.id) {
        throw new ForbiddenException('Accès interdit');
      }
      return;
    }

    throw new ForbiddenException('Accès interdit');
  }

  async create(createUserDto: CreateUserDto): Promise<{ user: User; temporaryPassword: string }> {
    const normalizedEmail = (createUserDto.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email invalide');
    }

    // Vérifier si l'email existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // L'admin ne peut créer que des utilisateurs d'organisations
    // Les clients s'inscrivent eux-mêmes via l'endpoint d'inscription
    if (createUserDto.role === UserRole.CLIENT) {
      throw new BadRequestException(
        'L\'admin ne peut pas créer de clients. Les clients s\'inscrivent eux-mêmes via l\'endpoint d\'inscription (/api/auth/register).'
      );
    }

    // L'organisationId est obligatoire pour créer un utilisateur d'organisation
    if (!createUserDto.organisationId) {
      throw new BadRequestException(
        'L\'organisationId est obligatoire. L\'admin ne peut créer que des utilisateurs d\'organisations.'
      );
    }

    // Récupérer l'organisation
    const organisation = await this.organisationRepository.findOne({
      where: { id: createUserDto.organisationId },
    });
    if (!organisation) {
      throw new NotFoundException('Organisation non trouvée');
    }

    // Forcer le rôle ORGANISATION
    const finalRole = UserRole.ORGANISATION;

    // Le type doit correspondre au secteur de l'organisation (automatique)
    // Sector (BANQUE, NOTAIRE, ASSURANCE, HUISSIER) -> UserType (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)
    // Les valeurs sont identiques, donc on peut utiliser directement
    // IGNORER le type fourni par l'utilisateur et utiliser celui de l'organisation
    const finalType = organisation.sector as unknown as UserType;

    // Le rôle organisation est obligatoire (validé dans le DTO)
    const finalOrganisationRole = createUserDto.organisationRole;
    await this.assertOrganisationRoleIsActive(finalOrganisationRole);

    // Générer un mot de passe temporaire
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Construire le nom complet
    // Si name est fourni, l'utiliser
    // Sinon, construire à partir de firstName et lastName
    // Sinon, utiliser l'email comme fallback
    let name = createUserDto.name;
    if (!name) {
      if (createUserDto.firstName && createUserDto.lastName) {
        name = `${createUserDto.firstName} ${createUserDto.lastName}`;
      } else if (createUserDto.firstName) {
        name = createUserDto.firstName;
      } else if (createUserDto.lastName) {
        name = createUserDto.lastName;
      } else {
        name = createUserDto.email.split('@')[0]; // Utiliser la partie avant @ de l'email
      }
    }

    // Créer le nouvel utilisateur
    const newUser = this.userRepository.create({
      name,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      email: normalizedEmail,
      password: hashedPassword,
      phone: createUserDto.phone,
      role: finalRole,
      type: finalType,
      organisationId: createUserDto.organisationId,
      organisationRole: finalOrganisationRole,
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Retourner l'utilisateur sans le mot de passe hashé, mais avec le mot de passe temporaire
    const { password, ...userWithoutPassword } = savedUser;
    return {
      user: userWithoutPassword as User,
      temporaryPassword, // À envoyer par email en production
    };
  }

  /**
   * Créer un utilisateur pour une organisation
   * L'utilisateur est automatiquement lié à l'organisation de l'utilisateur connecté
   */
  async createOrganisationUser(
    createUserDto: CreateOrganisationUserDto,
    organisationId: string,
  ): Promise<{ user: User; temporaryPassword: string }> {
    const normalizedEmail = (createUserDto.email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestException('Email invalide');
    }

    // Vérifier si l'email existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier que l'organisation existe
    await this.assertOrganisationRoleIsActive(createUserDto.organisationRole);

    const organisation = await this.organisationRepository.findOne({
      where: { id: organisationId },
    });
    if (!organisation) {
      throw new NotFoundException('Organisation non trouvée');
    }

    // Générer un mot de passe temporaire
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Mapper le secteur de l'organisation vers le type utilisateur
    // Sector (BANQUE, NOTAIRE, ASSURANCE, HUISSIER) -> UserType (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)
    // Les valeurs sont identiques, donc on peut utiliser directement
    const userType = organisation.sector as any; // Sector et UserType ont les mêmes valeurs

    // Créer le nouvel utilisateur
    // Le rôle est toujours ORGANISATION pour les utilisateurs créés par une organisation
    const newUser = this.userRepository.create({
      name: createUserDto.name,
      email: normalizedEmail,
      password: hashedPassword,
      phone: createUserDto.phone,
      role: UserRole.ORGANISATION, // Toujours ORGANISATION
      type: userType, // Le type correspond au secteur de l'organisation
      organisationId: organisationId, // Automatiquement lié à l'organisation
      organisationRole: createUserDto.organisationRole, // Rôle au niveau organisation (AGENT, SUPERVISEUR, ADMINISTRATION)
      isActive: true,
      isEmailVerified: false,
    });

    const savedUser = await this.userRepository.save(newUser);

    // Retourner l'utilisateur sans le mot de passe hashé
    const { password, ...userWithoutPassword } = savedUser;
    return {
      user: userWithoutPassword as User,
      temporaryPassword, // À envoyer par email en production
    };
  }

  async findAll(status?: string, type?: string, role?: string): Promise<User[]> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (status === 'active') {
      queryBuilder.where('user.isActive = :isActive', { isActive: true });
    } else if (status === 'inactive') {
      queryBuilder.where('user.isActive = :isActive', { isActive: false });
    }

    if (type) {
      queryBuilder.andWhere('user.type = :type', { type });
    }

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
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
        'user.type',
        'user.organisationId',
        'user.organisationRole',
        'user.isActive',
        'user.isEmailVerified',
        'user.lastLogin',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .getMany();
  }

  async findAllForRequester(
    currentUser: any,
    status?: string,
    type?: string,
    role?: string,
    clientEmail?: string,
  ): Promise<User[]> {
    const requester = this.extractRequester(currentUser);
    if (!requester.role) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }
    if (requester.role === UserRole.ADMIN) {
      return this.findAll(status, type, role);
    }
    if (requester.role === UserRole.ORGANISATION) {
      if (!requester.organisationId) {
        throw new ForbiddenException('Compte organisation invalide (organisationId manquant)');
      }
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      if (role === UserRole.CLIENT) {
        queryBuilder.andWhere('user.role = :clientRole', { clientRole: UserRole.CLIENT });
        const emailNorm = (clientEmail ?? '').trim().toLowerCase();
        if (emailNorm) {
          /** Recherche ciblée (ex. initier une demande) : client rattaché à l’org **ou** sans organisationId. */
          queryBuilder.andWhere('LOWER(user.email) = :clientEmailNorm', { clientEmailNorm: emailNorm });
          queryBuilder.andWhere(
            '(user.organisationId = :organisationId OR user.organisationId IS NULL)',
            { organisationId: requester.organisationId },
          );
        } else {
          queryBuilder.andWhere('user.organisationId = :organisationId', { organisationId: requester.organisationId });
        }
      } else {
        queryBuilder.andWhere('user.organisationId = :organisationId', { organisationId: requester.organisationId });
        queryBuilder.andWhere('user.role = :orgMemberRole', { orgMemberRole: UserRole.ORGANISATION });
        if (role && role !== UserRole.ORGANISATION) {
          return [];
        }
      }

      if (status === 'active') queryBuilder.andWhere('user.isActive = :isActive', { isActive: true });
      else if (status === 'inactive') queryBuilder.andWhere('user.isActive = :isActive', { isActive: false });
      if (type) queryBuilder.andWhere('user.type = :type', { type });

      return queryBuilder
        .select([
          'user.id',
          'user.name',
          'user.firstName',
          'user.lastName',
          'user.email',
          'user.phone',
          'user.role',
          'user.type',
          'user.organisationId',
          'user.organisationRole',
          'user.isActive',
          'user.isEmailVerified',
          'user.lastLogin',
          'user.createdAt',
          'user.updatedAt',
        ])
        .orderBy('user.createdAt', 'DESC')
        .getMany();
    }
    throw new ForbiddenException('Accès interdit');
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['organisation'],
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }

  async findOneForRequester(id: string, currentUser: any): Promise<User> {
    const target = await this.userRepository.findOne({
      where: { id },
      relations: ['organisation'],
    });
    if (!target) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    this.assertCanAccessTarget(currentUser, target);
    const { password, ...userWithoutPassword } = target;
    return userWithoutPassword as User;
  }

  async update(id: string, updateUserDto: UpdateUserDto & { profilePicture?: string }): Promise<User> {
    const user = await this.findOne(id);
    
    // Vérifier l'organisation si fournie
    if (updateUserDto.organisationId) {
      const organisation = await this.organisationRepository.findOne({
        where: { id: updateUserDto.organisationId },
      });
      if (!organisation) {
        throw new NotFoundException('Organisation non trouvée');
      }
    }

    // Si un nouveau profilePicture est fourni, supprimer l'ancien s'il existe
    if (updateUserDto.profilePicture && user.profilePicture && user.profilePicture.startsWith('profiles/')) {
      const oldProfilePath = path.join(this.profilesDir, path.basename(user.profilePicture));
      try {
        if (fs.existsSync(oldProfilePath)) {
          fs.unlinkSync(oldProfilePath);
          this.logger.log(`Ancienne photo de profil supprimée : ${oldProfilePath}`);
        }
      } catch (error) {
        this.logger.warn(`Impossible de supprimer l'ancienne photo de profil : ${error.message}`);
      }
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  /**
   * Met à jour le profil d'un utilisateur (pour tous les utilisateurs)
   */
  async updateProfile(userId: string, updateDto: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    address?: string;
    maritalStatus?: string;
    profilePicture?: string;
  }): Promise<User> {
    const user = await this.findOne(userId);

    // Si un nouveau profilePicture est fourni, supprimer l'ancien s'il existe
    if (updateDto.profilePicture && user.profilePicture && user.profilePicture.startsWith('profiles/')) {
      const oldProfilePath = path.join(this.profilesDir, path.basename(user.profilePicture));
      try {
        if (fs.existsSync(oldProfilePath)) {
          fs.unlinkSync(oldProfilePath);
          this.logger.log(`Ancienne photo de profil supprimée : ${oldProfilePath}`);
        }
      } catch (error) {
        this.logger.warn(`Impossible de supprimer l'ancienne photo de profil : ${error.message}`);
      }
    }

    // Mettre à jour les champs fournis
    if (updateDto.firstName !== undefined) {
      user.firstName = updateDto.firstName;
    }
    if (updateDto.lastName !== undefined) {
      user.lastName = updateDto.lastName;
    }
    if (updateDto.phone !== undefined) {
      user.phone = updateDto.phone;
    }
    if (updateDto.email !== undefined) {
      const normalizedEmail = (updateDto.email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new BadRequestException('Email invalide');
      }
      // Vérifier que l'email n'est pas déjà utilisé
      const existingUser = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingUser && existingUser.id !== userId) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      user.email = normalizedEmail;
    }
    if (updateDto.address !== undefined) {
      user.address = updateDto.address;
    }
    if (updateDto.maritalStatus !== undefined) {
      user.maritalStatus = updateDto.maritalStatus;
    }
    if (updateDto.profilePicture !== undefined) {
      user.profilePicture = updateDto.profilePicture;
    }

    // Mettre à jour le nom complet si firstName ou lastName change
    if (updateDto.firstName || updateDto.lastName) {
      if (user.firstName && user.lastName) {
        user.name = `${user.firstName} ${user.lastName}`;
      } else if (user.firstName) {
        user.name = user.firstName;
      } else if (user.lastName) {
        user.name = user.lastName;
      }
    }

    const updatedUser = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepository.remove(user);
  }

  async activate(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    user.isActive = true;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  async activateForRequester(id: string, currentUser: any): Promise<User> {
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    this.assertCanAccessTarget(currentUser, target);
    return this.activate(id);
  }

  async deactivate(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    user.isActive = false;
    const updatedUser = await this.userRepository.save(user);
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword as User;
  }

  async deactivateForRequester(id: string, currentUser: any): Promise<User> {
    const target = await this.userRepository.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    this.assertCanAccessTarget(currentUser, target);
    return this.deactivate(id);
  }

  async getStatistics() {
    const [total, clients, active, organisations] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.CLIENT } }),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { role: UserRole.ORGANISATION } }),
    ]);

    return {
      total,
      clients,
      organisations,
      active,
      inactive: total - active,
    };
  }

  async getStatisticsForRequester(currentUser: any) {
    const requester = this.extractRequester(currentUser);
    if (!requester.role) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }
    if (requester.role === UserRole.ADMIN) {
      return this.getStatistics();
    }
    if (requester.role === UserRole.ORGANISATION) {
      if (!requester.organisationId) {
        throw new ForbiddenException('Compte organisation invalide (organisationId manquant)');
      }
      const [total, active] = await Promise.all([
        this.userRepository.count({
          where: { role: UserRole.ORGANISATION, organisationId: requester.organisationId },
        }),
        this.userRepository.count({
          where: { role: UserRole.ORGANISATION, organisationId: requester.organisationId, isActive: true },
        }),
      ]);

      return {
        total,
        clients: 0,
        organisations: total,
        active,
        inactive: total - active,
      };
    }
    throw new ForbiddenException('Accès interdit');
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur (admin uniquement)
   * Génère un nouveau mot de passe temporaire et l'envoie par email
   */
  async resetUserPassword(userIdOrEmail: string): Promise<{ user: User; temporaryPassword: string }> {
    // Chercher l'utilisateur par ID ou email
    const user = await this.userRepository.findOne({
      where: [
        { id: userIdOrEmail },
        { email: userIdOrEmail },
      ],
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Générer un nouveau mot de passe temporaire
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    // Mettre à jour le mot de passe
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Retourner l'utilisateur sans le mot de passe hashé, mais avec le mot de passe temporaire
    const { password, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword as User,
      temporaryPassword,
    };
  }
}




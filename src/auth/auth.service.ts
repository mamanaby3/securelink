import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { LoginClientDto } from './dto/login-client.dto';
import { RegisterDto, UserRole } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterClientStep1Dto } from './dto/register-client-step1.dto';
import { RegisterClientStep2Dto } from './dto/register-client-step2.dto';
import { RegisterClientStep2DataDto } from './dto/register-client-step2-data.dto';
import { RegisterClientStep3Dto } from './dto/register-client-step3.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { User } from './entities/user.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { Request, RequestStatus } from '../requests/entities/request.entity';
import { JwtPayload } from './strategies/jwt.strategy';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditAction, AuditStatus } from '../audit-logs/entities/audit-log.entity';
import { EmailService } from '../common/services/email.service';
import { SmsService } from '../common/services/sms.service';
import { Logger } from '@nestjs/common';
import { SecurityService } from '../security/security.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private resetTokens: Map<string, { email: string; expiry: Date }> = new Map();
  private otpCodes: Map<string, { code: string; email: string; expiry: Date; verified: boolean }> = new Map();
  private loginAttempts: Map<string, { count: number; lastAttempt: Date }> = new Map();
  private registrationSessions: Map<string, { step1: any; otp?: string; otpExpiry?: Date; otpVerified?: boolean; expiry: Date }> = new Map();
  private passwordSetupTokens: Map<string, { userId: string; email: string; expiry: Date }> = new Map();
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly OTP_EXPIRATION = 10 * 60 * 1000; // 10 minutes
  private readonly OTP_LENGTH = 4;
  private readonly REGISTRATION_SESSION_EXPIRATION = 30 * 60 * 1000; // 30 minutes

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Organisation)
    private organisationRepository: Repository<Organisation>,
    @InjectRepository(Request)
    private requestRepository: Repository<Request>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditLogsService: AuditLogsService,
    private emailService: EmailService,
    private smsService: SmsService,
    private securityService: SecurityService,
  ) {
    // Créer un utilisateur admin par défaut si aucun n'existe
    this.createDefaultAdmin();
  }

  private async createDefaultAdmin() {
    const adminExists = await this.userRepository.findOne({
      where: { email: 'admin@securelink.com' },
    });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      const admin = this.userRepository.create({
        name: 'Administrateur',
        email: 'admin@securelink.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        isActive: true,
        isEmailVerified: true,
      });
      await this.userRepository.save(admin);
    }
  }

  private async logAuditEvent(
    action: AuditAction,
    resource: string,
    status: AuditStatus,
    userId?: string,
    userName?: string,
    ipAddress?: string,
    metadata?: any,
  ) {
    try {
      await this.auditLogsService.create({
        userId,
        userName,
        action,
        resource,
        ipAddress: ipAddress || 'unknown',
        status,
        metadata,
      });
    } catch (error) {
      // Ne pas faire échouer l'authentification si le log échoue
      console.error('Erreur lors de la création du log d\'audit:', error);
    }
  }

  private checkLoginAttempts(email: string): void {
    const attempts = this.loginAttempts.get(email);
    if (attempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();

      if (attempts.count >= this.MAX_LOGIN_ATTEMPTS) {
        if (timeSinceLastAttempt < this.LOCKOUT_DURATION) {
          const remainingTime = Math.ceil((this.LOCKOUT_DURATION - timeSinceLastAttempt) / 1000 / 60);
          throw new UnauthorizedException(
            `Trop de tentatives de connexion. Réessayez dans ${remainingTime} minute(s)`,
          );
        } else {
          // Réinitialiser les tentatives après la période de verrouillage
          this.loginAttempts.delete(email);
        }
      }
    }
  }

  private recordLoginAttempt(email: string, success: boolean): void {
    if (success) {
      this.loginAttempts.delete(email);
    } else {
      const attempts = this.loginAttempts.get(email) || { count: 0, lastAttempt: new Date() };
      attempts.count += 1;
      attempts.lastAttempt = new Date();
      this.loginAttempts.set(email, attempts);
    }
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      // Vérifier si le compte est en attente de création de mot de passe
      if (user.passwordSetupToken) {
        throw new UnauthorizedException('Votre compte est en attente de création de mot de passe. Veuillez vérifier votre email pour le lien de création de mot de passe.');
      }
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    return user;
  }

  /**
   * Valide un utilisateur par email ou numéro de téléphone (pour les clients uniquement)
   */
  async validateUserByEmailOrPhone(
    emailOrPhone: string,
    password: string,
  ): Promise<User | null> {
    // Déterminer si c'est un email ou un numéro de téléphone
    const isEmail = emailOrPhone.includes('@');

    let user: User | null = null;

    if (isEmail) {
      // Recherche par email
      user = await this.userRepository.findOne({
        where: { email: emailOrPhone },
      });
    } else {
      // Recherche par numéro de téléphone
      user = await this.userRepository.findOne({
        where: { phone: emailOrPhone },
      });
    }

    if (!user) {
      return null;
    }

    // Vérifier que c'est bien un client
    if (user.role !== UserRole.CLIENT) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    if (!user.isActive) {
      // Vérifier si le compte est en attente de création de mot de passe
      if (user.passwordSetupToken) {
        throw new UnauthorizedException('Votre compte est en attente de création de mot de passe. Veuillez vérifier votre email pour le lien de création de mot de passe.');
      }
      throw new UnauthorizedException('Votre compte est désactivé');
    }

    return user;
  }

  async validateUserById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  async login(loginDto: LoginDto, ipAddress?: string, requiredRole?: UserRole) {
    // Vérifier les tentatives de connexion
    this.checkLoginAttempts(loginDto.email);

    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      this.recordLoginAttempt(loginDto.email, false);
      await this.logAuditEvent(
        AuditAction.CONNEXION_ECHOUEE,
        'Authentification',
        AuditStatus.ECHEC,
        undefined,
        loginDto.email,
        ipAddress,
        { reason: 'Email ou mot de passe incorrect' },
      );
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // Vérifier le rôle si spécifié
    if (requiredRole && user.role !== requiredRole) {
      this.recordLoginAttempt(loginDto.email, false);
      await this.logAuditEvent(
        AuditAction.CONNEXION_ECHOUEE,
        'Authentification',
        AuditStatus.ECHEC,
        user.id,
        user.name,
        ipAddress,
        { reason: `Rôle incorrect. Requis: ${requiredRole}, Actuel: ${user.role}` },
      );
      throw new UnauthorizedException(`Accès refusé. Ce endpoint est réservé aux utilisateurs avec le rôle ${requiredRole}`);
    }

    // Connexion réussie
    this.recordLoginAttempt(loginDto.email, true);

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: user.type,
      organisationId: user.organisationId,
      organisationRole: user.organisationRole,
    };

    // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
    const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
    const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
    const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    // Stocker le refresh token
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    await this.userRepository.save(user);

    // Logger la connexion réussie
    await this.logAuditEvent(
      AuditAction.CONNEXION_REUSSIE,
      'Authentification',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        type: user.type,
        organisationId: user.organisationId,
        organisationRole: user.organisationRole,
      },
    };
  }

  /**
   * Connexion spécifique pour les clients (par email ou téléphone)
   */
  async loginClient(loginDto: LoginClientDto, ipAddress?: string) {
    // Déterminer l'identifiant (email ou phone)
    const identifier = loginDto.email || loginDto.phone;
    if (!identifier) {
      throw new BadRequestException('Email ou numéro de téléphone requis');
    }

    // Vérifier les tentatives de connexion
    this.checkLoginAttempts(identifier);

    const user = await this.validateUserByEmailOrPhone(identifier, loginDto.password);

    if (!user) {
      this.recordLoginAttempt(identifier, false);
      await this.logAuditEvent(
        AuditAction.CONNEXION_ECHOUEE,
        'Authentification',
        AuditStatus.ECHEC,
        undefined,
        identifier,
        ipAddress,
        { reason: 'Email/téléphone ou mot de passe incorrect' },
      );
      throw new UnauthorizedException('Email/téléphone ou mot de passe incorrect');
    }

    // Vérifier que c'est bien un client
    if (user.role !== UserRole.CLIENT) {
      this.recordLoginAttempt(identifier, false);
      await this.logAuditEvent(
        AuditAction.CONNEXION_ECHOUEE,
        'Authentification',
        AuditStatus.ECHEC,
        user.id,
        user.name,
        ipAddress,
        { reason: `Rôle incorrect. Requis: CLIENT, Actuel: ${user.role}` },
      );
      throw new UnauthorizedException('Accès refusé. Ce endpoint est réservé aux clients');
    }

    // Connexion réussie
    this.recordLoginAttempt(identifier, true);

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: user.type,
      organisationId: user.organisationId,
      organisationRole: user.organisationRole,
    };

    // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
    const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
    const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
    const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    // Stocker le refresh token
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    );
    await this.userRepository.save(user);

    // Logger la connexion réussie
    await this.logAuditEvent(
      AuditAction.CONNEXION_REUSSIE,
      'Authentification',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
      { identifier: identifier.includes('@') ? 'email' : 'phone' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        type: user.type,
        organisationId: user.organisationId,
        organisationRole: user.organisationRole,
      },
    };
  }

  async register(registerDto: RegisterDto, ipAddress?: string) {
    // Vérifier si l'email existe déjà
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier la confirmation du mot de passe si fournie
    if (
      (registerDto as any).confirmPassword &&
      registerDto.password !== (registerDto as any).confirmPassword
    ) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    // Créer le nouvel utilisateur
    const newUser = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      phone: registerDto.phone,
      role: registerDto.role,
      type: registerDto.type,
      organisationId: registerDto.organisationId,
      isActive: true,
      isEmailVerified: false, // À vérifier par email
    });

    await this.userRepository.save(newUser);

    // Générer les tokens
    const payload: JwtPayload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      type: newUser.type,
      organisationId: newUser.organisationId,
      organisationRole: newUser.organisationRole,
    };

    // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
    const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
    const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
    const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    newUser.refreshToken = refreshToken;
    newUser.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepository.save(newUser);

    // Logger l'inscription
    await this.logAuditEvent(
      AuditAction.CREER_UTILISATEUR,
      'Inscription',
      AuditStatus.SUCCES,
      newUser.id,
      newUser.name,
      ipAddress,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        type: newUser.type,
        organisationId: newUser.organisationId,
        organisationRole: newUser.organisationRole,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET', 'your-secret-key-change-in-production'),
      });

      const user = await this.validateUserById(payload.sub);
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token de rafraîchissement invalide');
      }

      if (user.refreshTokenExpiry && user.refreshTokenExpiry < new Date()) {
        throw new UnauthorizedException('Token de rafraîchissement expiré');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: user.type,
        organisationId: user.organisationId,
        organisationRole: user.organisationRole,
      };

      // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
      const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
      const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
      const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn,
      });

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Valider que les nouveaux mots de passe correspondent
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new BadRequestException('Les nouveaux mots de passe ne correspondent pas');
    }

    // Vérifier l'ancien mot de passe
    const isOldPasswordValid = await bcrypt.compare(
      changePasswordDto.oldPassword,
      user.password,
    );
    if (!isOldPasswordValid) {
      await this.logAuditEvent(
        AuditAction.CONNEXION_ECHOUEE,
        'Tentative de changement de mot de passe',
        AuditStatus.ECHEC,
        user.id,
        user.name,
        ipAddress,
        { reason: 'Ancien mot de passe incorrect' },
      );
      throw new BadRequestException('Ancien mot de passe incorrect');
    }

    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(
      changePasswordDto.newPassword,
      user.password,
    );
    if (isSamePassword) {
      throw new BadRequestException('Le nouveau mot de passe doit être différent de l\'ancien');
    }

    // Hasher le nouveau mot de passe
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);
    user.password = hashedNewPassword;
    await this.userRepository.save(user);

    // Logger le changement de mot de passe réussi
    await this.logAuditEvent(
      AuditAction.POLITIQUE_MISE_A_JOUR,
      'Changement de mot de passe',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
      { action: 'PASSWORD_CHANGED' },
    );

    return {
      message: 'Mot de passe modifié avec succès',
    };
  }

  private generateOTP(): string {
    // Générer un code OTP de 4 chiffres
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  async forgotPasswordRequest(email: string, ipAddress?: string) {
    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Format d\'email invalide');
    }

    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      // Ne pas révéler si l'email existe ou non pour la sécurité
      return {
        message: 'Si cet email existe, un code OTP a été envoyé',
      };
    }

    // Générer un code OTP
    const otp = this.generateOTP();
    const expiry = new Date(Date.now() + this.OTP_EXPIRATION);

    // Stocker l'OTP (utiliser l'email comme clé)
    this.otpCodes.set(email, {
      code: otp,
      email: user.email,
      expiry,
      verified: false,
    });

    // Envoyer un email avec le code OTP
    try {
      await this.emailService.sendOtpEmail(user.email, otp, user.name);
    } catch (error) {
      // En cas d'erreur d'envoi, logger le code pour le développement
      console.log(`[DEV] Code OTP pour ${email}: ${otp}`);
      this.logger.error(`Erreur lors de l'envoi de l'email OTP: ${error.message}`);
    }

    // Logger la demande
    await this.logAuditEvent(
      AuditAction.CONNEXION_ECHOUEE, // Utiliser une action appropriée ou créer une nouvelle
      'Demande de réinitialisation de mot de passe',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
      { action: 'OTP_REQUESTED' },
    );

    return {
      message: 'Si cet email existe, un code OTP a été envoyé',
      ...(process.env.NODE_ENV === 'development' && { otp }), // Uniquement en développement
      expiresIn: '10 minutes',
    };
  }

  async resendOtp(email: string, ipAddress?: string) {
    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Format d\'email invalide');
    }

    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      // Ne pas révéler si l'email existe ou non
      return {
        message: 'Si cet email existe, un nouveau code OTP a été envoyé',
      };
    }

    // Vérifier s'il existe déjà un OTP non expiré
    const existingOtp = this.otpCodes.get(email);
    if (existingOtp && existingOtp.expiry > new Date() && !existingOtp.verified) {
      // Limiter le renvoi (attendre au moins 1 minute)
      const timeSinceLastOtp = Date.now() - existingOtp.expiry.getTime() + this.OTP_EXPIRATION;
      if (timeSinceLastOtp < 60 * 1000) {
        throw new BadRequestException('Veuillez attendre avant de demander un nouveau code');
      }
    }

    // Générer un nouveau code OTP
    const otp = this.generateOTP();
    const expiry = new Date(Date.now() + this.OTP_EXPIRATION);

    this.otpCodes.set(email, {
      code: otp,
      email: user.email,
      expiry,
      verified: false,
    });

    // Envoyer un email avec le code OTP
    try {
      await this.emailService.sendOtpEmail(user.email, otp, user.name);
    } catch (error) {
      // En cas d'erreur d'envoi, logger le code pour le développement
      console.log(`[DEV] Nouveau code OTP pour ${email}: ${otp}`);
      this.logger.error(`Erreur lors de l'envoi de l'email OTP: ${error.message}`);
    }

    return {
      message: 'Si cet email existe, un nouveau code OTP a été envoyé',
      ...(process.env.NODE_ENV === 'development' && { otp }), // Uniquement en développement
      expiresIn: '10 minutes',
    };
  }

  async verifyOtp(email: string, otp: string, ipAddress?: string) {
    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Format d\'email invalide');
    }

    // Valider le format de l'OTP (4 chiffres)
    const otpRegex = /^\d{4}$/;
    if (!otpRegex.test(otp)) {
      throw new BadRequestException('Le code OTP doit contenir exactement 4 chiffres');
    }

    const otpData = this.otpCodes.get(email);

    if (!otpData) {
      throw new BadRequestException('Aucun code OTP trouvé pour cet email. Veuillez en demander un nouveau.');
    }

    if (otpData.expiry < new Date()) {
      this.otpCodes.delete(email);
      throw new BadRequestException('Le code OTP a expiré. Veuillez en demander un nouveau.');
    }

    if (otpData.verified) {
      throw new BadRequestException('Ce code OTP a déjà été utilisé. Veuillez en demander un nouveau.');
    }

    if (otpData.code !== otp) {
      throw new BadRequestException('Code OTP incorrect');
    }

    // Marquer l'OTP comme vérifié
    otpData.verified = true;
    this.otpCodes.set(email, otpData);

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (user) {
      await this.logAuditEvent(
        AuditAction.CONNEXION_REUSSIE,
        'Vérification OTP réussie',
        AuditStatus.SUCCES,
        user.id,
        user.name,
        ipAddress,
        { action: 'OTP_VERIFIED' },
      );
    }

    return {
      message: 'Code OTP vérifié avec succès',
      verified: true,
    };
  }

  async resetPasswordWithOtp(
    email: string,
    otp: string,
    newPassword: string,
    confirmPassword: string,
    ipAddress?: string,
  ) {
    // Valider que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new BadRequestException('Format d\'email invalide');
    }

    const otpData = this.otpCodes.get(email);

    if (!otpData) {
      throw new BadRequestException('Aucun code OTP trouvé pour cet email');
    }

    if (otpData.expiry < new Date()) {
      this.otpCodes.delete(email);
      throw new BadRequestException('Le code OTP a expiré. Veuillez en demander un nouveau.');
    }

    if (!otpData.verified && otpData.code !== otp) {
      throw new BadRequestException('Code OTP incorrect ou non vérifié');
    }

    // Si l'OTP n'a pas été vérifié via verify-otp, vérifier maintenant
    if (!otpData.verified) {
      if (otpData.code !== otp) {
        throw new BadRequestException('Code OTP incorrect');
      }
      otpData.verified = true;
    }

    const user = await this.userRepository.findOne({
      where: { email },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Note: Pour la réinitialisation, on ne vérifie pas si le nouveau mot de passe
    // est différent de l'ancien car l'utilisateur peut vouloir réutiliser le même mot de passe

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Supprimer l'OTP utilisé
    this.otpCodes.delete(email);

    // Logger la réinitialisation
    await this.logAuditEvent(
      AuditAction.POLITIQUE_MISE_A_JOUR,
      'Réinitialisation de mot de passe',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
      { action: 'PASSWORD_RESET' },
    );

    return {
      message: 'Mot de passe réinitialisé avec succès',
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: forgotPasswordDto.email },
    });
    if (!user) {
      // Ne pas révéler si l'email existe ou non pour la sécurité
      return {
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      };
    }

    // Générer un token de réinitialisation
    const resetToken = `reset-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    this.resetTokens.set(resetToken, {
      email: user.email,
      expiry,
    });

    // En production, envoyer un email avec le token
    // Pour l'instant, on retourne le token (à ne pas faire en production)
    return {
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé',
      resetToken, // À retirer en production
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const tokenData = this.resetTokens.get(resetPasswordDto.token);
    if (!tokenData || tokenData.expiry < new Date()) {
      throw new BadRequestException('Token de réinitialisation invalide ou expiré');
    }

    const user = await this.userRepository.findOne({
      where: { email: tokenData.email },
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 12);
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Supprimer le token utilisé
    this.resetTokens.delete(resetPasswordDto.token);

    return {
      message: 'Mot de passe réinitialisé avec succès',
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['organisation'],
    });
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Informations de base communes à tous les rôles
    const baseProfile = {
      id: user.id,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      address: user.address,
      maritalStatus: user.maritalStatus,
      profilePicture: user.profilePicture,
      role: user.role,
      type: user.type,
      organisationId: user.organisationId,
      organisationRole: user.organisationRole,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Informations spécifiques selon le rôle
    switch (user.role) {
      case UserRole.ADMIN:
        return {
          ...baseProfile,
          // Statistiques globales pour l'admin
          adminStatistics: {
            totalUsers: await this.userRepository.count(),
            totalOrganisations: await this.organisationRepository.count(),
            totalRequests: await this.requestRepository.count(),
            activeUsers: await this.userRepository.count({ where: { isActive: true } }),
            activeOrganisations: await this.organisationRepository.count({ where: { isActive: true } }),
          },
        };

      case UserRole.ORGANISATION:
        if (!user.organisationId) {
          return baseProfile;
        }

        // Récupérer l'organisation avec ses relations
        const organisation = await this.organisationRepository.findOne({
          where: { id: user.organisationId },
          relations: ['users', 'requests'],
        });

        if (!organisation) {
          return baseProfile;
        }

        // Récupérer les utilisateurs de l'organisation
        const organisationUsers = await this.userRepository.find({
          where: { organisationId: user.organisationId },
          select: ['id', 'name', 'email', 'phone', 'role', 'organisationRole', 'isActive', 'createdAt'],
        });

        // Récupérer les demandes de l'organisation
        const organisationRequests = await this.requestRepository.find({
          where: { organisationId: user.organisationId },
          relations: ['client', 'form'],
          order: { createdAt: 'DESC' },
          take: 10, // Dernières 10 demandes
        });

        return {
          ...baseProfile,
          organisation: {
            id: organisation.id,
            name: organisation.name,
            sector: organisation.sector,
            adminEmail: organisation.adminEmail,
            phone: organisation.phone,
            logo: organisation.logo,
            isActive: organisation.isActive,
            registrationDate: organisation.registrationDate,
            createdAt: organisation.createdAt,
          },
          organisationUsers: organisationUsers.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            organisationRole: u.organisationRole,
            isActive: u.isActive,
            createdAt: u.createdAt,
          })),
          organisationStatistics: {
            totalUsers: organisationUsers.length,
            activeUsers: organisationUsers.filter((u) => u.isActive).length,
            totalRequests: await this.requestRepository.count({ where: { organisationId: user.organisationId } }),
            pendingRequests: await this.requestRepository.count({
              where: { organisationId: user.organisationId, status: RequestStatus.EN_ATTENTE },
            }),
          },
          recentRequests: organisationRequests.map((r) => ({
            id: r.id,
            requestNumber: r.requestNumber,
            formName: r.formName,
            formType: r.formType,
            clientName: r.clientName,
            status: r.status,
            submittedAt: r.submittedAt,
            createdAt: r.createdAt,
          })),
        };

      case UserRole.CLIENT:
        // Récupérer les demandes du client
        const clientRequests = await this.requestRepository.find({
          where: { clientId: userId },
          relations: ['organisation', 'form'],
          order: { createdAt: 'DESC' },
        });

        // Calculer le pourcentage de complétion du profil
        // Base : 50% après inscription
        let profileCompletion = 50;

        // Vérifier les documents requis (sera calculé dynamiquement via l'endpoint dédié)
        // Pour l'instant, on retourne juste la base

        return {
          ...baseProfile,
          profileCompletion,
          requests: clientRequests.map((r) => ({
            id: r.id,
            requestNumber: r.requestNumber,
            formName: r.formName,
            formType: r.formType,
            organisationName: r.organisationName,
            status: r.status,
            amount: r.amount,
            submittedAt: r.submittedAt,
            processedAt: r.processedAt,
            createdAt: r.createdAt,
          })),
          clientStatistics: {
            totalRequests: clientRequests.length,
            pendingRequests: clientRequests.filter((r) => r.status === RequestStatus.EN_ATTENTE).length,
            validatedRequests: clientRequests.filter((r) => r.status === RequestStatus.VALIDEE).length,
            rejectedRequests: clientRequests.filter((r) => r.status === RequestStatus.REJETEE).length,
            inProgressRequests: clientRequests.filter((r) => r.status === RequestStatus.EN_COURS).length,
          },
        };

      default:
        return baseProfile;
    }
  }

  async logout(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (user) {
      user.refreshToken = undefined;
      user.refreshTokenExpiry = undefined;
      await this.userRepository.save(user);
    }

    return {
      message: 'Déconnexion réussie',
    };
  }

  private generateSessionToken(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Lien web envoyé par email : {FRONTEND_URL}/auth/setup-password?token=xxx
   */
  private getPasswordSetupLink(token: string): string {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:4200',
    );
    return `${frontendUrl.replace(/\/$/, '')}/auth/setup-password?token=${token}`;
  }

  /**
   * Lien deep link mobile (optionnel) : securelink://create-password?token=xxx
   * Définir MOBILE_DEEP_LINK_URL dans .env (ex: securelink://create-password?token=).
   */
  private getPasswordSetupLinkMobile(token: string): string | null {
    const base = this.configService.get<string>('MOBILE_DEEP_LINK_URL', '');
    if (!base || typeof base !== 'string') return null;
    const encoded = encodeURIComponent(token);
    if (base.endsWith('?token=')) return base + encoded;
    return base + (base.includes('?') ? '&' : '?') + 'token=' + encoded;
  }

  async registerClientStep1(step1Dto: RegisterClientStep1Dto, ipAddress?: string) {
    // Vérifier si l'email existe déjà
    const existingByEmail = await this.userRepository.findOne({
      where: { email: step1Dto.email },
    });
    if (existingByEmail) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier si le numéro de téléphone est déjà utilisé (unique par compte)
    const existingByPhone = await this.userRepository.findOne({
      where: { phone: step1Dto.phone },
    });
    if (existingByPhone) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    // Générer un token de session
    const sessionToken = this.generateSessionToken();
    const expiry = new Date(Date.now() + this.REGISTRATION_SESSION_EXPIRATION);

    // Générer un code OTP
    const otp = this.generateOTP();
    const otpExpiry = new Date(Date.now() + this.OTP_EXPIRATION);

    // Convertir la date de naissance de jj/mm/aaaa en Date
    const [day, month, year] = step1Dto.dateOfBirth.split('/');
    const dateOfBirth = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

    // Stocker toutes les données de l'étape 1 et l'OTP
    this.registrationSessions.set(sessionToken, {
      step1: {
        ...step1Dto,
        dateOfBirth, // Date convertie
      },
      otp,
      otpExpiry,
      otpVerified: false,
      expiry,
    });

    // Stocker l'OTP pour la vérification
    this.otpCodes.set(step1Dto.email, {
      code: otp,
      email: step1Dto.email,
      expiry: otpExpiry,
      verified: false,
    });

    // Envoyer l'OTP par email
    try {
      await this.emailService.sendRegistrationOtpEmail(
        step1Dto.email,
        otp,
        `${step1Dto.firstName} ${step1Dto.lastName}`,
      );
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email OTP: ${error.message}`);
      console.log(`[DEV] Code OTP d'inscription pour ${step1Dto.email}: ${otp}`);
    }

    // Envoyer l'OTP par SMS si le téléphone est fourni
    if (step1Dto.phone) {
      try {
        await this.smsService.sendOtpSms(
          step1Dto.phone,
          otp,
          'Votre code de vérification pour finaliser votre inscription sur Secure Link.',
        );
      } catch (error) {
        this.logger.error(`Erreur lors de l'envoi du SMS OTP: ${error.message}`);
        // Ne pas faire échouer l'inscription si le SMS échoue
      }
    }

    return {
      message: 'Code OTP envoyé par email et SMS',
      sessionToken,
      expiresIn: '30 minutes',
      otpExpiresIn: '10 minutes',
      nextStep: 'verify-otp',
      ...(process.env.NODE_ENV === 'development' && { otp }), // Uniquement en développement
    };
  }

  async verifyRegistrationOtp(sessionToken: string, otp: string) {
    // Vérifier la session
    const session = this.registrationSessions.get(sessionToken);
    if (!session) {
      throw new BadRequestException('Session invalide ou expirée. Veuillez recommencer l\'inscription.');
    }

    if (session.expiry < new Date()) {
      this.registrationSessions.delete(sessionToken);
      throw new BadRequestException('Session expirée. Veuillez recommencer l\'inscription.');
    }

    if (!session.step1) {
      throw new BadRequestException('Étape 1 non complétée. Veuillez recommencer l\'inscription.');
    }

    // Vérifier l'OTP
    if (!session.otp || !session.otpExpiry) {
      throw new BadRequestException('Aucun code OTP trouvé. Veuillez recommencer l\'inscription.');
    }

    if (session.otpExpiry < new Date()) {
      this.registrationSessions.delete(sessionToken);
      throw new BadRequestException('Le code OTP a expiré. Veuillez recommencer l\'inscription.');
    }

    if (session.otp !== otp) {
      throw new BadRequestException('Code OTP incorrect');
    }

    // Vérifier à nouveau si l'email existe (au cas où il aurait été créé entre-temps)
    const existingUser = await this.userRepository.findOne({
      where: { email: session.step1.email },
    });
    if (existingUser) {
      this.registrationSessions.delete(sessionToken);
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Générer un token de création de mot de passe
    const passwordSetupToken = `pwd-setup-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const passwordSetupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Créer le compte avec statut PENDING_PASSWORD (isActive: false)
    // Utiliser un mot de passe temporaire qui sera remplacé lors de la création du mot de passe
    const temporaryPassword = `temp-${Math.random().toString(36).substring(7)}-${Date.now()}`;
    const hashedTemporaryPassword = await bcrypt.hash(temporaryPassword, 12);

    const newUser = this.userRepository.create({
      name: `${session.step1.firstName} ${session.step1.lastName}`,
      firstName: session.step1.firstName,
      lastName: session.step1.lastName,
      email: session.step1.email,
      password: hashedTemporaryPassword, // Mot de passe temporaire
      phone: session.step1.phone,
      address: session.step1.address,
      dateOfBirth: session.step1.dateOfBirth,
      gender: session.step1.gender,
      maritalStatus: session.step1.maritalStatus,
      role: UserRole.CLIENT,
      isActive: false, // Compte non actif jusqu'à la création du mot de passe
      isEmailVerified: true, // Email vérifié via OTP
      passwordSetupToken,
      passwordSetupTokenExpiry,
    });

    await this.userRepository.save(newUser);

    // Stocker le token pour la création du mot de passe
    this.passwordSetupTokens.set(passwordSetupToken, {
      userId: newUser.id,
      email: newUser.email,
      expiry: passwordSetupTokenExpiry,
    });

    // Envoyer l'email avec le lien web + deep link mobile (si MOBILE_DEEP_LINK_URL est défini)
    try {
      const passwordSetupLink = this.getPasswordSetupLink(passwordSetupToken);
      const passwordSetupLinkMobile = this.getPasswordSetupLinkMobile(passwordSetupToken);
      await this.emailService.sendPasswordSetupEmail(
        newUser.email,
        newUser.name,
        passwordSetupLink,
        passwordSetupLinkMobile,
      );
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email de création de mot de passe: ${error.message}`);
      // Ne pas faire échouer l'inscription, mais logger l'erreur
    }

    // Supprimer la session
    this.registrationSessions.delete(sessionToken);

    return {
      message: 'Code OTP vérifié avec succès. Votre compte a été créé. Un lien de création de mot de passe a été envoyé à votre adresse email.',
      email: newUser.email,
      verified: true,
      nextStep: 'setup-password',
    };
  }

  async registerClientStep2(sessionToken: string) {
    // Vérifier la session
    const session = this.registrationSessions.get(sessionToken);
    if (!session) {
      throw new BadRequestException('Session invalide ou expirée. Veuillez recommencer l\'inscription.');
    }

    if (session.expiry < new Date()) {
      this.registrationSessions.delete(sessionToken);
      throw new BadRequestException('Session expirée. Veuillez recommencer l\'inscription.');
    }

    if (!session.step1) {
      throw new BadRequestException('Étape 1 non complétée. Veuillez recommencer l\'inscription.');
    }

    // Vérifier que l'OTP a été vérifié
    if (!session.otpVerified) {
      throw new BadRequestException('Le code OTP doit être vérifié avant de continuer. Veuillez d\'abord vérifier votre code OTP.');
    }

    // Vérifier à nouveau si l'email existe (au cas où il aurait été créé entre-temps)
    const existingUser = await this.userRepository.findOne({
      where: { email: session.step1.email },
    });
    if (existingUser) {
      this.registrationSessions.delete(sessionToken);
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Générer un token de création de mot de passe
    const passwordSetupToken = `pwd-setup-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const passwordSetupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

    // Créer le compte avec statut PENDING_PASSWORD (isActive: false)
    // Utiliser un mot de passe temporaire qui sera remplacé lors de la création du mot de passe
    const temporaryPassword = `temp-${Math.random().toString(36).substring(7)}-${Date.now()}`;
    const hashedTemporaryPassword = await bcrypt.hash(temporaryPassword, 12);

    const newUser = this.userRepository.create({
      name: `${session.step1.firstName} ${session.step1.lastName}`,
      firstName: session.step1.firstName,
      lastName: session.step1.lastName,
      email: session.step1.email,
      password: hashedTemporaryPassword, // Mot de passe temporaire
      phone: session.step1.phone,
      address: session.step1.address,
      dateOfBirth: session.step1.dateOfBirth,
      gender: session.step1.gender,
      maritalStatus: session.step1.maritalStatus,
      role: UserRole.CLIENT,
      isActive: false, // Compte non actif jusqu'à la création du mot de passe
      isEmailVerified: true, // Email vérifié via OTP
      passwordSetupToken,
      passwordSetupTokenExpiry,
    });

    await this.userRepository.save(newUser);

    // Stocker le token pour la création du mot de passe
    this.passwordSetupTokens.set(passwordSetupToken, {
      userId: newUser.id,
      email: newUser.email,
      expiry: passwordSetupTokenExpiry,
    });

    // Envoyer l'email avec le lien web + deep link mobile (si MOBILE_DEEP_LINK_URL est défini)
    try {
      const passwordSetupLink = this.getPasswordSetupLink(passwordSetupToken);
      const passwordSetupLinkMobile = this.getPasswordSetupLinkMobile(passwordSetupToken);
      await this.emailService.sendPasswordSetupEmail(
        newUser.email,
        newUser.name,
        passwordSetupLink,
        passwordSetupLinkMobile,
      );
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email de création de mot de passe: ${error.message}`);
      // Ne pas faire échouer l'inscription, mais logger l'erreur
    }

    // Supprimer la session
    this.registrationSessions.delete(sessionToken);

    return {
      message: 'Inscription validée. Un lien de création de mot de passe a été envoyé à votre adresse email.',
      email: newUser.email,
      nextStep: 'setup-password',
    };
  }

  async registerClientStep3(step3Dto: RegisterClientStep3Dto, ipAddress?: string) {
    // Vérifier la session
    const session = this.registrationSessions.get(step3Dto.sessionToken);
    if (!session) {
      throw new BadRequestException('Session invalide ou expirée. Veuillez recommencer l\'inscription.');
    }

    if (session.expiry < new Date()) {
      this.registrationSessions.delete(step3Dto.sessionToken);
      throw new BadRequestException('Session expirée. Veuillez recommencer l\'inscription.');
    }

    if (!session.step1) {
      throw new BadRequestException('Étape 1 non complétée. Veuillez recommencer l\'inscription.');
    }

    // Vérifier l'acceptation des conditions
    if (!step3Dto.acceptTerms) {
      throw new BadRequestException('Vous devez accepter les conditions d\'utilisation pour continuer.');
    }

    // Vérifier que les mots de passe correspondent
    if (step3Dto.password !== step3Dto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Vérifier à nouveau si l'email existe (au cas où il aurait été créé entre-temps)
    const existingUser = await this.userRepository.findOne({
      where: { email: session.step1.email },
    });
    if (existingUser) {
      this.registrationSessions.delete(step3Dto.sessionToken);
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(step3Dto.password, 12);

    // Créer le nouvel utilisateur
    const newUser = this.userRepository.create({
      name: `${session.step1.firstName} ${session.step1.lastName}`,
      firstName: session.step1.firstName,
      lastName: session.step1.lastName,
      email: session.step1.email,
      password: hashedPassword,
      phone: session.step1.phone,
      address: session.step1.address,
      dateOfBirth: session.step1.dateOfBirth,
      gender: session.step1.gender,
      maritalStatus: session.step1.maritalStatus,
      role: UserRole.CLIENT,
      isActive: true,
      isEmailVerified: false,
    });

    await this.userRepository.save(newUser);

    // Supprimer la session
    this.registrationSessions.delete(step3Dto.sessionToken);

    // Générer les tokens
    const payload: JwtPayload = {
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
      type: newUser.type,
      organisationId: newUser.organisationId,
      organisationRole: newUser.organisationRole,
    };

    // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
    const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
    const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
    const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    newUser.refreshToken = refreshToken;
    newUser.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepository.save(newUser);

    // Logger l'inscription
    await this.logAuditEvent(
      AuditAction.CONNEXION_REUSSIE,
      'Inscription client',
      AuditStatus.SUCCES,
      newUser.id,
      newUser.name,
      ipAddress,
      { action: 'CLIENT_REGISTRATION' },
    );

    return {
      message: 'Inscription réussie',
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        name: newUser.name,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        isActive: newUser.isActive,
        isEmailVerified: newUser.isEmailVerified,
      },
    };
  }

  async setupPassword(setupPasswordDto: SetupPasswordDto, ipAddress?: string) {
    // Vérifier que les mots de passe correspondent
    if (setupPasswordDto.password !== setupPasswordDto.confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas');
    }

    // Vérifier le token
    const tokenData = this.passwordSetupTokens.get(setupPasswordDto.token);
    if (!tokenData || tokenData.expiry < new Date()) {
      throw new BadRequestException('Token de création de mot de passe invalide ou expiré');
    }

    // Trouver l'utilisateur
    const user = await this.userRepository.findOne({
      where: { id: tokenData.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier que le token correspond à celui stocké dans la base de données
    if (user.passwordSetupToken !== setupPasswordDto.token) {
      throw new BadRequestException('Token de création de mot de passe invalide');
    }

    if (user.passwordSetupTokenExpiry && user.passwordSetupTokenExpiry < new Date()) {
      throw new BadRequestException('Token de création de mot de passe expiré');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(setupPasswordDto.password, 12);

    // Mettre à jour le mot de passe et activer le compte
    user.password = hashedPassword;
    user.isActive = true;
    user.passwordSetupToken = null;
    user.passwordSetupTokenExpiry = null;
    await this.userRepository.save(user);

    // Supprimer le token utilisé
    this.passwordSetupTokens.delete(setupPasswordDto.token);

    // Générer les tokens JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: user.type,
      organisationId: user.organisationId,
      organisationRole: user.organisationRole,
    };

    // Utiliser l'expiration configurée par l'admin ou la valeur par défaut
    const sessionExpirationMs = await this.securityService.getSessionExpirationMs();
    const sessionExpirationMinutes = sessionExpirationMs / (60 * 1000);
    const expiresIn = `${Math.round(sessionExpirationMinutes)}m`;

    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
    });

    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.userRepository.save(user);

    // Logger la création du mot de passe
    await this.logAuditEvent(
      AuditAction.CONNEXION_REUSSIE,
      'Création de mot de passe et activation du compte',
      AuditStatus.SUCCES,
      user.id,
      user.name,
      ipAddress,
      { action: 'PASSWORD_SETUP' },
    );

    return {
      message: 'Mot de passe créé avec succès. Votre compte est maintenant actif.',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async resendPasswordSetupLink(email: string, ipAddress?: string) {
    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      // Ne pas révéler si l'email existe ou non pour la sécurité
      return {
        message: 'Si cet email existe et que votre compte est en attente de création de mot de passe, un nouveau lien a été envoyé',
      };
    }

    // Vérifier que le compte est en attente de création de mot de passe
    if (!user.passwordSetupToken || user.isActive) {
      throw new BadRequestException('Ce compte n\'est pas en attente de création de mot de passe');
    }

    // Vérifier que le token n'est pas expiré
    if (user.passwordSetupTokenExpiry && user.passwordSetupTokenExpiry < new Date()) {
      // Générer un nouveau token
      const passwordSetupToken = `pwd-setup-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const passwordSetupTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures

      user.passwordSetupToken = passwordSetupToken;
      user.passwordSetupTokenExpiry = passwordSetupTokenExpiry;
      await this.userRepository.save(user);

      // Mettre à jour le token dans la map
      this.passwordSetupTokens.set(passwordSetupToken, {
        userId: user.id,
        email: user.email,
        expiry: passwordSetupTokenExpiry,
      });
    }

    // Envoyer l'email avec le lien web + deep link mobile (si MOBILE_DEEP_LINK_URL est défini)
    try {
      const passwordSetupLink = this.getPasswordSetupLink(user.passwordSetupToken);
      const passwordSetupLinkMobile = this.getPasswordSetupLinkMobile(user.passwordSetupToken);
      await this.emailService.sendPasswordSetupEmail(
        user.email,
        user.name,
        passwordSetupLink,
        passwordSetupLinkMobile,
      );
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email de création de mot de passe: ${error.message}`);
      throw new Error('Erreur lors de l\'envoi de l\'email. Veuillez réessayer plus tard.');
    }

    return {
      message: 'Un nouveau lien de création de mot de passe a été envoyé à votre adresse email',
    };
  }

  async verifyPasswordSetupToken(token: string) {
    // Vérifier le token dans la map
    const tokenData = this.passwordSetupTokens.get(token);
    if (!tokenData || tokenData.expiry < new Date()) {
      throw new BadRequestException('Token de création de mot de passe invalide ou expiré');
    }

    // Vérifier dans la base de données
    const user = await this.userRepository.findOne({
      where: { id: tokenData.userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    // Vérifier que le token correspond à celui stocké dans la base de données
    if (user.passwordSetupToken !== token) {
      throw new BadRequestException('Token de création de mot de passe invalide');
    }

    if (user.passwordSetupTokenExpiry && user.passwordSetupTokenExpiry < new Date()) {
      throw new BadRequestException('Token de création de mot de passe expiré');
    }

    // Vérifier que le compte est bien en attente
    if (user.isActive) {
      throw new BadRequestException('Ce compte est déjà actif. Le mot de passe a déjà été créé.');
    }

    return {
      valid: true,
      email: user.email,
      userName: user.name,
      message: 'Token valide. Vous pouvez maintenant créer votre mot de passe.',
    };
  }
}

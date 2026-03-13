import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
    Req,
    BadRequestException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { LoginClientDto } from './dto/login-client.dto';
import { RegisterDto } from './dto/register.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterClientStep1Dto } from './dto/register-client-step1.dto';
import { RegisterClientStep2Dto } from './dto/register-client-step2.dto';
import { RegisterClientStep3Dto } from './dto/register-client-step3.dto';
import { VerifyRegistrationOtpDto } from './dto/verify-registration-otp.dto';
import { SetupPasswordDto } from './dto/setup-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordOtpDto } from './dto/reset-password-otp.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';
import { UserRole } from './dto/register.dto';
import { IpAddress } from '../common/decorators/ip-address.decorator';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Inscription d\'un nouvel utilisateur (général)' })
    @ApiBody({ type: RegisterDto })
    @ApiResponse({
        status: 201,
        description: 'Utilisateur créé avec succès',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                        type: { type: 'string' },
                        organisationId: { type: 'string' },
                        organisationRole: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async register(@Body() registerDto: RegisterDto, @IpAddress() ipAddress: string) {
        return this.authService.register(registerDto, ipAddress);
    }



    @Post('register/client/step1')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Inscription client - Étape 1',
        description: 'Première étape : Toutes les informations (Nom, Prénom, Email, Téléphone, Adresse, Date de naissance, Genre, Situation matrimoniale). Envoie un code OTP par email et SMS. Retourne un token de session pour les étapes suivantes.'
    })
    @ApiBody({ type: RegisterClientStep1Dto })
    @ApiResponse({
        status: 200,
        description: 'Étape 1 complétée avec succès',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Code OTP envoyé par email et SMS' },
                sessionToken: { type: 'string', example: 'session-token-123' },
                expiresIn: { type: 'string', example: '30 minutes' },
                otpExpiresIn: { type: 'string', example: '10 minutes' },
                nextStep: { type: 'string', example: 'verify-otp' },
            },
        },
    })
    @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async registerClientStep1(
        @Body() step1Dto: RegisterClientStep1Dto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.registerClientStep1(step1Dto, ipAddress);
    }

    @Post('register/client/verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Vérifier le code OTP et créer le compte',
        description: 'Vérifie le code OTP reçu par email et SMS après l\'étape 1. Si l\'OTP est valide, crée le compte et envoie un lien email pour la création du mot de passe.'
    })
    @ApiBody({ type: VerifyRegistrationOtpDto })
    @ApiResponse({
        status: 200,
        description: 'Code OTP vérifié avec succès. Le compte a été créé et un lien de création de mot de passe a été envoyé par email.',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Code OTP vérifié avec succès. Votre compte a été créé. Un lien de création de mot de passe a été envoyé à votre adresse email.' },
                email: { type: 'string', example: 'user@example.com' },
                verified: { type: 'boolean', example: true },
                nextStep: { type: 'string', example: 'setup-password' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Session invalide, expirée, OTP incorrect ou expiré' })
    @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
    async verifyRegistrationOtp(@Body() verifyOtpDto: VerifyRegistrationOtpDto) {
        return this.authService.verifyRegistrationOtp(verifyOtpDto.sessionToken, verifyOtpDto.otp);
    }

    @Post('register/client/step3')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Inscription client - Étape 3 (Finalisation)',
        description: 'Troisième étape : Mot de passe, Confirmation, Acceptation des conditions. Finalise l\'inscription et retourne les tokens JWT.'
    })
    @ApiBody({ type: RegisterClientStep3Dto })
    @ApiResponse({
        status: 201,
        description: 'Inscription réussie',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Inscription réussie' },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        email: { type: 'string' },
                        phone: { type: 'string' },
                        role: { type: 'string', example: 'CLIENT' },
                        isActive: { type: 'boolean' },
                        isEmailVerified: { type: 'boolean' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Session invalide, expirée, mots de passe ne correspondent pas, ou conditions non acceptées' })
    @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
    async registerClientStep3(
        @Body() step3Dto: RegisterClientStep3Dto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.registerClientStep3(step3Dto, ipAddress);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(LocalAuthGuard)
    @ApiOperation({
        summary: 'Connexion (tous types)',
        description: 'Connexion par email et mot de passe. Le rôle (Admin, Client, Organisation) est déterminé automatiquement selon l\'utilisateur en base.',
    })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'Connexion réussie',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string' },
                        type: { type: 'string' },
                        organisationId: { type: 'string' },
                        organisationRole: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect' })
    async login(@Body() loginDto: LoginDto, @IpAddress() ipAddress: string) {
        return this.authService.login(loginDto, ipAddress);
    }

    @Post('login/admin')
    @HttpCode(HttpStatus.OK)
    @UseGuards(LocalAuthGuard)
    @ApiOperation({
        summary: 'Connexion d\'un administrateur',
        description: 'Endpoint réservé aux utilisateurs avec le rôle ADMIN'
    })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'Connexion réussie',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', example: 'ADMIN' },
                        type: { type: 'string' },
                        organisationId: { type: 'string' },
                        organisationRole: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect, ou rôle non autorisé' })
    async loginAdmin(@Body() loginDto: LoginDto, @IpAddress() ipAddress: string) {
        return this.authService.login(loginDto, ipAddress, UserRole.ADMIN);
    }

    @Post('login/client')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Connexion d\'un client',
        description: 'Endpoint réservé aux utilisateurs avec le rôle CLIENT. Permet de se connecter avec l\'email OU le numéro de téléphone.'
    })
    @ApiBody({ type: LoginClientDto })
    @ApiResponse({
        status: 200,
        description: 'Connexion réussie',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', example: 'CLIENT' },
                        type: { type: 'string' },
                        organisationId: { type: 'string' },
                        organisationRole: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Email/téléphone ou mot de passe incorrect, ou rôle non autorisé' })
    async loginClient(@Body() loginDto: LoginClientDto, @IpAddress() ipAddress: string) {
        return this.authService.loginClient(loginDto, ipAddress);
    }

    @Post('login/organisation')
    @HttpCode(HttpStatus.OK)
    @UseGuards(LocalAuthGuard)
    @ApiOperation({
        summary: 'Connexion d\'une organisation',
        description: 'Endpoint réservé aux utilisateurs avec le rôle ORGANISATION'
    })
    @ApiBody({ type: LoginDto })
    @ApiResponse({
        status: 200,
        description: 'Connexion réussie',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', example: 'ORGANISATION' },
                        type: { type: 'string' },
                        organisationId: { type: 'string' },
                        organisationRole: { type: 'string' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Email ou mot de passe incorrect, ou rôle non autorisé' })
    async loginOrganisation(@Body() loginDto: LoginDto, @IpAddress() ipAddress: string) {
        return this.authService.login(loginDto, ipAddress, UserRole.ORGANISATION);
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Rafraîchir le token d\'accès' })
    @ApiBody({ type: RefreshTokenDto })
    @ApiResponse({
        status: 200,
        description: 'Token rafraîchi avec succès',
        schema: {
            type: 'object',
            properties: {
                accessToken: { type: 'string' },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Token de rafraîchissement invalide' })
    async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
        return this.authService.refreshToken(refreshTokenDto.refreshToken);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ summary: 'Déconnexion de l\'utilisateur' })
    @ApiResponse({
        status: 200,
        description: 'Déconnexion réussie',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Déconnexion réussie' },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Non autorisé' })
    async logout(@CurrentUser() user: any) {
        return this.authService.logout(user.userId);
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({
        summary: 'Obtenir le profil de l\'utilisateur connecté',
        description: 'Retourne les informations personnelles de l\'utilisateur selon son rôle :\n' +
            '- ADMIN : Informations complètes + statistiques globales\n' +
            '- ORGANISATION : Informations personnelles + organisation + utilisateurs + demandes\n' +
            '- CLIENT : Informations personnelles + demandes + pourcentage de complétion'
    })
    @ApiResponse({
        status: 200,
        description: 'Profil utilisateur avec informations spécifiques au rôle',
        schema: {
            type: 'object',
            properties: {
                // Informations de base communes
                id: { type: 'string' },
                name: { type: 'string' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                email: { type: 'string' },
                phone: { type: 'string' },
                role: { type: 'string', enum: ['ADMIN', 'ORGANISATION', 'CLIENT'] },
                type: { type: 'string' },
                organisationId: { type: 'string' },
                organisationRole: { type: 'string' },
                isActive: { type: 'boolean' },
                isEmailVerified: { type: 'boolean' },
                lastLogin: { type: 'string', format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                // Pour ADMIN
                adminStatistics: {
                    type: 'object',
                    description: 'Statistiques globales (uniquement pour ADMIN)',
                    properties: {
                        totalUsers: { type: 'number' },
                        totalOrganisations: { type: 'number' },
                        totalRequests: { type: 'number' },
                        activeUsers: { type: 'number' },
                        activeOrganisations: { type: 'number' },
                    },
                },
                // Pour ORGANISATION
                organisation: {
                    type: 'object',
                    description: 'Informations de l\'organisation (uniquement pour ORGANISATION)',
                },
                organisationUsers: {
                    type: 'array',
                    description: 'Liste des utilisateurs de l\'organisation (uniquement pour ORGANISATION)',
                },
                organisationStatistics: {
                    type: 'object',
                    description: 'Statistiques de l\'organisation (uniquement pour ORGANISATION)',
                },
                recentRequests: {
                    type: 'array',
                    description: 'Dernières demandes de l\'organisation (uniquement pour ORGANISATION)',
                },
                // Pour CLIENT
                requests: {
                    type: 'array',
                    description: 'Liste des demandes du client (uniquement pour CLIENT)',
                },
                clientStatistics: {
                    type: 'object',
                    description: 'Statistiques des demandes (uniquement pour CLIENT)',
                    properties: {
                        totalRequests: { type: 'number' },
                        pendingRequests: { type: 'number' },
                        validatedRequests: { type: 'number' },
                        rejectedRequests: { type: 'number' },
                        inProgressRequests: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 401, description: 'Non autorisé - Token JWT requis' })
    @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
    async getProfile(@CurrentUser() user: any) {
        return this.authService.getProfile(user.userId);
    }


    @Post('forget-password/request')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Demander une réinitialisation de mot de passe (envoi de code otp)',
        description: 'Envoie un code OTP par email à l\'utilisateur'
    })
    @ApiBody({ type: ForgotPasswordRequestDto })
    @ApiResponse({
        status: 200,
        description: 'Si l\'email existe, un code OTP a été envoyé',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Si cet email existe, un code OTP a été envoyé' },
                otp: { type: 'string', description: 'Code OTP (uniquement en développement)' },
                expiresIn: { type: 'string', example: '10 minutes' },
            },
        },
    })
    async forgotPasswordRequest(
        @Body() forgotPasswordRequestDto: ForgotPasswordRequestDto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.forgotPasswordRequest(forgotPasswordRequestDto.email, ipAddress);
    }

    @Post('forget-password/resend-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Renvoyer le code OTP',
        description: 'Renvoie un nouveau code OTP pour la réinitialisation du mot de passe'
    })
    @ApiBody({ type: ResendOtpDto })
    @ApiResponse({
        status: 200,
        description: 'Si l\'email existe, un nouveau code OTP a été envoyé',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Si cet email existe, un nouveau code OTP a été envoyé' },
                otp: { type: 'string', description: 'Code OTP (uniquement en développement)' },
                expiresIn: { type: 'string', example: '10 minutes' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Veuillez attendre avant de demander un nouveau code' })
    async resendOtp(
        @Body() resendOtpDto: ResendOtpDto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.resendOtp(resendOtpDto.email, ipAddress);
    }

    @Post('forget-password/verify-otp')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Vérifier le code OTP',
        description: 'Vérifie le code OTP reçu par email avant de permettre la réinitialisation'
    })
    @ApiBody({ type: VerifyOtpDto })
    @ApiResponse({
        status: 200,
        description: 'Code OTP vérifié avec succès',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Code OTP vérifié avec succès' },
                verified: { type: 'boolean', example: true },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Code OTP incorrect, expiré ou déjà utilisé' })
    async verifyOtp(
        @Body() verifyOtpDto: VerifyOtpDto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otp, ipAddress);
    }

    @Post('forget-password/reset')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Réinitialiser le mot de passe',
        description: 'Réinitialise le mot de passe après vérification du code OTP. Les mots de passe doivent correspondre.'
    })
    @ApiBody({ type: ResetPasswordOtpDto })
    @ApiResponse({
        status: 200,
        description: 'Mot de passe réinitialisé avec succès',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Mot de passe réinitialisé avec succès' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Code OTP incorrect, expiré, non vérifié, ou mots de passe ne correspondent pas' })
    @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
    async resetPasswordWithOtp(
        @Body() resetPasswordOtpDto: ResetPasswordOtpDto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.resetPasswordWithOtp(
            resetPasswordOtpDto.email,
            resetPasswordOtpDto.otp,
            resetPasswordOtpDto.newPassword,
            resetPasswordOtpDto.confirmPassword,
            ipAddress,
        );
    }

    @Get('verify-email/:token')
    @ApiOperation({ summary: 'Vérifier l\'email d\'un utilisateur' })
    @ApiResponse({
        status: 200,
        description: 'Email vérifié avec succès',
    })
    @ApiResponse({ status: 400, description: 'Token invalide' })
    async verifyEmail(@Param('token') token: string) {
        // TODO: Implémenter la vérification d'email
        return {
            message: 'Email vérifié avec succès',
        };
    }

    @Post('setup-password')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Créer le mot de passe après inscription',
        description: 'Crée le mot de passe pour un compte en attente de création de mot de passe. Active le compte et retourne les tokens JWT.'
    })
    @ApiBody({ type: SetupPasswordDto })
    @ApiResponse({
        status: 200,
        description: 'Mot de passe créé avec succès. Le compte est maintenant actif.',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Mot de passe créé avec succès. Votre compte est maintenant actif.' },
                accessToken: { type: 'string' },
                refreshToken: { type: 'string' },
                user: {
                    type: 'object',
                    properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', example: 'CLIENT' },
                        isActive: { type: 'boolean', example: true },
                    },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Token invalide, expiré, ou mots de passe ne correspondent pas' })
    @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
    async setupPassword(
        @Body() setupPasswordDto: SetupPasswordDto,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.setupPassword(setupPasswordDto, ipAddress);
    }

    @Get('verify-password-setup-token')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Vérifier le token de création de mot de passe',
        description: 'Vérifie si le token de création de mot de passe est valide. Utilisé par le frontend pour afficher le formulaire de création de mot de passe. Appelé avec ?token=xxx'
    })
    @ApiResponse({
        status: 200,
        description: 'Token valide. Le frontend peut afficher le formulaire de création de mot de passe.',
        schema: {
            type: 'object',
            properties: {
                valid: { type: 'boolean', example: true },
                email: { type: 'string', example: 'user@example.com' },
                userName: { type: 'string', example: 'John Doe' },
                message: { type: 'string', example: 'Token valide. Vous pouvez maintenant créer votre mot de passe.' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Token invalide, expiré, ou compte déjà actif' })
    @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
    async verifyPasswordSetupToken(@Query('token') token: string) {
        if (!token) {
            throw new BadRequestException('Token requis');
        }
        return this.authService.verifyPasswordSetupToken(token);
    }

    @Post('resend-password-setup-link')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Renvoyer le lien de création de mot de passe',
        description: 'Renvoie le lien de création de mot de passe par email pour un compte en attente.'
    })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                email: {
                    type: 'string',
                    example: 'user@example.com',
                    description: 'Email du compte en attente de création de mot de passe',
                },
            },
            required: ['email'],
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Un nouveau lien de création de mot de passe a été envoyé',
        schema: {
            type: 'object',
            properties: {
                message: { type: 'string', example: 'Un nouveau lien de création de mot de passe a été envoyé à votre adresse email' },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Ce compte n\'est pas en attente de création de mot de passe' })
    async resendPasswordSetupLink(
        @Body('email') email: string,
        @IpAddress() ipAddress: string,
    ) {
        return this.authService.resendPasswordSetupLink(email, ipAddress);
    }
}

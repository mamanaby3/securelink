import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { UpdateSecuritySettingsDto } from './dto/update-security-settings.dto';
import { SecuritySettings } from './entities/security-settings.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/dto/register.dto';

@Controller('security')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Admin')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Obtenir les paramètres de sécurité',
    description: `Récupère les paramètres de sécurité configurés par l'administrateur.

**Paramètres disponibles :**
- \`sessionExpirationMinutes\` : Durée d'expiration de session (en minutes)
- \`maxLoginAttempts\` : Nombre maximum de tentatives de connexion
- \`lockoutDurationMinutes\` : Durée de verrouillage après échecs
- \`requireEmailVerification\` : Exiger la vérification d'email
- \`requireDocumentsForRegistration\` : Exiger des documents pour l'inscription
- \`requiredDocumentsForRegistration\` : Liste des IDs des documents requis

**Rôle requis : ADMIN**`,
  })
  @ApiResponse({
    status: 200,
    description: 'Paramètres de sécurité',
    type: SecuritySettings,
  })
  async getSettings(): Promise<SecuritySettings> {
    return await this.securityService.getSettings();
  }

  @Patch('settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Mettre à jour les paramètres de sécurité',
    description: `Met à jour les paramètres de sécurité. Tous les champs sont optionnels.

**Exemple :** Si l'admin définit \`sessionExpirationMinutes: 15\`, tous les utilisateurs connectés devront se reconnecter après 15 minutes d'inactivité.

**Rôle requis : ADMIN**`,
  })
  @ApiResponse({
    status: 200,
    description: 'Paramètres mis à jour avec succès',
    type: SecuritySettings,
  })
  async updateSettings(
    @Body() updateDto: UpdateSecuritySettingsDto,
  ): Promise<SecuritySettings> {
    return await this.securityService.updateSettings(updateDto);
  }
}

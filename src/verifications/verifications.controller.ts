import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { VerificationsService } from './verifications.service';
import { VerifyDocumentDto } from './dto/verify-document.dto';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { RequestAdditionalDto } from './dto/request-additional.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';


@Controller('verifications')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class VerificationsController {
  constructor(private readonly verificationsService: VerificationsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer une nouvelle vérification de document' })
  @ApiResponse({ status: 201, description: 'Vérification créée' })
  create(@Body() verifyDocumentDto: VerifyDocumentDto) {
    return this.verificationsService.create(verifyDocumentDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin')
  @ApiOperation({ summary: 'Obtenir la liste des vérifications' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut' })
  @ApiQuery({ name: 'sector', required: false, description: 'Filtrer par secteur' })
  @ApiResponse({ status: 200, description: 'Liste des vérifications' })
  findAll(@Query('status') status?: string, @Query('sector') sector?: string) {
    return this.verificationsService.findAll(status, sector);
  }

  @Get('statistics')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des vérifications',
    description: 'Obtenir les statistiques globales des vérifications de documents. **Rôle requis : ADMIN**'
  })
  @ApiResponse({ status: 200, description: 'Statistiques des vérifications' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  getStatistics() {
    return this.verificationsService.getStatistics();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin')
  @ApiOperation({ summary: 'Obtenir les détails d\'une vérification' })
  @ApiParam({ name: 'id', description: 'ID de la vérification' })
  @ApiResponse({ status: 200, description: 'Détails de la vérification' })
  @ApiResponse({ status: 404, description: 'Vérification non trouvée' })
  findOne(@Param('id') id: string) {
    return this.verificationsService.findOne(id);
  }

  @Patch(':id/validate')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Valider un document',
    description: `Valider définitivement un document après vérification. 

**Note :** L'\`id\` peut être soit :
- L'ID de la vérification (recommandé)
- L'ID du document (UserDocument). Dans ce cas, une vérification sera créée automatiquement si elle n'existe pas.

**Rôles requis : ADMIN ou ORGANISATION (SUPERVISEUR/ADMINISTRATION)**`
  })
  @ApiParam({ name: 'id', description: 'ID de la vérification ou ID du document (UserDocument)' })
  @ApiResponse({ status: 200, description: 'Document validé avec succès' })
  @ApiResponse({ status: 404, description: 'Vérification ou document non trouvé' })
  validate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.verificationsService.validate(id, user.userId);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Rejeter un document',
    description: 'Rejeter un document avec un motif. Le demandeur recevra cette information par email. **Rôles requis : ADMIN ou ORGANISATION (SUPERVISEUR/ADMINISTRATION)**'
  })
  @ApiParam({ name: 'id', description: 'ID de la vérification' })
  @ApiResponse({ status: 200, description: 'Document rejeté avec succès' })
  @ApiResponse({ status: 404, description: 'Vérification non trouvée' })
  reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() rejectDto: RejectDocumentDto,
  ) {
    return this.verificationsService.reject(id, user.userId, rejectDto);
  }

  @Patch(':id/request-additional')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin')
  @ApiOperation({ 
    summary: 'Demander des informations complémentaires',
    description: 'Demander au client de fournir des informations complémentaires ou de corriger le document. Vous pouvez sélectionner une ou plusieurs raisons prédéfinies et ajouter un message optionnel. **Rôles requis : ADMIN ou ORGANISATION (SUPERVISEUR/ADMINISTRATION)**'
  })
  @ApiParam({ name: 'id', description: 'ID de la vérification' })
  @ApiResponse({ status: 200, description: 'Demande envoyée avec succès' })
  @ApiResponse({ status: 404, description: 'Vérification non trouvée' })
  requestAdditional(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() requestDto: RequestAdditionalDto,
  ) {
    return this.verificationsService.requestAdditionalInfo(id, user.userId, requestDto);
  }
}




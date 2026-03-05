import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CreateSectorDto } from './dto/create-sector.dto';
import { CreateFormTypeDto } from './dto/create-form-type.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';

@ApiTags('Admin')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Sectors
  @Post('sectors')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau secteur' })
  @ApiResponse({ status: 201, description: 'Secteur créé' })
  async createSector(@Body() createSectorDto: CreateSectorDto) {
    return this.settingsService.createSector(createSectorDto);
  }

  @Get('sectors')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir la liste des secteurs' })
  @ApiResponse({ status: 200, description: 'Liste des secteurs' })
  async findAllSectors() {
    return this.settingsService.findAllSectors();
  }

  @Get('sectors/:id')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir un secteur' })
  @ApiParam({ name: 'id', description: 'ID du secteur' })
  @ApiResponse({ status: 200, description: 'Secteur' })
  async findOneSector(@Param('id') id: string) {
    return this.settingsService.findOneSector(id);
  }

  @Patch('sectors/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un secteur' })
  @ApiParam({ name: 'id', description: 'ID du secteur' })
  @ApiResponse({ status: 200, description: 'Secteur modifié' })
  async updateSector(@Param('id') id: string, @Body() updateSectorDto: CreateSectorDto) {
    return this.settingsService.updateSector(id, updateSectorDto);
  }

  @Delete('sectors/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un secteur' })
  @ApiParam({ name: 'id', description: 'ID du secteur' })
  @ApiResponse({ status: 204, description: 'Secteur supprimé' })
  async removeSector(@Param('id') id: string) {
    return this.settingsService.removeSector(id);
  }

  // Form Types
  @Post('form-types')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau type de formulaire' })
  @ApiResponse({ status: 201, description: 'Type de formulaire créé' })
  async createFormType(@Body() createFormTypeDto: CreateFormTypeDto) {
    return this.settingsService.createFormType(createFormTypeDto);
  }

  @Get('form-types')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir la liste des types de formulaires' })
  @ApiResponse({ status: 200, description: 'Liste des types de formulaires' })
  async findAllFormTypes() {
    return this.settingsService.findAllFormTypes();
  }

  @Get('form-types/:id')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir un type de formulaire' })
  @ApiParam({ name: 'id', description: 'ID du type de formulaire' })
  @ApiResponse({ status: 200, description: 'Type de formulaire' })
  async findOneFormType(@Param('id') id: string) {
    return this.settingsService.findOneFormType(id);
  }

  @Patch('form-types/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un type de formulaire' })
  @ApiParam({ name: 'id', description: 'ID du type de formulaire' })
  @ApiResponse({ status: 200, description: 'Type de formulaire modifié' })
  async updateFormType(@Param('id') id: string, @Body() updateFormTypeDto: CreateFormTypeDto) {
    return this.settingsService.updateFormType(id, updateFormTypeDto);
  }

  @Delete('form-types/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un type de formulaire' })
  @ApiParam({ name: 'id', description: 'ID du type de formulaire' })
  @ApiResponse({ status: 204, description: 'Type de formulaire supprimé' })
  async removeFormType(@Param('id') id: string) {
    return this.settingsService.removeFormType(id);
  }

  // Roles
  @Post('roles')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Créer un nouveau rôle' })
  @ApiResponse({ status: 201, description: 'Rôle créé' })
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.settingsService.createRole(createRoleDto);
  }

  @Get('roles')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir la liste des rôles' })
  @ApiResponse({ status: 200, description: 'Liste des rôles' })
  async findAllRoles() {
    return this.settingsService.findAllRoles();
  }

  @Get('roles/:id')
  @Roles(UserRole.ADMIN)
  @OrganisationRoles(OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiOperation({ summary: 'Obtenir un rôle' })
  @ApiParam({ name: 'id', description: 'ID du rôle' })
  @ApiResponse({ status: 200, description: 'Rôle' })
  async findOneRole(@Param('id') id: string) {
    return this.settingsService.findOneRole(id);
  }

  @Patch('roles/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un rôle' })
  @ApiParam({ name: 'id', description: 'ID du rôle' })
  @ApiResponse({ status: 200, description: 'Rôle modifié' })
  async updateRole(@Param('id') id: string, @Body() updateRoleDto: CreateRoleDto) {
    return this.settingsService.updateRole(id, updateRoleDto);
  }

  @Delete('roles/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un rôle' })
  @ApiParam({ name: 'id', description: 'ID du rôle' })
  @ApiResponse({ status: 204, description: 'Rôle supprimé' })
  async removeRole(@Param('id') id: string) {
    return this.settingsService.removeRole(id);
  }
}




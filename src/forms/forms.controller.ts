import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Patch,
  UploadedFile,
  UseInterceptors,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormFieldsDto } from './dto/update-form-fields.dto';
import { FormStatus } from './entities/form.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrganisationRoles } from '../auth/decorators/organisation-roles.decorator';
import { OrganisationRoleGuard } from '../auth/guards/organisation-role.guard';
import { UserRole, OrganisationRole } from '../auth/dto/register.dto';
import { BadRequestException } from '@nestjs/common';


@Controller('forms')
@UseGuards(JwtAuthGuard, RolesGuard, OrganisationRoleGuard)
@ApiBearerAuth('JWT-auth')
export class FormsController {
  constructor(private readonly formsService: FormsService) { }

  @Get('create-options')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Obtenir les options pour créer un formulaire',
    description: `Retourne toutes les options nécessaires pour créer un formulaire :
- Secteurs disponibles (depuis les organisations enregistrées)
- Types de formulaires disponibles
- Organisations disponibles

**Rôle requis : ADMIN**`
  })
  @ApiResponse({
    status: 200,
    description: 'Options pour créer un formulaire',
        schema: {
          type: 'object',
          properties: {
            sectors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'string', example: 'BANQUE' },
                  label: { type: 'string', example: 'Banque' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
            formTypes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'string', example: 'TRANSACTION' },
                  label: { type: 'string', example: 'Transaction' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
            roles: {
              type: 'array',
              description: 'Rôles principaux (ADMIN, CLIENT, ORGANISATION)',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  value: { type: 'string', example: 'ADMIN' },
                  label: { type: 'string', example: 'Administrateur' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
            organisationRoles: {
              type: 'array',
              description: 'Rôles d\'organisation (ADMINISTRATION, SUPERVISEUR, AGENT) - utilisés uniquement pour les utilisateurs avec role=ORGANISATION',
              items: {
                type: 'object',
                properties: {
                  value: { type: 'string', example: 'ADMINISTRATION' },
                  label: { type: 'string', example: 'Administration' },
                  description: { type: 'string', nullable: true },
                },
              },
            },
            documentTypes: {
              type: 'array',
              description: 'Types de documents disponibles depuis la base de données (table document_types)',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid', description: 'ID du type de document' },
                  title: { type: 'string', description: 'Titre du type de document' },
                  hasExpirationDate: { type: 'boolean', description: 'Le document a-t-il une date d\'expiration ?' },
                  isForIdentityVerification: { type: 'boolean', description: 'Le document sert-il à vérifier l\'identité ?' },
                },
              },
            },
            organisations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  sector: { type: 'string' },
                },
              },
            },
          },
        },
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  async getCreateOptions() {
    return this.formsService.getCreateOptions();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('pdfFile'))
  @ApiTags('Admin')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Créer un nouveau formulaire (en une seule étape)',
    description: `**Création complète du formulaire en une seule étape**

Créer un nouveau formulaire pour une organisation avec toutes les informations :
- Informations de base (nom, version, description, secteur, type, organisation)
- Fichier PDF du modèle (optionnel - peut être ajouté plus tard)
- Documents requis (optionnel)

**Processus automatique :**
1.   un PDF est fourni 
2. Le formulaire est créé avec le statut DRAFT
3. Tous les détails sont retournés (organisation, documents requis avec leurs détails)

**Format :** multipart/form-data

**Rôle requis : ADMIN uniquement**`
  })
  @ApiBody({
    schema: {
      type: 'object',
            required: ['name', 'version', 'sectorId', 'formTypeId', 'organisationId'],
      properties: {
        name: { type: 'string', example: 'Demande de virement' },
        version: { type: 'string', example: '1.0' },
        description: { type: 'string', example: 'Formulaire pour effectuer un virement bancaire' },
        sectorId: { type: 'string', format: 'uuid', description: 'ID du secteur d\'activité (depuis la base de données)', example: 'sector-uuid-123' },
        formTypeId: { type: 'string', format: 'uuid', description: 'ID du type de formulaire (depuis la base de données)', example: 'form-type-uuid-123' },
        organisationId: { type: 'string', example: 'org-123' },
        requiredDocuments: { 
          type: 'string', 
          description: 'IDs des types de documents requis depuis la base de données (table document_types), séparés par des virgules (ex: "doc-type-uuid-1,doc-type-uuid-2"). Utilisez GET /api/forms/create-options pour obtenir la liste des types de documents disponibles.',
          example: 'doc-type-uuid-1,doc-type-uuid-2'
        },
        pdfFile: {
          type: 'string',
          format: 'binary',
          description: 'Fichier PDF du formulaire (optionnel, max 10 MB)',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Formulaire créé avec succès avec tous les détails',
  })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  @ApiResponse({ status: 400, description: 'Données invalides ou PDF invalide' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createFormDto: any,
    @UploadedFile() pdfFile?: any,
  ) {
    // Parser les documents requis si fournis
    let requiredDocuments: string[] = [];
    if (createFormDto.requiredDocuments) {
      if (typeof createFormDto.requiredDocuments === 'string') {
        requiredDocuments = createFormDto.requiredDocuments
          .split(',')
          .map((id: string) => id.trim())
          .filter((id: string) => id.length > 0);
      } else if (Array.isArray(createFormDto.requiredDocuments)) {
        requiredDocuments = createFormDto.requiredDocuments;
      }
    }

    const formData = {
      name: createFormDto.name,
      version: createFormDto.version,
      description: createFormDto.description,
      sectorId: createFormDto.sectorId,
      formTypeId: createFormDto.formTypeId,
      organisationId: createFormDto.organisationId,
      requiredDocuments,
    };

    return this.formsService.create(formData, pdfFile);
  }

  @Post(':id/upload-pdf')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiTags('Admin')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Téléverser le modèle PDF et extraire les champs automatiquement',
    description: `**Téléversement du PDF avec extraction automatique des champs**

Téléverse le modèle PDF du formulaire et extrait automatiquement tous les champs de formulaire présents dans le PDF.

**Processus :**
1. Le PDF est enregistré sur le serveur (dans \`uploads/forms/\`)
2. Les champs du PDF sont automatiquement extraits (text, checkbox, radio, select, etc.)
3. Les champs extraits sont retournés pour que l'admin puisse les ajuster si nécessaire

**Note :** Le PDF enregistré sera celui que les clients pourront remplir plus tard.

**Rôle requis : ADMIN uniquement**`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Fichier PDF du formulaire (max 10 MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'PDF téléversé avec succès et champs extraits',
    schema: {
      type: 'object',
      properties: {
        form: { type: 'object', description: 'Formulaire mis à jour' },
        extractedFields: {
          type: 'array',
          description: 'Champs extraits automatiquement du PDF',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'beneficiary_name' },
              type: { type: 'string', example: 'text' },
              label: { type: 'string', example: 'beneficiary_name' },
              required: { type: 'boolean', example: false },
              placeholder: { type: 'string', example: '' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Fichier invalide (doit être un PDF, max 10 MB)' })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  async uploadPdf(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return this.formsService.uploadPdfTemplate(id, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin', 'Organisations', 'Clients')
  @ApiOperation({
    summary: 'Télécharger le PDF du formulaire',
    description: `**Récupérer le PDF du formulaire**

Permet de télécharger le PDF du formulaire. Ce PDF peut être :
- **Pour ADMIN/ORGANISATION :** Le modèle original du formulaire
- **Pour CLIENT :** Le PDF à remplir pour créer une demande

**Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION), CLIENT`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({ status: 200, description: 'Fichier PDF', content: { 'application/pdf': {} } })
  @ApiResponse({ status: 404, description: 'Formulaire ou PDF non trouvé' })
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const { buffer, fileName, contentType } = await this.formsService.getPdfFile(id);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.send(buffer);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin', 'Organisations', 'Clients')
  @ApiOperation({
    summary: 'Obtenir la liste de tous les formulaires',
    description: 'Liste tous les formulaires disponibles avec possibilité de filtrer par organisation, statut ou secteur. **Pour ADMIN:** Permet de voir tous les formulaires de toutes les organisations. **Pour ORGANISATION:** Permet de voir les formulaires de leur organisation. **Pour CLIENT:** Permet de voir les formulaires disponibles pour créer des demandes. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION), CLIENT'
  })
  @ApiQuery({ name: 'organisationId', required: false, description: 'Filtrer par organisation' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut (ONLINE, OFFLINE, DRAFT)' })
  @ApiQuery({ name: 'sector', required: false, description: 'Filtrer par secteur (BANQUE, NOTAIRE, ASSURANCE, HUISSIER)' })
  @ApiResponse({
    status: 200,
    description: 'Liste des formulaires',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', example: 'Demande de virement' },
          version: { type: 'string', example: '2.1' },
          formType: { type: 'string', example: 'TRANSACTION' },
          status: { type: 'string', example: 'ONLINE' },
          organisationId: { type: 'string', nullable: true },
          organisationName: { type: 'string', nullable: true },
          sector: { type: 'string', example: 'BANQUE' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  findAll(
    @Query('organisationId') organisationId?: string,
    @Query('status') status?: string,
    @Query('sector') sector?: string,
  ) {
    if (organisationId) {
      return this.formsService.findByOrganisation(organisationId);
    }
    return this.formsService.findAll();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.ORGANISATION, UserRole.CLIENT)
  @OrganisationRoles(OrganisationRole.AGENT, OrganisationRole.SUPERVISEUR, OrganisationRole.ADMINISTRATION)
  @ApiTags('Admin', 'Organisations', 'Clients')
  @ApiOperation({
    summary: 'Obtenir les détails complets d\'un formulaire',
    description: 'Retourne tous les détails d\'un formulaire incluant : nom, version, description, type, statut, champs modifiables, documents requis, modèle PDF. **Pour ADMIN:** Permet de voir les détails de n\'importe quel formulaire. **Pour ORGANISATION:** Permet de voir les détails des formulaires de leur organisation. **Pour CLIENT:** Permet de voir les détails des formulaires disponibles. **Rôles autorisés:** ADMIN, ORGANISATION (avec AGENT/SUPERVISEUR/ADMINISTRATION), CLIENT'
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({
    status: 200,
    description: 'Détails complets du formulaire',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string', example: 'Demande de virement' },
        version: { type: 'string', example: '1.0' },
        description: { type: 'string', example: 'Formulaire pour effectuer un virement bancaire' },
        sector: { type: 'string', example: 'BANQUE' },
        formType: { type: 'string', example: 'TRANSACTION' },
        status: { type: 'string', example: 'ONLINE' },
        editableFields: {
          type: 'array',
          description: 'Liste des champs modifiables du formulaire',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'Nom du bénéficiaire' },
              type: { type: 'string', example: 'text' },
              required: { type: 'boolean' },
            },
          },
          example: [
            { name: 'Nom du bénéficiaire', type: 'text', required: true },
            { name: 'Montant', type: 'number', required: true },
            { name: 'IBAN', type: 'text', required: true },
          ],
        },
        requiredDocuments: {
          type: 'array',
          description: 'Liste des IDs des documents requis',
          items: { type: 'string' },
          example: ['doc-1', 'doc-2'],
        },
        pdfTemplate: { type: 'string', description: 'URL ou base64 du modèle PDF' },
        organisationId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ORGANISATION)
  @OrganisationRoles(OrganisationRole.ADMINISTRATION, OrganisationRole.SUPERVISEUR)
  @ApiTags('Organisations')
  @ApiOperation({
    summary: 'Mettre à jour le statut d\'un formulaire (ONLINE/OFFLINE)',
    description: `Mettre à jour le statut d'un formulaire (ONLINE ou OFFLINE). 
    
**Important :** 
- Seuls les formulaires **activés par l'admin** peuvent être mis en ligne
- Un formulaire désactivé ne peut pas être mis ONLINE
- L'organisation peut uniquement changer entre ONLINE et OFFLINE

**Rôle requis : ORGANISATION (ADMINISTRATION ou SUPERVISEUR)**`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: ['ONLINE', 'OFFLINE', 'DRAFT'],
          example: 'ONLINE',
          description: 'Nouveau statut du formulaire'
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Formulaire mis à jour avec succès',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'form-123' },
        name: { type: 'string', example: 'Demande de virement' },
        version: { type: 'string', example: '1.0.0' },
        description: { type: 'string', nullable: true, example: 'Formulaire pour effectuer des virements bancaires' },
        sector: { 
          type: 'string', 
          enum: ['BANQUE', 'NOTAIRE', 'ASSURANCE', 'HUISSIER'],
          example: 'BANQUE'
        },
        formType: { 
          type: 'string', 
          enum: ['TRANSACTION', 'DEMANDE', 'DECLARATION', 'RESILIATION'],
          example: 'TRANSACTION'
        },
        organisationId: { type: 'string', example: 'org-456' },
        organisation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            sector: { type: 'string' },
          },
          nullable: true,
          description: 'Informations de l\'organisation propriétaire'
        },
        pdfTemplate: { type: 'string', nullable: true, description: 'Base64 ou URL du PDF (déprécié)' },
        pdfFilePath: { type: 'string', nullable: true, example: 'uploads/forms/form-123/template.pdf' },
        pdfFileName: { type: 'string', nullable: true, example: 'template.pdf' },
        editableFields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              required: { type: 'boolean' },
              label: { type: 'string' },
              placeholder: { type: 'string', nullable: true },
              x: { type: 'number', nullable: true },
              y: { type: 'number', nullable: true },
              width: { type: 'number', nullable: true },
              height: { type: 'number', nullable: true },
              page: { type: 'number', nullable: true },
            },
          },
          nullable: true,
          description: 'Champs modifiables du formulaire'
        },
        requiredDocuments: {
          type: 'array',
          items: { type: 'string' },
          example: ['CARTE_IDENTITE', 'JUSTIFICATIF_DOMICILE'],
          description: 'Liste des types de documents requis'
        },
        status: { 
          type: 'string', 
          enum: ['ONLINE', 'OFFLINE', 'DRAFT'],
          example: 'ONLINE',
          description: 'Statut actuel du formulaire (mis à jour)'
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ORGANISATION requis' })
  @ApiResponse({ status: 400, description: 'Statut invalide ou formulaire non activé' })
  updateStatus(@Param('id') id: string, @Body('status') status: FormStatus) {
    return this.formsService.updateStatus(id, status);
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Activer un formulaire',
    description: `Active un formulaire créé par l'admin. Un formulaire doit être activé avant que l'organisation puisse le mettre en ligne (ONLINE).

**Rôle requis : ADMIN**`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({
    status: 200,
    description: 'Formulaire activé avec succès',
  })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  activateForm(@Param('id') id: string) {
    return this.formsService.activate(id);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Désactiver un formulaire',
    description: `Désactive un formulaire. Un formulaire désactivé ne peut pas être mis en ligne (ONLINE) par l'organisation.

**Rôle requis : ADMIN**`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({
    status: 200,
    description: 'Formulaire désactivé avec succès',
  })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  deactivateForm(@Param('id') id: string) {
    return this.formsService.deactivate(id);
  }

  @Patch(':id/fields')
  @Roles(UserRole.ADMIN)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Ajuster les champs modifiables et définir les documents requis (Étape 2)',
    description: `**Étape 2 : Configuration des champs et documents**

Permet à l'administrateur de :
1. **Ajuster les champs modifiables** (\`editableFields\`) :
   - Si un PDF a été téléversé via \`POST /api/forms/:id/upload-pdf\`, les champs ont été automatiquement extraits
   - L'admin peut maintenant :
     * ✅ Modifier les propriétés des champs extraits (label, placeholder, required, type)
     * ✅ **Ajouter de nouveaux champs manuellement** - Ces nouveaux champs seront **automatiquement ajoutés au PDF**
     * ✅ Supprimer des champs non nécessaires
   
   **Important :** Lorsque vous ajoutez de nouveaux champs, ils doivent inclure les propriétés de position :
   - \`x\`, \`y\` : Position du champ dans le PDF (en points depuis le bas gauche)
   - \`width\`, \`height\` : Dimensions du champ
   - \`page\` : Numéro de page (0 = première page)
   
   **Exemple d'ajout de champ :**
   \`\`\`json
   {
     "name": "numero_telephone",
     "type": "text",
     "label": "Numéro de téléphone",
     "placeholder": "Ex: +221 77 123 45 67",
     "required": true,
     "x": 100,
     "y": 600,
     "width": 200,
     "height": 20,
     "page": 0
   }
   \`\`\`
   
   **Résultat :** Le PDF sera automatiquement mis à jour avec :
   - ✅ Tous les champs originaux du PDF (conservés)
   - ✅ Tous les nouveaux champs ajoutés (insérés dans le PDF)
   - Le client téléchargera le PDF modifié avec tous les champs

2. **Définir les documents requis** (\`requiredDocuments\`) :
   - Liste des IDs des types de documents que les clients doivent fournir pour ce formulaire
   - Exemples : CNI, Certificat de résidence, Relevé bancaire, etc.

**Processus recommandé :**
1. Créer le formulaire avec \`POST /api/forms\`
2. Téléverser le PDF avec \`POST /api/forms/:id/upload-pdf\` (extraction automatique des champs)
3. Utiliser cet endpoint pour :
   - Ajuster les champs extraits
   - **Ajouter de nouveaux champs** (ils seront automatiquement ajoutés au PDF)
4. Mettre le formulaire en ligne avec \`PATCH /api/forms/:id/status\`

**Rôle requis : ADMIN uniquement**`
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({ status: 200, description: 'Champs et documents mis à jour' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  @ApiResponse({ status: 404, description: 'Formulaire non trouvé' })
  updateFields(
    @Param('id') id: string,
    @Body() updateFieldsDto: UpdateFormFieldsDto,
  ) {
    return this.formsService.updateFields(id, updateFieldsDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiTags('Admin')
  @ApiOperation({
    summary: 'Supprimer un formulaire',
    description: 'Supprimer définitivement un formulaire. **Rôle requis : ADMIN**'
  })
  @ApiParam({ name: 'id', description: 'ID du formulaire' })
  @ApiResponse({ status: 204, description: 'Formulaire supprimé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle ADMIN requis' })
  remove(@Param('id') id: string) {
    return this.formsService.remove(id);
  }
}




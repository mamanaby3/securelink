import { OrganisationRole } from '../../auth/dto/register.dto';

export interface RolePermissions {
  role: string;
  permissions: string[];
  description: string;
}

// Permissions pour les rôles au niveau application
export const APPLICATION_ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  ADMIN: {
    role: 'ADMIN',
    permissions: [
      'CONSULTER_DEMANDES',
      'TRAITER_DEMANDES',
      'VALIDATION_FINALE',
      'SUPERVISION_EQUIPE',
      'CREER_FORMULAIRES',
      'GERER_UTILISATEURS',
      'GERER_ORGANISATIONS',
      'VOIR_FORMULAIRES',
      'VOIR_DOCUMENTS',
      'VOIR_STATISTIQUES',
      'GERER_PARAMETRES',
      'VOIR_JOURNAUX_AUDIT',
    ],
    description: 'Super administrateur de la plateforme',
  },
  ORGANISATION: {
    role: 'ORGANISATION',
    permissions: [
      'CONSULTER_DEMANDES',
      'TRAITER_DEMANDES',
      'CREER_FORMULAIRES',
      'GERER_UTILISATEURS_ORG',
      'VOIR_FORMULAIRES',
      'VOIR_DOCUMENTS',
      'VOIR_STATISTIQUES_ORG',
    ],
    description: 'Représentant d\'une organisation',
  },
  CLIENT: {
    role: 'CLIENT',
    permissions: [
      'CREER_DEMANDES',
      'VOIR_MES_DEMANDES',
      'VOIR_MES_DOCUMENTS',
      'VOIR_ARCHIVES',
    ],
    description: 'Utilisateur final',
  },
};

// Permissions pour les rôles au niveau organisation
export const ORGANISATION_ROLE_PERMISSIONS: Record<OrganisationRole, RolePermissions> = {
  [OrganisationRole.AGENT]: {
    role: OrganisationRole.AGENT,
    permissions: [
      'CONSULTER_DEMANDES',
      'TRAITER_DEMANDES',
      'VOIR_FORMULAIRES',
      'VOIR_DOCUMENTS',
    ],
    description: 'Consulter et traiter les demandes',
  },
  [OrganisationRole.SUPERVISEUR]: {
    role: OrganisationRole.SUPERVISEUR,
    permissions: [
      'CONSULTER_DEMANDES',
      'TRAITER_DEMANDES',
      'VALIDATION_FINALE',
      'SUPERVISION_EQUIPE',
      'VOIR_FORMULAIRES',
      'VOIR_DOCUMENTS',
      'VOIR_STATISTIQUES',
    ],
    description: 'Validation finale + Supervision de l\'équipe',
  },
  [OrganisationRole.ADMINISTRATION]: {
    role: OrganisationRole.ADMINISTRATION,
    permissions: [
      'CONSULTER_DEMANDES',
      'TRAITER_DEMANDES',
      'VALIDATION_FINALE',
      'SUPERVISION_EQUIPE',
      'CREER_FORMULAIRES',
      'GERER_UTILISATEURS_ORG',
      'VOIR_FORMULAIRES',
      'VOIR_DOCUMENTS',
      'VOIR_STATISTIQUES',
    ],
    description: 'Créer des formulaires + Gérer les utilisateurs de l\'organisation',
  },
};

// Rétrocompatibilité (à supprimer progressivement)
export const ROLE_PERMISSIONS = {
  ...APPLICATION_ROLE_PERMISSIONS,
  ...ORGANISATION_ROLE_PERMISSIONS,
};




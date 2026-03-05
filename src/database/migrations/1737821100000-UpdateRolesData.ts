import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateRolesData1737821100000 implements MigrationInterface {
  name = 'UpdateRolesData1737821100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les anciens rôles incorrects
    await queryRunner.query(`
      DELETE FROM roles WHERE name IN ('Administrateur', 'Client', 'Organisation', 'Superviseur');
    `);

    // Insérer les rôles principaux uniquement
    // Les rôles d'organisation (ADMINISTRATION, SUPERVISEUR, AGENT) sont gérés par l'enum OrganisationRole
    // et ne sont pas stockés dans cette table
    await queryRunner.query(`
      INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
      VALUES
        ('ADMIN', 'Administrateur système - Gère l''ensemble de la plateforme : création et suppression de comptes, organisations, formulaires, etc.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('CLIENT', 'Client - Utilisateur externe ou final qui utilise le service ou produit offert par la plateforme.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('ORGANISATION', 'Organisation - Entité qui traite les demandes des clients. Les utilisateurs d''organisation ont des rôles spécifiques (Administration, Superviseur, Agent) gérés par le champ organisationRole.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les nouveaux rôles
    await queryRunner.query(`
      DELETE FROM roles WHERE name IN ('ADMIN', 'CLIENT', 'ORGANISATION');
    `);

    // Restaurer les anciens rôles (si nécessaire)
    await queryRunner.query(`
      INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
      VALUES
        ('Administrateur', 'Gère l''ensemble de la plateforme : création et suppression de comptes...', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Client', 'Utilisateur externe ou final qui utilise le service ou produit offert par la plateforme.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Organisation', 'Planifie et coordonne des événements...', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Superviseur', 'Supervise les utilisateurs, valide les actions importantes et consulte les rapports.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING;
    `);
  }
}


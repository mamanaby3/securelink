import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSettingsTables1737821000000 implements MigrationInterface {
  name = 'CreateSettingsTables1737821000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer la table sectors
    await queryRunner.createTable(
      new Table({
        name: 'sectors',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Créer l'index unique sur name pour sectors
    await queryRunner.createIndex(
      'sectors',
      new TableIndex({
        name: 'IDX_sectors_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // Créer la table form_types
    await queryRunner.createTable(
      new Table({
        name: 'form_types',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Créer l'index unique sur name pour form_types
    await queryRunner.createIndex(
      'form_types',
      new TableIndex({
        name: 'IDX_form_types_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // Créer la table roles
    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Créer l'index unique sur name pour roles
    await queryRunner.createIndex(
      'roles',
      new TableIndex({
        name: 'IDX_roles_name',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // Insérer les données initiales pour sectors
    await queryRunner.query(`
      INSERT INTO sectors (name, description, "isActive", "createdAt", "updatedAt")
      VALUES
        ('Banque', 'Toutes les institutions financières proposant des services bancaires et crédits.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Notaire', 'Études notariales pour actes juridiques et authentifications.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Assurance', 'Compagnies d''assurance vie, santé, auto, habitation, etc.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Huissiers', 'Offices d''huissiers pour constats, recouvrements et notifications.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING;
    `);

    // Insérer les données initiales pour form_types
    await queryRunner.query(`
      INSERT INTO form_types (name, description, "isActive", "createdAt", "updatedAt")
      VALUES
        ('Transaction', 'Permet d''exécuter une opération officielle (paiement, transfert,...)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Demande', 'Sert à solliciter un service ou une action (ouverture de compte, crédit,...)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Déclaration', 'Sert à signaler une situation ou un événement (sinistre, perte, fraude,..)', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('Résiliation', 'Permet d''arrêter un service, un contrat ou un abonnement.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING;
    `);

    // Insérer les données initiales pour roles
    // Rôles principaux : ADMIN, CLIENT, ORGANISATION
    // Rôles d'organisation : ADMINISTRATION, SUPERVISEUR, AGENT
    await queryRunner.query(`
      INSERT INTO roles (name, description, "isActive", "createdAt", "updatedAt")
      VALUES
        ('ADMIN', 'Administrateur système - Gère l''ensemble de la plateforme : création et suppression de comptes, organisations, formulaires, etc.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('CLIENT', 'Client - Utilisateur externe ou final qui utilise le service ou produit offert par la plateforme.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('ORGANISATION', 'Organisation - Entité qui traite les demandes des clients. Les utilisateurs d''organisation ont des rôles spécifiques (Administration, Superviseur, Agent).', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('ADMINISTRATION', 'Administrateur d''organisation - Gère l''organisation : création d''utilisateurs, validation finale, supervision de l''équipe.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('SUPERVISEUR', 'Superviseur d''organisation - Supervise les agents, valide les actions importantes et consulte les rapports.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
        ('AGENT', 'Agent d''organisation - Consulte et traite les demandes des clients.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO NOTHING;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les index (avec vérification)
    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_roles_name"`);
    } catch (e) {
      // Ignorer si l'index n'existe pas
    }
    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_form_types_name"`);
    } catch (e) {
      // Ignorer si l'index n'existe pas
    }
    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_sectors_name"`);
    } catch (e) {
      // Ignorer si l'index n'existe pas
    }

    // Supprimer les tables
    await queryRunner.dropTable('roles', true);
    await queryRunner.dropTable('form_types', true);
    await queryRunner.dropTable('sectors', true);
  }
}


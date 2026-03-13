import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganisationRoleToUsers1737820800000
  implements MigrationInterface
{
  name = 'AddOrganisationRoleToUsers1737820800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Créer l'enum pour organisationRole
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "organisation_role_enum" AS ENUM('AGENT', 'SUPERVISEUR', 'ADMINISTRATION');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Ajouter la colonne organisationRole à la table users
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "organisationRole" "organisation_role_enum"
    `);

    // Migrer les données existantes si nécessaire
    // Si vous aviez des utilisateurs avec role = 'AGENT' ou 'SUPERVISEUR'
    // (Cette partie est commentée car elle dépend de votre structure actuelle)
    
    // await queryRunner.query(`
    //   UPDATE "users" 
    //   SET "organisationRole" = 'AGENT'::organisation_role_enum
    //   WHERE "role" = 'AGENT' AND "organisationId" IS NOT NULL
    // `);
    
    // await queryRunner.query(`
    //   UPDATE "users" 
    //   SET "organisationRole" = 'SUPERVISEUR'::organisation_role_enum
    //   WHERE "role" = 'SUPERVISEUR' AND "organisationId" IS NOT NULL
    // `);
    
    // await queryRunner.query(`
    //   UPDATE "users" 
    //   SET "role" = 'ORGANISATION'
    //   WHERE "role" IN ('AGENT', 'SUPERVISEUR') AND "organisationId" IS NOT NULL
    // `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer la colonne
    await queryRunner.query(`
      ALTER TABLE "users" 
      DROP COLUMN IF EXISTS "organisationRole"
    `);

    // Supprimer l'enum
    await queryRunner.query(`
      DROP TYPE IF EXISTS "organisation_role_enum"
    `);
  }
}












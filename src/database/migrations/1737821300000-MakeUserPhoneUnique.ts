import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rendre le numéro de téléphone unique par utilisateur.
 * Les valeurs NULL restent autorisées (plusieurs utilisateurs sans téléphone).
 */
export class MakeUserPhoneUnique1737821300000 implements MigrationInterface {
  name = 'MakeUserPhoneUnique1737821300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_users_phone"
      ON "users" ("phone")
      WHERE "phone" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_users_phone"`);
  }
}

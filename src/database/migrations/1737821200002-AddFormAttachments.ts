import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormAttachments1737821200002 implements MigrationInterface {
  name = 'AddFormAttachments1737821200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "forms"
      ADD COLUMN "attachments" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "forms"
      DROP COLUMN "attachments"
    `);
  }
}


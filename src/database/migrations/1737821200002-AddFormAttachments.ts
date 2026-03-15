import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormAttachments1737821200002 implements MigrationInterface {
  name = 'AddFormAttachments1737821200002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'forms' AND column_name = 'attachments'
        ) THEN
          ALTER TABLE "forms" ADD COLUMN "attachments" jsonb NOT NULL DEFAULT '[]';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "forms"
      DROP COLUMN "attachments"
    `);
  }
}


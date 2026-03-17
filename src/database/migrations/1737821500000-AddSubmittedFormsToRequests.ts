import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubmittedFormsToRequests1737821500000 implements MigrationInterface {
  name = 'AddSubmittedFormsToRequests1737821500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'submittedForms'
        ) THEN
          ALTER TABLE "requests" ADD COLUMN "submittedForms" jsonb NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests" DROP COLUMN IF EXISTS "submittedForms";
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormSchemaSnapshotToRequests1737821200001 implements MigrationInterface {
  name = 'AddFormSchemaSnapshotToRequests1737821200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'requests' AND column_name = 'formSchemaSnapshot'
        ) THEN
          ALTER TABLE "requests" ADD COLUMN "formSchemaSnapshot" jsonb NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests"
      DROP COLUMN "formSchemaSnapshot"
    `);
  }
}


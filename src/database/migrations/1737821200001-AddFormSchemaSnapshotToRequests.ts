import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFormSchemaSnapshotToRequests1737821200001 implements MigrationInterface {
  name = 'AddFormSchemaSnapshotToRequests1737821200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests"
      ADD COLUMN "formSchemaSnapshot" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "requests"
      DROP COLUMN "formSchemaSnapshot"
    `);
  }
}


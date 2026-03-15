import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUserIdentityDocuments1737821400000 implements MigrationInterface {
  name = 'CreateUserIdentityDocuments1737821400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "user_identity_documents_kind_enum" AS ENUM('RECTO', 'VERSO', 'SELFIE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'user_identity_documents',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'userId', type: 'uuid', isNullable: false },
          {
            name: 'kind',
            type: 'user_identity_documents_kind_enum',
            isNullable: false,
          },
          { name: 'fileName', type: 'varchar', length: '255', isNullable: false },
          { name: 'filePath', type: 'varchar', length: '500', isNullable: false },
          { name: 'fileSize', type: 'varchar', length: '50', isNullable: false },
          { name: 'mimeType', type: 'varchar', length: '50', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_identity_documents_userId_kind"
      ON "user_identity_documents" ("userId", "kind")
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_identity_documents_user'
        ) THEN
          ALTER TABLE "user_identity_documents"
          ADD CONSTRAINT "FK_user_identity_documents_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('user_identity_documents', 'FK_user_identity_documents_user');
    await queryRunner.dropIndex('user_identity_documents', 'UQ_user_identity_documents_userId_kind');
    await queryRunner.dropTable('user_identity_documents');
    await queryRunner.query(`DROP TYPE IF EXISTS "user_identity_documents_kind_enum"`);
  }
}

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

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

    await queryRunner.createIndex(
      'user_identity_documents',
      new TableIndex({
        name: 'UQ_user_identity_documents_userId_kind',
        columnNames: ['userId', 'kind'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'user_identity_documents',
      new TableForeignKey({
        name: 'FK_user_identity_documents_user',
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('user_identity_documents', 'FK_user_identity_documents_user');
    await queryRunner.dropIndex('user_identity_documents', 'UQ_user_identity_documents_userId_kind');
    await queryRunner.dropTable('user_identity_documents');
    await queryRunner.query(`DROP TYPE IF EXISTS "user_identity_documents_kind_enum"`);
  }
}

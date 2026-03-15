-- Création de la table user_identity_documents (documents d'identité : recto, verso, selfie)
-- À exécuter sur la base de PRODUCTION si la table n'existe pas (psql, pgAdmin, ou client SQL).

-- 1. Type enum pour RECTO / VERSO / SELFIE
DO $$ BEGIN
  CREATE TYPE "user_identity_documents_kind_enum" AS ENUM('RECTO', 'VERSO', 'SELFIE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Table (si elle n'existe pas)
CREATE TABLE IF NOT EXISTS "user_identity_documents" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL,
  "kind" "user_identity_documents_kind_enum" NOT NULL,
  "fileName" varchar(255) NOT NULL,
  "filePath" varchar(500) NOT NULL,
  "fileSize" varchar(50) NOT NULL,
  "mimeType" varchar(50) NOT NULL,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

-- 3. Index unique (un document par type par utilisateur)
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_identity_documents_userId_kind"
ON "user_identity_documents" ("userId", "kind");

-- 4. Clé étrangère vers users
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_user_identity_documents_user'
  ) THEN
    ALTER TABLE "user_identity_documents"
    ADD CONSTRAINT "FK_user_identity_documents_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

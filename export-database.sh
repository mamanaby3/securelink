#!/bin/bash

# Script pour exporter la base de données locale
# Usage: ./export-database.sh

set -e

echo "📦 Export de la base de données..."

# Configuration (modifiez selon votre configuration locale)
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-securelink}

# Nom du fichier de sauvegarde
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

echo "🔍 Connexion à la base de données: $DB_NAME sur $DB_HOST:$DB_PORT"

# Exporter la base de données (structure + données)
PGPASSWORD=$DB_PASSWORD pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_NAME \
  --no-owner \
  --no-acl \
  --data-only \
  --exclude-table=migrations \
  > $BACKUP_FILE

echo "✅ Export terminé: $BACKUP_FILE"
echo "📊 Taille du fichier: $(du -h $BACKUP_FILE | cut -f1)"




#!/bin/bash

# Script pour importer les données dans la base de données Docker
# Usage: ./import-database.sh [fichier_backup.sql]

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./import-database.sh [fichier_backup.sql]"
    echo "💡 Exemple: ./import-database.sh backup_20240304_120000.sql"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Le fichier $BACKUP_FILE n'existe pas."
    exit 1
fi

echo "📦 Import de la base de données depuis $BACKUP_FILE..."

# Vérifier que les conteneurs sont en cours d'exécution
if ! docker compose ps | grep -q "secure-link-db.*Up"; then
    echo "❌ Le conteneur secure-link-db n'est pas en cours d'exécution."
    echo "💡 Démarrez d'abord les conteneurs avec: docker compose up -d"
    exit 1
fi

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente de PostgreSQL..."
for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL est prêt!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL n'est pas prêt après 30 tentatives."
        exit 1
    fi
    sleep 2
done

# Importer les données
echo "🔄 Import des données..."
docker compose exec -T postgres psql -U postgres -d securelink < "$BACKUP_FILE"

echo "✅ Import terminé avec succès!"




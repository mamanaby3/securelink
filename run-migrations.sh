#!/bin/bash

# Script pour exécuter les migrations de base de données
# Usage: ./run-migrations.sh

set -e

echo "🔄 Exécution des migrations de base de données..."

# Vérifier que le conteneur est en cours d'exécution
if ! docker compose ps | grep -q "secure-link-app.*Up"; then
    echo "❌ Le conteneur secure-link-app n'est pas en cours d'exécution."
    echo "💡 Démarrez d'abord les conteneurs avec: docker compose up -d"
    exit 1
fi

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente de la base de données..."
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

# Exécuter les migrations
echo "🚀 Exécution des migrations..."
docker compose exec -T app npm run migration:run

echo "✅ Migrations exécutées avec succès!"




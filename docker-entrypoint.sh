#!/bin/sh
set -e

echo "🚀 Démarrage de l'application Secure Link..."

# Attendre que PostgreSQL soit prêt (utiliser nc au lieu de pg_isready)
echo "⏳ Attente de la base de données..."
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}

# Vérifier la connexion avec nc (netcat)
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  echo "⏳ PostgreSQL n'est pas encore prêt, attente..."
  sleep 2
done

echo "✅ PostgreSQL est prêt!"

# Exécuter les migrations
echo "🔄 Exécution des migrations de base de données..."
npm run migration:run || {
  echo "⚠️  Les migrations ont échoué ou aucune migration à exécuter."
  # Ne pas arrêter l'application si les migrations échouent (peut-être déjà exécutées)
}

# Démarrer l'application
echo "🚀 Démarrage de l'application..."
exec node dist/main.js


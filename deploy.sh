#!/bin/bash

# Script de déploiement pour Secure Link
# Usage: ./deploy.sh

set -e

echo "🚀 Démarrage du déploiement Secure Link..."

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que le fichier .env existe
if [ ! -f .env ]; then
    echo "⚠️  Le fichier .env n'existe pas. Création depuis env.example..."
    if [ -f env.example ]; then
        cp env.example .env
        echo "✅ Fichier .env créé. Veuillez le modifier avec vos valeurs."
        echo "⚠️  Éditez le fichier .env avant de continuer."
        exit 1
    else
        echo "❌ Le fichier env.example n'existe pas."
        exit 1
    fi
fi

# Créer le dossier uploads avec permissions pour le conteneur (user nestjs uid 1001)
echo "📁 Création du dossier uploads pour les logos..."
mkdir -p uploads/logos
chmod 755 uploads
chmod 755 uploads/logos 2>/dev/null || true
if [ "$(uname)" != "Darwin" ] && [ "$(uname)" != "MINGW"* ]; then
    chown 1001:1001 uploads uploads/logos 2>/dev/null || chmod 777 uploads
fi

# Construire les images
echo "📦 Construction des images Docker..."
docker-compose build --no-cache

# Démarrer les services
echo "🚀 Démarrage des services..."
docker-compose up -d

# Attendre que PostgreSQL soit prêt
echo "⏳ Attente de la base de données..."
sleep 10

# Vérifier la santé de PostgreSQL
echo "🔍 Vérification de la santé de PostgreSQL..."
for i in {1..30}; do
    if docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
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
echo "🔄 Exécution des migrations de base de données..."
docker-compose exec -T app npm run migration:run || {
    echo "⚠️  Les migrations ont échoué ou aucune migration à exécuter."
}

# Vérifier que l'application fonctionne
echo "🔍 Vérification de l'application..."
sleep 5

if docker-compose ps | grep -q "secure-link-app.*Up"; then
    echo "✅ L'application est démarrée!"
    echo ""
    echo "📊 Statut des conteneurs:"
    docker-compose ps
    echo ""
    echo "🌐 L'application est accessible sur: http://localhost:3002/api"
    echo "📝 Pour voir les logs: docker-compose logs -f app"
else
    echo "❌ L'application n'a pas démarré correctement."
    echo "📝 Vérifiez les logs avec: docker-compose logs app"
    exit 1
fi

echo ""
echo "✅ Déploiement terminé avec succès!"






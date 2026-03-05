# 🐳 Guide de déploiement Docker

Ce guide explique comment dockeriser et déployer l'application Secure Link sur votre serveur.

## 📋 Prérequis

- Docker installé sur le serveur
- Docker Compose installé
- Accès SSH au serveur `86.106.181.31`
- Les ports 3000 et 3001 sont déjà utilisés, l'application utilisera le port **3002**

## 🚀 Étapes de déploiement

### 1. Préparer les fichiers sur le serveur

```bash
# Se connecter au serveur
ssh user@86.106.181.31

# Créer un répertoire pour l'application
mkdir -p /opt/secure-link
cd /opt/secure-link
```

### 2. Transférer les fichiers du projet

Depuis votre machine locale :

```bash
# Copier les fichiers nécessaires (sans node_modules)
rsync -av --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  user@86.106.181.31:/opt/secure-link/

# Ou utiliser scp
scp -r . user@86.106.181.31:/opt/secure-link/
```

### 3. Créer le fichier `.env`

Sur le serveur, créez un fichier `.env` à partir de `env.example` :

```bash
cd /opt/secure-link
cp env.example .env
nano .env  # Éditer avec vos vraies valeurs
```

**Variables importantes à configurer :**

- `JWT_SECRET` : Une chaîne aléatoire sécurisée d'au moins 32 caractères
- `DB_PASSWORD` : Mot de passe fort pour PostgreSQL
- `MINIO_ACCESS_KEY` et `MINIO_SECRET_KEY` : Vos clés MinIO
- `EMAIL_USER` et `EMAIL_PASSWORD` : Identifiants SMTP
- `CORS_ORIGINS` : Les origines autorisées (ex: `http://86.106.181.31`)

### 4. Construire et démarrer les conteneurs

```bash
cd /opt/secure-link

# Construire les images
docker-compose build

# Démarrer les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f app
```

### 5. Exécuter les migrations de base de données

```bash
# Entrer dans le conteneur de l'application
docker-compose exec app sh

# Dans le conteneur, exécuter les migrations
npm run migration:run

# Sortir du conteneur
exit
```

### 6. Vérifier que tout fonctionne

```bash
# Vérifier les conteneurs en cours d'exécution
docker-compose ps

# Vérifier les logs
docker-compose logs app

# Tester l'API
curl http://localhost:3002/api
```

## 🔧 Commandes utiles

### Gestion des conteneurs

```bash
# Démarrer les services
docker-compose up -d

# Arrêter les services
docker-compose down

# Redémarrer un service
docker-compose restart app

# Voir les logs
docker-compose logs -f app

# Voir les logs de la base de données
docker-compose logs -f postgres
```

### Mise à jour de l'application

```bash
# Arrêter les services
docker-compose down

# Récupérer les nouveaux fichiers (via git ou rsync)
git pull  # ou rsync depuis votre machine

# Reconstruire l'image
docker-compose build --no-cache

# Redémarrer
docker-compose up -d

# Exécuter les migrations si nécessaire
docker-compose exec app npm run migration:run
```

### Sauvegarde de la base de données

```bash
# Créer une sauvegarde
docker-compose exec postgres pg_dump -U postgres securelink > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurer une sauvegarde
docker-compose exec -T postgres psql -U postgres securelink < backup.sql
```

## 🌐 Configuration Nginx (optionnel)

Si vous voulez utiliser Nginx comme reverse proxy :

```nginx
server {
    listen 80;
    server_name 86.106.181.31;

    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔒 Sécurité

1. **Changez tous les mots de passe par défaut** dans le fichier `.env`
2. **Utilisez un JWT_SECRET fort** (générez avec : `openssl rand -base64 32`)
3. **Limitez les accès CORS** aux domaines nécessaires
4. **Configurez un firewall** pour limiter l'accès aux ports
5. **Activez SSL/TLS** avec Let's Encrypt si vous utilisez un domaine

## 📊 Monitoring

```bash
# Voir l'utilisation des ressources
docker stats

# Voir les logs en temps réel
docker-compose logs -f

# Vérifier la santé des conteneurs
docker-compose ps
```

## 🐛 Dépannage

### L'application ne démarre pas

```bash
# Vérifier les logs
docker-compose logs app

# Vérifier les variables d'environnement
docker-compose exec app env | grep DB_

# Vérifier la connexion à la base de données
docker-compose exec app sh
# Dans le conteneur :
npm run migration:run
```

### Problème de connexion à la base de données

```bash
# Vérifier que PostgreSQL est démarré
docker-compose ps postgres

# Vérifier les logs PostgreSQL
docker-compose logs postgres

# Tester la connexion
docker-compose exec postgres psql -U postgres -d securelink
```

### Port déjà utilisé

Si le port 3002 est déjà utilisé, modifiez le port dans `docker-compose.yml` :

```yaml
ports:
  - "3003:3002"  # Utiliser le port 3003 au lieu de 3002
```

Et mettez à jour `PORT=3002` dans le `.env` si nécessaire.

## 📝 Notes

- Les données PostgreSQL sont persistantes dans le volume `postgres_data`
- Les fichiers uploadés sont stockés dans MinIO (externe)
- Les logs sont accessibles via `docker-compose logs`
- L'application redémarre automatiquement en cas de crash (`restart: unless-stopped`)




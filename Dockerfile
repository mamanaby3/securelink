# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./
COPY nest-cli.json ./

# Installer les dépendances (utilise npm ci si package-lock.json existe, sinon npm install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copier le code source
COPY src ./src

# Builder l'application
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Installer toutes les dépendances (y compris dev pour les migrations)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm cache clean --force

# Copier les fichiers compilés depuis le stage builder
COPY --from=builder /app/dist ./dist

# Copier tout le dossier src pour les migrations (nécessaire pour les imports d'entités)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/nest-cli.json ./

# Installer netcat-openbsd pour vérifier la connexion PostgreSQL
RUN apk add --no-cache netcat-openbsd

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copier le script d'initialisation et définir les permissions
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && \
    chown nestjs:nodejs docker-entrypoint.sh

# Changer le propriétaire des fichiers
RUN chown -R nestjs:nodejs /app
USER nestjs

# Exposer le port
EXPOSE 3000

# Utiliser le script d'initialisation comme point d'entrée
ENTRYPOINT ["./docker-entrypoint.sh"]


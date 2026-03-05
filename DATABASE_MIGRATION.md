# 📦 Guide de migration des données

Ce guide explique comment migrer les données de votre base de données locale vers le serveur de production.

## 🔄 Méthode 1 : Export/Import avec pg_dump (Recommandé)

### Étape 1 : Exporter les données depuis votre machine locale

```bash
# Sur votre machine locale
cd /chemin/vers/secure-link

# Exporter uniquement les données (sans la structure)
./export-database.sh

# OU exporter TOUT (structure + données)
./export-full-database.sh
```

Cela créera un fichier `backup_YYYYMMDD_HHMMSS.sql` ou `backup_full_YYYYMMDD_HHMMSS.sql`.

### Étape 2 : Transférer le fichier sur le serveur

```bash
# Depuis votre machine locale
scp backup_*.sql root@86.106.181.31:/root/securelink/
```

### Étape 3 : Importer sur le serveur

```bash
# Sur le serveur
cd /root/securelink

# Rendre le script exécutable
chmod +x import-database.sh

# Importer les données
./import-database.sh backup_20240304_120000.sql
```

## 🔄 Méthode 2 : Export/Import manuel avec Docker

### Exporter depuis votre machine locale

```bash
# Si vous utilisez Docker localement
docker exec -t votre-container-postgres pg_dump -U postgres securelink > backup.sql

# Ou si PostgreSQL est installé localement
pg_dump -h localhost -U postgres -d securelink > backup.sql
```

### Importer sur le serveur

```bash
# Sur le serveur
docker compose exec -T postgres psql -U postgres -d securelink < backup.sql
```

## 🔄 Méthode 3 : Export/Import de tables spécifiques

Si vous voulez migrer seulement certaines tables :

```bash
# Exporter des tables spécifiques
pg_dump -h localhost -U postgres -d securelink \
  -t users \
  -t organisations \
  -t forms \
  -t user_documents \
  --data-only \
  > backup_tables.sql

# Importer sur le serveur
docker compose exec -T postgres psql -U postgres -d securelink < backup_tables.sql
```

## ⚠️ Important : Ordre d'importation

Si vous importez des données avec des relations (foreign keys), assurez-vous que l'ordre est correct :

1. **Tables de référence** (sans dépendances) :
   - `sectors`
   - `form_types`
   - `roles`
   - `document_types`

2. **Tables principales** :
   - `organisations`
   - `users`
   - `forms`

3. **Tables dépendantes** :
   - `user_documents`
   - `requests`
   - `verifications`
   - `audit_logs`
   - `security_settings`

## 🔍 Vérification après import

```bash
# Vérifier le nombre d'enregistrements
docker compose exec postgres psql -U postgres -d securelink -c "
  SELECT 
    'users' as table_name, COUNT(*) as count FROM users
  UNION ALL
  SELECT 'organisations', COUNT(*) FROM organisations
  UNION ALL
  SELECT 'forms', COUNT(*) FROM forms
  UNION ALL
  SELECT 'user_documents', COUNT(*) FROM user_documents
  UNION ALL
  SELECT 'requests', COUNT(*) FROM requests;
"
```

## 🛠️ Dépannage

### Erreur : "relation already exists"

Si vous obtenez cette erreur, c'est que les tables existent déjà. Utilisez `--data-only` :

```bash
pg_dump --data-only -h localhost -U postgres -d securelink > backup_data_only.sql
```

### Erreur : "foreign key constraint"

Si vous avez des erreurs de contraintes, importez d'abord les tables de référence, puis les tables dépendantes.

### Vider les tables avant import

```bash
# Sur le serveur (ATTENTION : supprime toutes les données !)
docker compose exec postgres psql -U postgres -d securelink -c "
  TRUNCATE TABLE user_documents, requests, verifications, audit_logs CASCADE;
  TRUNCATE TABLE users, forms CASCADE;
  TRUNCATE TABLE organisations CASCADE;
"
```

## 📝 Notes

- Les migrations créent automatiquement les tables et les données initiales (secteurs, rôles, etc.)
- Vous devez migrer manuellement les données utilisateur (users, organisations, documents, etc.)
- Assurez-vous que les IDs (UUIDs) sont préservés si vous avez des relations
- Testez d'abord sur un environnement de staging si possible




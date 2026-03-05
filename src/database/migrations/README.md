# Migrations de base de données

## Création des migrations

Pour créer une nouvelle migration :

```bash
npm run typeorm migration:create -- -n NomDeLaMigration
```

## Exécution des migrations

```bash
# Exécuter toutes les migrations en attente
npm run typeorm migration:run

# Annuler la dernière migration
npm run typeorm migration:revert
```

## Génération automatique des migrations

```bash
npm run typeorm migration:generate -- -n NomDeLaMigration
```

**Note:** En développement, `synchronize: true` est activé dans `database.module.ts`, ce qui crée automatiquement les tables. En production, désactivez cette option et utilisez les migrations.











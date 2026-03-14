# Déployer le backend Secure Link sur Dokploy – étape par étape

Ce guide vous permet de déployer le backend **secure-link** (NestJS) sur **Dokploy** sans précipitation. Suivez les étapes dans l’ordre.

---

## Étape 0 : Ce dont vous avez besoin

- Un **compte Dokploy** et un **serveur** où Dokploy est installé.
- Le code **secure-link** dans un dépôt **Git** (GitHub, GitLab, etc.) que Dokploy peut cloner.
- Une **base PostgreSQL** :
  - soit une base créée **dans Dokploy** (application Base de données),
  - soit une base **externe** (hébergeur, autre serveur) avec une URL ou host + port + user + mot de passe.

---

## Étape 1 : Préparer la liste des variables d’environnement

Avant de créer l’application, notez les valeurs que vous allez entrer dans Dokploy. Vous pouvez vous aider du fichier **`env.example`** à la racine de `secure-link`.

**Minimum pour que l’app démarre :**

| Variable        | Exemple / remarque |
|----------------|--------------------|
| `NODE_ENV`     | `production` |
| `PORT`         | `3000` |
| `JWT_SECRET`   | Une longue chaîne aléatoire (au moins 32 caractères). **À ne pas laisser à la valeur par défaut.** |
| `DB_HOST`      | Nom du service PostgreSQL dans Dokploy (ex. `postgres`) ou IP/hostname si base externe |
| `DB_PORT`      | `5432` |
| `DB_USERNAME`  | Utilisateur PostgreSQL |
| `DB_PASSWORD`  | Mot de passe PostgreSQL |
| `DB_NAME`      | `securelink` (ou le nom de la base que vous avez créée) |

**Autres variables utiles (à remplir selon votre config) :**

- `FRONTEND_URL` : URL du front (ex. `https://secure.innovimpactdev.cloud`)
- `CORS_ORIGINS` : mêmes origines que le front (ex. `https://secure.innovimpactdev.cloud`)
- MinIO, Email, SMS : voir `env.example` et remplir si vous utilisez ces services.

Vous remplirez tout ça à l’**Étape 5**.

---

## Étape 2 : Créer une nouvelle application dans Dokploy

1. Connectez-vous à **Dokploy**.
2. Choisissez ou créez un **projet** (ex. « Secure Link »).
3. Cliquez sur **« Nouvelle application »** (ou « Add Application »).
4. Choisissez le type : **Application** (build à partir d’un Dockerfile ou d’un dépôt Git).

Donnez un **nom** à l’application (ex. `secure-link-backend`). Vous configurerez le reste dans les étapes suivantes.

---

## Étape 3 : Brancher la source (Git)

1. Dans la configuration de l’application, trouvez la section **Source** / **Git**.
2. Indiquez l’**URL du dépôt** (HTTPS ou SSH).
3. Choisissez la **branche** (souvent `main` ou `master`).
4. **Chemin du Dockerfile** : si le Dockerfile est à la **racine du dépôt** (dans le dossier qui contient tout le projet), vous devez indiquer le **contexte de build** :
   - Beaucoup de plateformes demandent un **« Build Context »** ou **« Root directory »**.
   - Si tout le repo contient plusieurs dossiers (`secure-link/`, `frontsecurelink/`, etc.), mettez le **contexte de build** sur le dossier **`secure-link`** (ou le chemin où se trouvent le `Dockerfile` et le code du backend).
   - Le **Dockerfile** doit être dans ce même dossier (ex. `secure-link/Dockerfile`).

Si votre dépôt ne contient **que** le projet secure-link (pas de sous-dossier), le contexte est la racine et le Dockerfile à la racine suffit.

Résumé :
- **Repository** = URL du repo Git.
- **Branch** = `main` (ou la vôtre).
- **Build context / Root path** = dossier qui contient `Dockerfile` et `package.json` (souvent `secure-link` si le repo est « mon-repo » et le backend dans `mon-repo/secure-link/`).

---

## Étape 4 : Configurer le build et le port

1. **Build**  
   - Type : **Dockerfile**.  
   - Fichier : `Dockerfile` (souvent détecté automatiquement si le contexte est bon).

2. **Port du conteneur**  
   - Le backend écoute sur le port **3000** (voir `EXPOSE 3000` dans le Dockerfile et `PORT=3000`).  
   - Dans Dokploy, indiquez que l’application expose le port **3000** (souvent un champ « Container Port » ou « Port » = `3000`).

3. Lancez un **premier build** (bouton « Build » ou « Deploy »).  
   - Si le build échoue, vérifiez le **contexte** (étape 3) et que le fichier **`docker-entrypoint.sh`** est bien dans le même dossier que le Dockerfile (il est copié par le Dockerfile).

Ne vous inquiétez pas encore si l’application ne répond pas : on va ajouter les variables d’environnement et la base ensuite.

---

## Étape 5 : Ajouter les variables d’environnement

1. Dans la fiche de votre application, ouvrez **« Variables d’environnement »** (ou « Environment »).
2. Ajoutez **une par une** les variables listées à l’**Étape 1**.

Exemple (à adapter) :

```
NODE_ENV=production
PORT=3000
JWT_SECRET=votre_cle_secrete_longue_et_aleatoire_32_caracteres_minimum
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=votre_mot_de_passe_postgres
DB_NAME=securelink
FRONTEND_URL=https://secure.innovimpactdev.cloud
CORS_ORIGINS=https://secure.innovimpactdev.cloud
```

- Si votre **PostgreSQL est dans Dokploy** (autre application du même projet), `DB_HOST` est souvent le **nom du service** (ex. `postgres` ou le nom de l’app base de données).
- Si PostgreSQL est **externe**, mettez l’**IP** ou le **hostname** dans `DB_HOST`.

3. **Optionnel** : pour afficher la doc Swagger en prod, ajoutez :  
   `ENABLE_SWAGGER=true`

4. Enregistrez et **redéployez** l’application (nouveau build ou « Redeploy »).

---

## Étape 6 : Base de données PostgreSQL

**Cas A : Vous créez une base dans Dokploy**

1. Dans le même projet, créez une application de type **Base de données** → **PostgreSQL**.
2. Notez le **nom du service** (souvent `postgres` ou le nom que vous donnez).
3. Définissez **utilisateur**, **mot de passe** et **nom de base** (ex. `securelink`).
4. Dans les variables d’environnement du **backend** (Étape 5), mettez :
   - `DB_HOST` = nom du service PostgreSQL (ex. `postgres`),
   - `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` = les mêmes valeurs que pour la base.

**Cas B : Base PostgreSQL externe**

1. Vous devez connaître : **host** (IP ou domaine), **port** (souvent 5432), **utilisateur**, **mot de passe**, **nom de la base**.
2. Remplissez `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` dans les variables d’environnement du backend.
3. Vérifiez que le **pare-feu** ou la **security group** du serveur PostgreSQL autorise les connexions depuis l’IP du serveur Dokploy.

---

## Étape 7 : Domaine et URL (optionnel mais recommandé)

1. Dans la configuration de l’application backend, cherchez **Domaine** / **Domain** / **URL**.
2. Indiquez le sous-domaine que vous voulez pour l’API, par exemple :  
   **`api.secure.innovimpactdev.cloud`**
3. Dokploy (ou Traefik) va gérer le HTTPS et router les requêtes vers le port 3000 du conteneur.

Important : le backend attend les requêtes **avec le préfixe `/api`**.  
L’URL finale sera donc :  
**`https://api.secure.innovimpactdev.cloud/api`**  
et par exemple :  
**`https://api.secure.innovimpactdev.cloud/api/health`**

Assurez-vous que le **proxy ne supprime pas** le préfixe `/api` : la requête vers `https://api.secure.innovimpactdev.cloud/api/health` doit être envoyée au conteneur en `http://conteneur:3000/api/health`.

---

## Étape 8 : Vérifier le déploiement

1. **Logs**  
   - Ouvrez les **logs** de l’application backend dans Dokploy.  
   - Vous devez voir un message du type : **« Application démarrée sur le port 3000 »**.  
   - En cas d’erreur (variable manquante, connexion base refusée), la cause est indiquée dans les logs.

2. **Health check**  
   - Dans le navigateur ou avec Postman, appelez :  
     **GET** `https://api.secure.innovimpactdev.cloud/api/health`  
   - Réponse attendue : **200** et `{"status":"ok"}`.

3. **Frontend**  
   - Dans le front (Angular), assurez-vous que **`apiBaseUrl`** pointe vers cette URL, par exemple :  
     `https://api.secure.innovimpactdev.cloud/api`  
   - Rebuild et redéploiement du front si nécessaire.

---

## En cas de problème

- **502 Bad Gateway** : voir le fichier **`DOKPLOY-502.md`** dans ce dossier (logs, port 3000, variables, base de données).
- **Build échoue** : vérifier le **contexte de build** (dossier `secure-link`) et la présence de **`docker-entrypoint.sh`** dans ce dossier.
- **Erreur au démarrage** : relire les **logs** du conteneur ; souvent une variable manquante ou une base inaccessible.

En suivant ces étapes une par une, vous devriez obtenir un backend déployé et répondant sur `/api` et `/api/health`.

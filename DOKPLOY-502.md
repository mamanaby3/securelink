# 502 Bad Gateway sur Dokploy – à vérifier

Une **502** signifie que le reverse proxy (Dokploy/Traefik) n’obtient pas de réponse valide du conteneur backend. Voici quoi contrôler.

## 1. Logs du conteneur (priorité 1)

Dans Dokploy : **Application** → ton backend → **Logs**.

- **Le conteneur redémarre en boucle ?**  
  Souvent : variables d’environnement manquantes ou base de données injoignable.

- **Erreurs typiques :**
  - `Variables d'environnement manquantes en production: JWT_SECRET, DB_HOST, ...`  
    → Définir toutes les variables obligatoires (voir `env.example`).
  - `JWT_SECRET doit être changé en production !`  
    → Mettre une vraie valeur (pas `your-secret-key-change-in-production`).
  - `connect ECONNREFUSED` / `Connection refused` (PostgreSQL)  
    → `DB_HOST` doit pointer vers un PostgreSQL accessible depuis le conteneur (même réseau Dokploy ou URL externe).

## 2. Port exposé

Le backend NestJS écoute sur la variable **`PORT`** (défaut **3000**).

- Dans la config Dokploy de l’application, le **port du conteneur** doit être **3000** (ou la valeur de `PORT` que tu utilises).
- Ne pas exposer un autre port (ex. 8080) sauf si tu as mis `PORT=8080` dans les variables d’environnement.

## 3. Chemin /api

L’API a un préfixe global **`/api`**. Les URLs sont donc :

- `https://api.secure.innovimpactdev.cloud/api` → racine API
- `https://api.secure.innovimpactdev.cloud/api/health` → health check
- `https://api.secure.innovimpactdev.cloud/api/auth/login` → login

Le proxy doit **transmettre le chemin complet** au conteneur :

- Requête : `https://api.secure.innovimpactdev.cloud/api/health`
- En amont vers le conteneur : `http://<conteneur>:3000/api/health`  
  **Ne pas** enlever le préfixe `/api` (sinon le backend renverra 404).

## 4. Test une fois le conteneur démarré

Quand les logs indiquent que l’app a bien démarré (`Application démarrée sur le port 3000`) :

- **Health check :**  
  `GET https://api.secure.innovimpactdev.cloud/api/health`  
  → doit retourner `{"status":"ok"}` avec un **200**.

Si **/api/health** répond 200 mais le front reçoit encore 502 sur d’autres URLs, le souci vient du chemin ou du routage proxy, pas du backend.

## 5. Résumé des variables obligatoires (prod)

À définir dans Dokploy (Variables d’environnement) :

- `NODE_ENV=production`
- `PORT=3000`
- `JWT_SECRET=` (une longue chaîne aléatoire, pas la valeur par défaut)
- `DB_HOST=` (hostname ou IP de PostgreSQL)
- `DB_PORT=5432`
- `DB_USERNAME=`
- `DB_PASSWORD=`
- `DB_NAME=securelink`

(+ MinIO, Email, SMS, etc. selon ton `env.example`.)

## 6. Base de données

Si PostgreSQL est **en dehors** de Dokploy (autre serveur, autre hébergeur) :

- `DB_HOST` = IP ou hostname public de la base.
- Le serveur PostgreSQL doit accepter les connexions depuis l’IP du conteneur Dokploy (pare-feu / security group).

Si PostgreSQL est **dans** Dokploy (autre application du même projet) :

- Utiliser le **nom du service** comme `DB_HOST` (ex. `postgres` ou le nom de l’app base de données), pour que la résolution DNS interne fonctionne.

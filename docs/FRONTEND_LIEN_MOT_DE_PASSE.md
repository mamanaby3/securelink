# Lien « Créer mon mot de passe » (Angular / Flutter)

Après l’inscription client, un email est envoyé avec un lien pour créer le mot de passe. Ce lien doit ouvrir **votre** application (Angular ou Flutter).

## 1. Côté backend (serveur)

Le lien envoyé dans l’email est :

```text
{FRONTEND_URL}/auth/setup-password?token=xxx
```

- **FRONTEND_URL** doit être l’URL de base de votre app client.
- À définir dans le `.env` du serveur (et dans `docker-compose`, c’est déjà pris en charge).

Exemples :

- Angular en prod : `FRONTEND_URL=https://client.votredomaine.com`
- Angular / Flutter Web en dev : `FRONTEND_URL=http://86.106.181.31:4200`

Sans `FRONTEND_URL`, la valeur par défaut est `http://localhost:4200` : le lien ne fonctionnera pas pour un utilisateur qui clique depuis son téléphone ou un autre ordinateur.

### Lien mobile (deeplink) – optionnel

Pour que l’email contienne **aussi** un lien qui ouvre l’app mobile (scheme custom), définir :

```text
MOBILE_DEEP_LINK_URL=securelink://create-password?token=
```

Le lien final sera par exemple : `securelink://create-password?token=pwd-setup-xxx`.  
L’email affichera alors deux liens : un pour le navigateur (web) et un pour l’app mobile (deeplink).

---

## 2. Côté frontend (Angular ou Flutter Web)

Quand l’utilisateur clique sur le lien, il arrive sur une URL du type :

```text
https://votre-app.com/auth/setup-password?token=pwd-setup-1234567890-abc123
```

À faire dans votre app :

1. **Route** : une page correspondant à `/auth/setup-password`.
2. **Récupérer le token** : lire le paramètre de requête `token` dans l’URL.
3. **Afficher** un formulaire : nouveau mot de passe + confirmation.
4. **À la soumission** : appeler l’API backend :

   - **Méthode** : `POST`
   - **URL** : `https://votre-api.com/api/auth/setup-password`
   - **Body (JSON)** :
     ```json
     {
       "token": "pwd-setup-1234567890-abc123",
       "password": "VotreMotDePasse123!",
       "confirmPassword": "VotreMotDePasse123!"
     }
     ```
   - **Règles mot de passe** : au moins 8 caractères, une majuscule, une minuscule, un chiffre, un caractère spécial (`@$!%*?&`).

5. En cas de succès (200), l’API renvoie `accessToken`, `refreshToken` et les infos utilisateur : vous pouvez connecter l’utilisateur et le rediriger (ex. tableau de bord).

Optionnel : avant d’afficher le formulaire, vous pouvez vérifier le token avec :

- **GET** `https://votre-api.com/api/auth/verify-password-setup-token?token=xxx`  
  → 200 = token valide, vous pouvez afficher la page de création de mot de passe.

---

## 3. Flutter mobile (app native)

Le lien dans l’email est une URL web (ex. `https://client.votredomaine.com/auth/setup-password?token=xxx`). Deux approches possibles :

- **Option A – Tout en web**  
  Mettre `FRONTEND_URL` vers une page web (Angular ou Flutter Web) qui affiche le formulaire et appelle `POST /api/auth/setup-password`. L’utilisateur crée son mot de passe dans le navigateur, puis peut se connecter dans l’app mobile avec email + ce mot de passe.

- **Option B – Deep link vers l’app**  
  La même URL peut être configurée en “Universal Link” (iOS) / “App Link” (Android) pour ouvrir votre app Flutter avec le token en paramètre. Dans l’app, vous affichez l’écran “Créer mon mot de passe”, vous envoyez le même body `{ token, password, confirmPassword }` en `POST /api/auth/setup-password`.

Dans les deux cas, le lien est “correct” : il suffit que **FRONTEND_URL** pointe vers l’endroit qui gère cette page (web ou deep link vers l’app).

---

## Résumé

- Le lien est **correct** si **FRONTEND_URL** est bien défini sur le serveur et pointe vers votre app (Angular ou Flutter).
- La page doit être accessible à la route **`/auth/setup-password`** avec le **`token`** en query.
- La finalisation se fait en appelant **`POST /api/auth/setup-password`** avec `token`, `password` et `confirmPassword`.

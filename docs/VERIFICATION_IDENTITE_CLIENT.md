# Vérification d’identité : face recto, face verso, selfie

La **vérification d’identité** (face avant CNI, face arrière CNI, selfie) est **séparée des types de documents du profil**. Les 3 images ne figurent **pas** dans `document-types` : le client ne les voit pas dans la liste des types à uploader pour son profil. Ils servent uniquement à la **vérification humaine** par l’admin (comparer selfie au visage sur la CNI, vérifier recto/verso).

## 1. Aucune configuration admin

Il ne faut **pas** créer de types de documents « Face recto CNI », « Face verso CNI », « Selfie » dans les types de documents. Les 3 slots sont gérés par une **table dédiée** (`user_identity_documents`) et des **endpoints dédiés**.

## 2. Endpoints pour le client (upload)

### Upload recto / verso / selfie

**Un seul endpoint** pour les 3, avec le champ **kind** = `RECTO` | `VERSO` | `SELFIE` :

```http
POST /api/users/profile/identity-documents
Authorization: Bearer <token_client>
Content-Type: multipart/form-data

file: <fichier image (JPG/PNG) ou PDF, max 10 MB>
kind: RECTO   (ou VERSO ou SELFIE)
```

- **Recto** (face avant CNI) : `kind=RECTO`
- **Verso** (face arrière CNI) : `kind=VERSO`
- **Selfie** : `kind=SELFIE`

Un client ne peut avoir qu’un fichier par slot : un nouvel upload pour le même `kind` remplace l’ancien.

### Liste des documents d’identité du client

```http
GET /api/users/profile/identity-documents
Authorization: Bearer <token_client>
```

Retourne la liste des 3 slots éventuellement remplis (recto, verso, selfie).

### Fichier d’un document d’identité (aperçu client)

```http
GET /api/users/profile/identity-documents/:documentId/file
Authorization: Bearer <token_client>
```

## 3. Côté Admin (vérification)

**GET /api/verifications/:id**

La réponse inclut :

- **identityRectoDocument** : face avant CNI (si uploadé)
- **identityVersoDocument** : face arrière CNI (si uploadé)
- **identitySelfieDocument** : selfie (si uploadé)

Chaque élément a : `id`, `type`, `fileName`, `mimeType`. Pour afficher l’image :

```http
GET /api/users/admin/identity-documents/:documentId/file
Authorization: Bearer <token_admin>
```

(où `documentId` est par ex. `identityRectoDocument.id`).

## 4. Test sans mobile (Postman / cURL)

1. Se connecter en **client** : **POST /api/auth/login/client** → récupérer le token.
2. Envoyer 3 fois **POST /api/users/profile/identity-documents** avec le même token :
   - `file` = le fichier
   - `kind` = `RECTO`, puis `VERSO`, puis `SELFIE`

Exemple cURL :

```bash
# Recto
curl -X POST "https://api.secure.innovimpactdev.cloud/api/users/profile/identity-documents" \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/chemin/recto.jpg" \
  -F "kind=RECTO"

# Verso
curl -X POST "https://api.secure.innovimpactdev.cloud/api/users/profile/identity-documents" \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/chemin/verso.jpg" \
  -F "kind=VERSO"

# Selfie
curl -X POST "https://api.secure.innovimpactdev.cloud/api/users/profile/identity-documents" \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/chemin/selfie.jpg" \
  -F "kind=SELFIE"
```

## Résumé

| Rôle   | Action | Endpoint |
|--------|--------|----------|
| Client | Upload face avant | POST /api/users/profile/identity-documents (file + kind=RECTO) |
| Client | Upload face arrière | POST /api/users/profile/identity-documents (file + kind=VERSO) |
| Client | Upload selfie | POST /api/users/profile/identity-documents (file + kind=SELFIE) |
| Client | Liste des 3 slots | GET /api/users/profile/identity-documents |
| Client | Fichier d’un slot | GET /api/users/profile/identity-documents/:id/file |
| Admin  | Détail vérification (recto/verso/selfie) | GET /api/verifications/:id |
| Admin  | Fichier d’un document d’identité | GET /api/users/admin/identity-documents/:id/file |

**GET /api/users/profile/document-types** ne contient **pas** les 3 types recto/verso/selfie : ils ne sont pas des types de documents du profil.

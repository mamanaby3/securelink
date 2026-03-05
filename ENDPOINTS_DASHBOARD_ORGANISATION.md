# 📊 Endpoints Dashboard Organisation - Secure Link

## Vue d'ensemble

Le dashboard organisation est maintenant séparé en **5 endpoints distincts** pour une meilleure modularité et performance. Chaque section du dashboard peut être chargée indépendamment.

---

## 🔗 Endpoints disponibles

### 1. **Statistiques du Dashboard (Demandes)**
**Endpoint :** `GET /api/organisations/:id/dashboard/statistics`

**Description :** Retourne uniquement les statistiques des demandes pour le dashboard (cartes de métriques)

**Rôle requis :** `ADMIN` ou `ORGANISATION` (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)

**Paramètres :**
- `id` (path) : ID de l'organisation

**Réponse :**
```json
{
  "total": 315,
  "pending": 42,
  "inProgress": 18,
  "validated": 234,
  "rejected": 3,
  "totalChangeThisMonth": "+12%",
  "validatedChangeThisMonth": "-3.1%",
  "rejectedChangeThisMonth": "+15.3%"
}
```

**Utilisation :** Afficher les 5 cartes de statistiques en haut du dashboard

**Note :** Exclut automatiquement les brouillons (`BROUILLON`) et les demandes avec OTP non vérifié

---

### 2. **Demandes Récentes**
**Endpoint :** `GET /api/organisations/:id/dashboard/recent-requests`

**Description :** Retourne les demandes récentes de l'organisation (tableau)

**Rôle requis :** `ADMIN` ou `ORGANISATION` (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)

**Paramètres :**
- `id` (path) : ID de l'organisation
- `limit` (query, optionnel) : Nombre de demandes à retourner (par défaut: 5)

**Exemple :** `GET /api/organisations/org-123/dashboard/recent-requests?limit=10`

**Réponse :**
```json
[
  {
    "id": "req-123",
    "requestNumber": "DEM-993",
    "client": "Oumy Ly",
    "clientId": "user-456",
    "type": "Demande de virement",
    "formType": "TRANSACTION",
    "receivedAt": "2024-01-15T10:30:00Z",
    "status": "EN_ATTENTE",
    "timeAgo": "Il y a 2 heures"
  }
]
```

**Utilisation :** Afficher le tableau "Demandes récentes" du dashboard

**Note :** Exclut automatiquement les brouillons et les demandes avec OTP non vérifié

---

### 3. **Requêtes par Type (Graphique)**
**Endpoint :** `GET /api/organisations/:id/dashboard/requests-by-type`

**Description :** Retourne les statistiques des demandes groupées par type de formulaire (pour le graphique)

**Rôle requis :** `ADMIN` ou `ORGANISATION` (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)

**Paramètres :**
- `id` (path) : ID de l'organisation

**Réponse :**
```json
[
  {
    "type": "TRANSACTION",
    "label": "Transfer",
    "count": 10
  },
  {
    "type": "DEMANDE",
    "label": "KYC",
    "count": 28
  },
  {
    "type": "LOAN",
    "label": "Prêt",
    "count": 46
  },
  {
    "type": "AUTRES",
    "label": "Autres",
    "count": 58
  }
]
```

**Utilisation :** Afficher le graphique "Requêtes par type" (bar chart horizontal)

**Mapping des types :**
- `TRANSACTION` → "Transfer"
- `DEMANDE` → "KYC"
- `LOAN` → "Prêt"
- `DECLARATION` → "Déclaration"
- `RESILIATION` → "Résiliation"
- Autres → "Autres"

---

### 4. **Activité Récente**
**Endpoint :** `GET /api/organisations/:id/dashboard/recent-activity`

**Description :** Retourne l'activité récente de l'organisation (soumissions, validations, traitements)

**Rôle requis :** `ADMIN` ou `ORGANISATION` (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)

**Paramètres :**
- `id` (path) : ID de l'organisation
- `limit` (query, optionnel) : Nombre d'activités à retourner (par défaut: 10)

**Exemple :** `GET /api/organisations/org-123/dashboard/recent-activity?limit=20`

**Réponse :**
```json
[
  {
    "id": "submitted-req-123",
    "type": "REQUEST_SUBMITTED",
    "icon": "check",
    "color": "green",
    "title": "Demande de transfert soumise",
    "description": "Demande DEM-993 soumise par Oumy Ly",
    "date": "2024-01-15T10:30:00Z",
    "timeAgo": "Il y a 5 minutes"
  },
  {
    "id": "validated-req-456",
    "type": "REQUEST_VALIDATED",
    "icon": "check",
    "color": "green",
    "title": "Demande validée",
    "description": "Demande DEM-992 validée",
    "date": "2024-01-15T09:15:00Z",
    "timeAgo": "Il y a 1 heure"
  },
  {
    "id": "processing-req-789",
    "type": "REQUEST_PROCESSING",
    "icon": "clock",
    "color": "blue",
    "title": "Demande en cours de traitement",
    "description": "Demande DEM-991 en cours",
    "date": "2024-01-15T08:00:00Z",
    "timeAgo": "Il y a 3 heures"
  }
]
```

**Types d'activités :**
- `REQUEST_SUBMITTED` : Demande soumise (icon: check, color: green)
- `REQUEST_VALIDATED` : Demande validée (icon: check, color: green)
- `REQUEST_PROCESSING` : Demande en cours (icon: clock, color: blue)

**Utilisation :** Afficher la liste "Activité récente" du dashboard

---

### 5. **Alertes et Notifications**
**Endpoint :** `GET /api/organisations/:id/notifications`

**Description :** Retourne toutes les notifications pertinentes pour l'organisation

**Rôle requis :** `ADMIN` ou `ORGANISATION` (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)

**Paramètres :**
- `id` (path) : ID de l'organisation
- `unreadOnly` (query, optionnel) : Retourner uniquement les notifications non lues (`true`/`false`)

**Exemple :** `GET /api/organisations/org-123/notifications?unreadOnly=true`

**Réponse :**
```json
[
  {
    "id": "req-pending-123",
    "type": "VERIFICATION_PENDING",
    "severity": "WARNING",
    "title": "Demande en attente de traitement",
    "message": "La demande DEM-993 de Oumy Ly est en attente depuis 24 heures",
    "date": "2024-01-15T10:30:00Z",
    "timeAgo": "Il y a 2 heures",
    "relatedId": "req-123",
    "relatedType": "request",
    "isRead": false
  }
]
```

**Types de notifications :**
- `VERIFICATION_PENDING` : Demande/document en attente
- `REQUEST_VALIDATED` : Demande validée
- `DOCUMENT_EXPIRING` : Document expirant bientôt

**Utilisation :** Afficher les notifications dans le dashboard (optionnel)

---

## 📋 Structure du Dashboard

Le dashboard organisation est composé de 5 sections principales :

```
┌─────────────────────────────────────────────────┐
│  📊 STATISTIQUES (5 cartes)                     │
│  GET /api/organisations/:id/dashboard/statistics│
├─────────────────────────────────────────────────┤
│  📋 DEMANDES RÉCENTES (Tableau)                 │
│  GET /api/organisations/:id/dashboard/recent-requests?limit=5│
├─────────────────────────────────────────────────┤
│  📊 REQUÊTES PAR TYPE (Graphique)                │
│  GET /api/organisations/:id/dashboard/requests-by-type│
├─────────────────────────────────────────────────┤
│  📝 ACTIVITÉ RÉCENTE (Liste)                     │
│  GET /api/organisations/:id/dashboard/recent-activity?limit=10│
├─────────────────────────────────────────────────┤
│  🔔 NOTIFICATIONS (Liste)                        │
│  GET /api/organisations/:id/notifications        │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Avantages de la séparation

1. **Performance** : Chargement indépendant de chaque section
2. **Modularité** : Chaque section peut être mise à jour séparément
3. **Flexibilité** : Le frontend peut charger les sections selon les besoins
4. **Cache** : Possibilité de mettre en cache chaque endpoint séparément
5. **Maintenance** : Plus facile à maintenir et déboguer

---

## 💡 Exemple d'utilisation (Frontend)

```javascript
const organisationId = 'org-123';

// Charger le dashboard en parallèle
const [statistics, recentRequests, requestsByType, recentActivity, notifications] = await Promise.all([
  fetch(`/api/organisations/${organisationId}/dashboard/statistics`),
  fetch(`/api/organisations/${organisationId}/dashboard/recent-requests?limit=5`),
  fetch(`/api/organisations/${organisationId}/dashboard/requests-by-type`),
  fetch(`/api/organisations/${organisationId}/dashboard/recent-activity?limit=10`),
  fetch(`/api/organisations/${organisationId}/notifications`),
]);

// Afficher chaque section indépendamment
displayStatistics(await statistics.json());
displayRecentRequests(await recentRequests.json());
displayRequestsByType(await requestsByType.json());
displayRecentActivity(await recentActivity.json());
displayNotifications(await notifications.json());
```

---

## 🔐 Authentification

Tous les endpoints nécessitent :
- **Token JWT** dans le header : `Authorization: Bearer <token>`
- **Rôle ADMIN** ou **ORGANISATION** (avec `AGENT`, `SUPERVISEUR` ou `ADMINISTRATION`)
- **Vérification** : Les utilisateurs ORGANISATION ne peuvent voir que leur propre organisation

---

## 📝 Notes importantes

- **Exclusion automatique** : Tous les endpoints excluent les brouillons (`BROUILLON`) et les demandes avec OTP non vérifié
- **Statistiques en temps réel** : Les statistiques sont calculées en temps réel
- **Tri par date** : Les demandes et activités sont triées par date (plus récentes en premier)
- **Limites par défaut** : Les endpoints avec limite ont des valeurs par défaut raisonnables (5 pour recent-requests, 10 pour recent-activity)

---

## 🔄 Endpoints existants (non modifiés)

Les endpoints suivants restent disponibles pour d'autres usages :
- `GET /api/organisations/:id/statistics` - Statistiques complètes (demandes + utilisateurs + formulaires)
- `GET /api/organisations/:id/requests` - Toutes les demandes avec filtres
- `GET /api/organisations/:id/users` - Liste des employés
- `GET /api/organisations/:id/forms` - Liste des formulaires





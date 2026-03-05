# 📊 Endpoints Dashboard Client - Secure Link

## Vue d'ensemble

Le dashboard client est maintenant séparé en **4 endpoints distincts** pour une meilleure modularité et performance. Chaque section du dashboard peut être chargée indépendamment.

---

## 🔗 Endpoints disponibles

### 1. **Statistiques du Dashboard**
**Endpoint :** `GET /api/clients/statistics`

**Description :** Retourne les statistiques des demandes du client (cartes de métriques)

**Rôle requis :** `CLIENT`

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

---

### 2. **Demandes Récentes**
**Endpoint :** `GET /api/clients/recent-requests`

**Description :** Retourne les demandes récentes du client

**Rôle requis :** `CLIENT`

**Paramètres de requête :**
- `limit` (optionnel) : Nombre de demandes à retourner (par défaut: 5)

**Exemple :** `GET /api/clients/recent-requests?limit=10`

**Réponse :**
```json
[
  {
    "id": "req-123",
    "requestNumber": "DEM-001",
    "institution": "Sonatel",
    "category": "Télécom",
    "type": "Abonnement internet",
    "date": "2024-01-15T10:30:00Z",
    "status": "EN_ATTENTE",
    "timeAgo": "Il y a 2 heures"
  }
]
```

**Utilisation :** Afficher le tableau "Demandes récentes" du dashboard

---

### 3. **Documents Expirant Bientôt**
**Endpoint :** `GET /api/clients/expiring-documents`

**Description :** Retourne les documents qui expirent dans les prochains jours

**Rôle requis :** `CLIENT`

**Paramètres de requête :**
- `days` (optionnel) : Nombre de jours avant expiration (par défaut: 60)

**Exemple :** `GET /api/clients/expiring-documents?days=30`

**Réponse :**
```json
[
  {
    "id": "doc-123",
    "type": "Passeport",
    "expirationDate": "2026-01-30",
    "daysUntilExpiration": 15,
    "status": "EN_VERIFICATION",
    "fileName": "passeport.pdf"
  }
]
```

**Utilisation :** Afficher le tableau "Documents expirant bientôt" du dashboard

---

### 4. **Alertes et Notifications**
**Endpoint :** `GET /api/clients/notifications`

**Description :** Retourne toutes les notifications du client (documents expirant, validés, rejetés, demandes, etc.)

**Rôle requis :** `CLIENT`

**Paramètres de requête :**
- `unreadOnly` (optionnel) : Retourner uniquement les notifications non lues (`true`/`false`)

**Exemple :** `GET /api/clients/notifications?unreadOnly=true`

**Réponse :**
```json
[
  {
    "id": "doc-exp-123",
    "type": "DOCUMENT_EXPIRING",
    "severity": "ERROR",
    "title": "Carte d'identité expire bientôt",
    "message": "Votre carte d'identité expire dans 15 jours, renouvelé dès maintenant.",
    "date": "2024-01-15T07:35:00Z",
    "timeAgo": "Aujourd'hui, 07:35",
    "relatedId": "doc-123",
    "relatedType": "document",
    "isRead": false
  },
  {
    "id": "doc-val-456",
    "type": "DOCUMENT_VALIDATED",
    "severity": "SUCCESS",
    "title": "Permis de conduire validé",
    "message": "Votre permis de conduire a été validé avec succès. score: 98%",
    "date": "2024-01-15T07:55:00Z",
    "timeAgo": "Aujourd'hui, 07:55",
    "relatedId": "doc-456",
    "relatedType": "document",
    "isRead": false
  }
]
```

**Types de notifications :**
- `DOCUMENT_EXPIRING` : Document expirant bientôt (severity: ERROR)
- `DOCUMENT_VALIDATED` : Document validé (severity: SUCCESS)
- `DOCUMENT_REJECTED` : Document rejeté (severity: ERROR)
- `VERIFICATION_PENDING` : Vérification en attente (severity: WARNING)
- `REQUEST_VALIDATED` : Demande validée (severity: SUCCESS)
- `REQUEST_REJECTED` : Demande rejetée (severity: ERROR)

**Utilisation :** Afficher la liste "Alertes et notifications" du dashboard

---

## 📋 Structure du Dashboard

Le dashboard client est composé de 4 sections principales :

```
┌─────────────────────────────────────────────────┐
│  📊 STATISTIQUES (5 cartes)                     │
│  GET /api/clients/statistics                    │
├─────────────────────────────────────────────────┤
│  📋 DEMANDES RÉCENTES (Tableau)                 │
│  GET /api/clients/recent-requests?limit=5       │
├─────────────────────────────────────────────────┤
│  📄 DOCUMENTS EXPIRANT (Tableau)                │
│  GET /api/clients/expiring-documents?days=60    │
├─────────────────────────────────────────────────┤
│  🔔 NOTIFICATIONS (Liste)                       │
│  GET /api/clients/notifications                 │
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
// Charger le dashboard en parallèle
const [statistics, recentRequests, expiringDocs, notifications] = await Promise.all([
  fetch('/api/clients/statistics'),
  fetch('/api/clients/recent-requests?limit=5'),
  fetch('/api/clients/expiring-documents?days=60'),
  fetch('/api/clients/notifications'),
]);

// Afficher chaque section indépendamment
displayStatistics(await statistics.json());
displayRecentRequests(await recentRequests.json());
displayExpiringDocuments(await expiringDocs.json());
displayNotifications(await notifications.json());
```

---

## 🔐 Authentification

Tous les endpoints nécessitent :
- **Token JWT** dans le header : `Authorization: Bearer <token>`
- **Rôle CLIENT** dans le token

---

## 📝 Notes

- Les endpoints excluent automatiquement les brouillons (`BROUILLON`) et les demandes avec OTP non vérifié
- Les statistiques sont calculées en temps réel
- Les notifications sont triées par date (plus récentes en premier)
- Les documents expirants sont filtrés par défaut sur 60 jours





# [B2] Port Push Notifications PWA → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/B2-push-pwa-port`
> **Charge** : 4h
> **Dépend de** : A4 (DB Postgres bridge existe)
> **Bloque** : C2 (page Push tab)

---

## But

Porter les push notifications PWA (web-push) depuis `veridian-analytics/lib/web-push.ts` + `lib/push-subscribe.ts` + endpoints `app/api/push/*` vers bridge.

Use case : un tenant peut envoyer une notif push à ses utilisateurs PWA abonnés ("Nouvelle promo", "Devis prêt", etc.).

## Spec

### Schéma Prisma bridge

```prisma
model PushSubscription {
  id          String   @id @default(cuid())
  tenantId    String
  siteId      String?  // optionnel — push lié à un site spécifique
  endpoint    String   @unique  // URL push provider (FCM, Apple, etc.)
  keys        Json     // { p256dh, auth }
  userAgent   String?
  visitorId   String?  // cookie vrd_vid si présent
  createdAt   DateTime @default(now())
  lastSeenAt  DateTime @default(now())
  active      Boolean  @default(true)
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, active])
}

model PushNotification {
  id          String   @id @default(cuid())
  tenantId    String
  title       String
  body        String
  url         String?  // URL à ouvrir au clic
  icon        String?
  targetCount Int      @default(0)
  successCount Int     @default(0)
  failureCount Int     @default(0)
  sentAt      DateTime @default(now())
  sentBy      String?  // user id qui a envoyé
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, sentAt])
}
```

### Lib à porter
**`veridian-bridge/src/push/index.ts`** :
- `subscribePushClient(tenantId, payload)` — enregistre une PushSubscription
- `unsubscribePushClient(endpoint)` — marque `active=false`
- `sendNotificationToTenant(tenantId, notification)` — boucle sur les subs actives, envoie via `web-push`, log le résultat dans `PushNotification`
- `getVapidPublicKey()` — retourne la public key VAPID au front

### ENV à configurer

VAPID keys générées via `web-push generate-vapid-keys` :
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT=mailto:robert.brunon@veridian.site`

Stockage dans `~/credentials/.all-creds.env` (search `VAPID_`). Si déjà présent côté legacy, **réutiliser les mêmes** pour ne pas invalider les abonnements existants.

### Endpoints
- `POST /api/push/subscribe` (PUBLIC, appelé depuis site client) — `{ siteKey, endpoint, keys, visitorId? }`
- `POST /api/push/unsubscribe` (PUBLIC) — `{ endpoint }`
- `GET /api/push/vapid-key` (PUBLIC) — `{ publicKey }`
- `POST /api/admin/push/send` (admin) — `{ tenantId, title, body, url?, icon? }` → push à tous les subs actifs
- `GET /api/admin/tenant/:workspaceId/push/subscribers` → liste avec count
- `GET /api/admin/tenant/:workspaceId/push/history` → historique des notifs envoyées

## Tests obligatoires

`veridian-bridge/tests/push/` :
- [ ] `subscribe.test.ts` : POST subscribe → row créée
- [ ] `unsubscribe.test.ts` : POST unsubscribe → row marquée active=false
- [ ] `send-notification.test.ts` : mock `web-push.sendNotification` → boucle OK, count success/failure correct
- [ ] `vapid-key.test.ts` : retourne la clé publique
- [ ] `expired-subscription-cleanup.test.ts` : si web-push retourne 410 Gone → marque la sub `active=false`

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/push/index.ts
    - veridian-bridge/src/push/subscribe.ts
    - veridian-bridge/src/push/send.ts
  covered_by:
    - veridian-bridge/tests/push/subscribe.test.ts
    - veridian-bridge/tests/push/unsubscribe.test.ts
    - veridian-bridge/tests/push/send-notification.test.ts
    - veridian-bridge/tests/push/vapid-key.test.ts
    - veridian-bridge/tests/push/expired-subscription-cleanup.test.ts
```

## Status

📦 ARCHIVED 2026-05-23 par cleanup-veridian-scope (PR #5 → main `a5a5189`).

Scope final Robert 2026-05-23 : PWA + push notifications hors V1 commercialisable. Code conservé sous `_archive/` (bridge `_archive/push/`, console `_archive/`, tests `_archive/`). DB tables `PushSubscription` + `PushNotification` **conservées** (pas de drop destructif). ENV `VAPID_*` retirées des composes.

Réactivation = décision business Robert (cf CLAUDE.md VISION).

Livré : modèles Prisma `PushSubscription` + `PushNotification` + migration
`20260521000002_add_push_subscriptions` · lib `src/push/index.ts` (subscribe /
unsubscribe / sendNotificationToTenant / getVapidPublicKey + cleanup 410 Gone) ·
6 endpoints `src/push/routes.ts` (subscribe / unsubscribe / vapid-key publics +
admin send / subscribers / history) · ENV VAPID_* documentées dans `.env.example`
(clés legacy réutilisées via Dokploy ENV — non commitées) · 31 tests push verts ·
`test-coverage-map.yaml` à jour. Suite bridge totale : 222 tests verts.

## Notes pour l'agent qui pick

- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/lib/web-push.ts`, `lib/push-subscribe.ts`, `app/api/push/*`
- Package npm : `web-push` (déjà utilisé côté legacy)
- **Réutiliser les VAPID keys existantes** si présentes dans `.all-creds.env` (sinon les abonnements PushSubscription historiques deviennent invalides)
- Migration historique : dump `analytics.PushSubscription` legacy → import bridge (cf. D2)
- **Frontend service worker** : `public/sw.js` côté legacy gère le receive notification + click action. À porter dans la console staminads dans ticket C1

# [B-VOIP] Ingestion des logs d'appels VoIP → bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/B-VOIP-call-logs` depuis `staging`
> **Charge** : 8h
> **Dépend de** : U8 (table `TenantCredential` pour les creds VoIP) — peut démarrer
>   en parallèle en stubbant la lecture des creds

---

## But

Le bridge pull les logs d'appels téléphoniques des tenants qui ont branché un
provider VoIP (cf U8). Alimente le tab Calls du dashboard. Port de la logique
`sipCall` du legacy `veridian-analytics`.

## Modèle Prisma bridge

```prisma
model SipCall {
  id            String   @id @default(cuid())
  tenantId      String
  siteId        String?
  provider      String   // 'ovh' | 'telnyx'
  externalId    String   // id de l'appel chez le provider
  direction     String   // 'inbound' | 'outbound'
  fromNumber    String
  toNumber      String
  durationSec   Int      @default(0)
  status        String   // 'answered' | 'missed' | 'busy' | 'failed'
  recordingUrl  String?
  startedAt     DateTime
  visitorId     String?  // matché si l'appel vient d'un clic tel: tracké
  createdAt     DateTime @default(now())
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([provider, externalId])
  @@index([tenantId, startedAt])
}
```

## Lib `veridian-bridge/src/voip/`

- `providers/ovh.ts` — client API OVH Telephony (utilise les creds chiffrés du tenant)
- `providers/telnyx.ts` — client API Telnyx Call Control / CDR
- `sync.ts` — `syncCallLogs(tenantId)` : déchiffre les creds, pull les CDR du
  provider, upsert `SipCall` (idempotent via `@@unique(provider, externalId)`)
- `index.ts` — orchestration + matching visitorId (un appel depuis un clic `tel:`
  tracké → relie l'appel à la session web)

## Endpoints

- `POST /api/admin/voip/sync?tenantId=...` — force resync
- `POST /api/admin/voip/sync-all` — cron endpoint (IP allowlist)
- `GET /api/admin/tenant/:wsId/calls?days=30` — liste des appels pour le tab Calls

## Cron

Daily ou toutes les heures : `sync-all` pour tous les tenants ayant un
`TenantCredential` VoIP `status=ok`. Cron systemd dev-pub OU workflow GH Actions
(cohérent avec `gsc-sync-cron.yml`).

## Référence legacy
`veridian-analytics/app/(dashboard)/dashboard/calls/page.tsx` (modèle `sipCall`,
clics CTA `tel:`/`mailto:`).

## Tests
- Unitaires : sync upsert, matching visitorId, déchiffrement creds
- Intégration : contre vrai Postgres (upsert idempotent, contrainte unique)
- Mock les API OVH/Telnyx côté HTTP

## Coordination
- Quand B-VOIP est livré : le tab Calls de l'UI (ticket U9) peut le consommer
- Endpoint `/api/admin/voip/sync` configuré côté Settings (U8) bouton "Tester"

## Status
✅ livré — mergé sur `staging` (SHA `0eca29e`), 2026-05-22

### Notes d'implémentation
- **Pas de table de creds dédiée** : B-VOIP consomme `TenantCredential`
  (kind `voip_ovh` / `voip_telnyx`) créée par U8. `src/voip/credentials.ts`
  est un simple adaptateur de lecture qui déchiffre les creds VoIP. Le CRUD
  (saisie / test / suppression) est servi par U8 — pas dupliqué.
- **OVH self-service** : le client OVH découvre les `billingAccounts` +
  `serviceNames` depuis l'API. Les 3 clés OVH de la saisie U8 suffisent —
  zéro champ supplémentaire à demander au tenant.
- **Contrat /calls aligné U9** : `listCalls` retourne la shape
  `CallsResponse` attendue par le tab Calls (`voipConnected`, `peerNumber`,
  `stats {total,missed,avgDurationSec,answerRate}`, `daily[]`).
- **Endpoints livrés** : `POST /api/admin/voip/sync`,
  `POST /api/admin/voip/sync-all` (Bearer ou IP allowlist),
  `GET /api/admin/tenant/:wsId/calls`.
- **Cron** : `.github/workflows/voip-sync-cron.yml`, gated sur la variable
  repo `VOIP_SYNC_ENABLED` (à activer quand B-VOIP est en prod).
- **Tests** : 3 fichiers unitaires (mocks HTTP OVH/Telnyx) + 1 intégration
  contre un vrai Postgres (upsert idempotent, matching visitorId, cascade
  FK, endpoints HTTP).

---

## Update 2026-05-23 — UI-POLISH-CORE : sous-route native côté console

PR #4 mergée sur `main` (SHA `c3ec010`).

L'UI Calls est désormais une **vraie sous-route staminads native** à
`/workspaces/$wsId/calls` (et non plus un tab du dashboard custom Veridian
qui va disparaître). Le fichier B-VOIP côté bridge reste inchangé — c'est
toujours `GET /api/admin/tenant/:wsId/calls?days=N` qui est consommé.

Vu côté UI :
- `console/src/routes/_authenticated/workspaces/$workspaceId/calls.tsx`
  (nouvelle route)
- Réutilise les vues existantes :
  `console/src/veridian/pages/dashboard-tabs/calls-tab.tsx`,
  `calls-tab-views.tsx`, `calls-hooks.ts`
- Nav staminads enrichie avec lien "Appels"

Quand B-VOIP livrera son endpoint (404 actuel → données réelles), aucune
modif côté UI nécessaire : le hook `useCalls` gère déjà tous les états
(404 → not-connected, voipConnected:false → not-connected, data → ready).

---

## ⚠️ Mise à jour 2026-05-24 — Section UI obsolète

Depuis `refactor/ui-native-pure` (SHA `43aa4d4`, 2026-05-23) :
- Les sous-routes dédiées `/workspaces/$wsId/calls` et `/workspaces/$wsId/search-console` ont été **supprimées**
- Les features VoIP et GSC vivent maintenant **dans Settings** (`?section=voip` et `?section=search-console`)
- Le lien nav "Appels" et "Search Console" a été retiré
- Les appels VoIP sont poussés comme events staminads natifs `phone_call` → apparaissent dans Live/Explore/Goals automatiquement

Donc toute la section "UI" de ce ticket décrit l'ancienne archi (page dédiée). La **partie bridge / endpoints** reste valable et est livrée. Voir aussi :
- `todo/2026-05-24-explore-event-name-phone-call.md`
- `todo/2026-05-24-gsc-disconnect-endpoints-bridge.md`
- `todo/2026-05-24-verify-voip-events-in-live-explore.md`
- `CLAUDE.md` section "Règle d'architecture UI (figée 2026-05-23)"

# [A4] Port intégration Google Search Console → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/A4-gsc-integration-port`
> **Charge** : 8h (gros morceau dédié)
> **Dépend de** : rien (autonome — crée sa propre DB Postgres)
> **Bloque** : C2 (page GSC tab consomme cet endpoint)

---

## But

Porter l'intégration GSC (Search Console) depuis `veridian-analytics/lib/gsc.ts` + `lib/gsc-query.ts` + `app/api/admin/gsc/sync/route.ts` vers bridge. Le bridge devient le proprio des tables GSC (Postgres dédié, pas dans staminads ClickHouse car volume faible).

## Spec

### Infrastructure
- **Service Postgres bridge** : ajouter dans `compose/dev.yml` + `compose/base.yml`
- **Image** : `postgres:16-alpine` (cohérent avec autres apps Veridian)
- **DB name** : `veridian_bridge`
- **User/password** : ENV `BRIDGE_DB_USER` / `BRIDGE_DB_PASSWORD`

### Schéma Prisma bridge
**`veridian-bridge/prisma/schema.prisma`** (nouveau fichier — premier schéma BDD du bridge)

```prisma
model Tenant {
  id              String   @id @default(cuid())
  workspaceId     String   @unique  // ref staminads workspace
  slug            String   @unique
  name            String
  // Hub integration (ticket B3 étend ce modèle)
  hubTenantId     String?  @unique
  plan            String   @default("free")
  status          String   @default("active")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  gscProperties   GscProperty[]
}

model GscProperty {
  id              String   @id @default(cuid())
  tenantId        String
  siteUrl         String   // ex: sc-domain:tramtech-depannage.fr
  type            String   // 'SITE' | 'DOMAIN'
  ownershipState  String   // 'verified' | 'pending' | 'failed'
  lastSyncAt      DateTime?
  oauthAccount    Json?    // tokens chiffrés (port depuis Account legacy)
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  dailyRows       GscDaily[]
  @@unique([tenantId, siteUrl])
}

model GscDaily {
  id            String   @id @default(cuid())
  gscPropertyId String
  date          DateTime @db.Date
  query         String?  // top queries (null = aggregated row)
  page          String?  // top pages (null = aggregated row)
  country       String?
  device        String?
  impressions   Int      @default(0)
  clicks        Int      @default(0)
  position      Float?   // average position
  ctr           Float?
  gscProperty   GscProperty @relation(fields: [gscPropertyId], references: [id], onDelete: Cascade)
  @@unique([gscPropertyId, date, query, page, country, device])
  @@index([gscPropertyId, date])
}
```

### Lib à porter
**`veridian-bridge/src/gsc/index.ts`** :
- `oauthBeginFlow(tenantId)` — démarre OAuth Google
- `oauthCallback(code, state)` — exchange code → tokens chiffrés en DB
- `syncProperty(gscPropertyId, days)` — pull GSC API + insert/upsert GscDaily
- `queryProperty(gscPropertyId, filters)` — query joinée pour le dashboard

### Cron daily sync
- **Cron** : 04:00 UTC chaque jour, sync les 7 derniers jours pour tous les `GscProperty` `verified`
- Backoff exponentiel si GSC API rate limit
- Implémentation : `setInterval` au boot du bridge OU service externe (préférable : cron local dev-pub qui appelle `POST /api/admin/gsc/sync-all`)

### Endpoints
- `POST /api/admin/gsc/oauth-begin?tenantId=...` → URL OAuth Google à ouvrir
- `GET /api/admin/gsc/oauth-callback?code=...&state=...` → exchange + redirect dashboard
- `POST /api/admin/gsc/sync?gscPropertyId=...&days=30` → force resync
- `POST /api/admin/gsc/sync-all` → cron endpoint (auth IP allowlist + admin key)
- `GET /api/admin/tenant/:workspaceId/gsc?days=30` → data formatée pour dashboard (top queries + top pages + total clicks/impressions/CTR)

## Tests obligatoires

- [ ] `veridian-bridge/tests/gsc-query-parsing.test.ts` : valide la query SQL Prisma sur fixtures
- [ ] `veridian-bridge/tests/gsc-oauth-flow.test.ts` : mock Google OAuth → callback OK + tokens en DB chiffrés
- [ ] `veridian-bridge/tests/gsc-sync.test.ts` : mock Google API → assertion GscDaily upsert correctement
- [ ] `veridian-bridge/tests/integration/gsc-end-to-end.test.ts` : full path sync → query → format dashboard

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/gsc/index.ts
    - veridian-bridge/src/gsc/oauth.ts
    - veridian-bridge/src/gsc/sync.ts
    - veridian-bridge/src/gsc/query.ts
  covered_by:
    - veridian-bridge/tests/gsc-query-parsing.test.ts
    - veridian-bridge/tests/gsc-oauth-flow.test.ts
    - veridian-bridge/tests/gsc-sync.test.ts
    - veridian-bridge/tests/integration/gsc-end-to-end.test.ts
```

## ENV à configurer

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI=https://analytics-engine-bridge-dev.staging.veridian.site/api/admin/gsc/oauth-callback`
- `BRIDGE_DB_HOST`, `BRIDGE_DB_PORT`, `BRIDGE_DB_USER`, `BRIDGE_DB_PASSWORD`, `BRIDGE_DB_NAME`
- `TOKEN_ENCRYPTION_KEY` (32 chars hex) pour chiffrer les OAuth tokens en DB

Les ENV Google OAuth viennent de `~/credentials/.all-creds.env` (search `GSC_` ou `GOOGLE_OAUTH_`).

## Status

✅ livré 2026-05-21 — branche `feat/A4-gsc-integration-port` sur `veridian-analytics-engine`

### Livraisons

- **Schema Prisma bridge** (`veridian-bridge/prisma/schema.prisma`) :
  - `Tenant` avec colonnes B3 incluses (hubTenantId, plan, planSource, status, apiKey, suspendedAt, softDeletedAt)
  - `GscProperty` (oauthAccount JSON chiffré AES-256-GCM, ownership state)
  - `GscDaily` (clicks/impressions/position/ctr × date/query/page/country/device/searchType)
  - Migration initiale générée : `prisma/migrations/20260521000000_init_bridge_postgres/`
- **Lib GSC** (`veridian-bridge/src/gsc/`) :
  - `oauth.ts` : encrypt/decrypt AES-256-GCM, state HMAC, exchange/refresh/persist
  - `sync.ts` : pull GSC API + upsert GscDaily + backoff exponentiel 429/5xx
  - `query.ts` : DSL queryProperty + dashboardSummary (top queries/pages/timeseries)
  - `routes.ts` : registerGscRoutes(app, deps) — module isolé (pas de modif `app.ts`)
- **Infra compose** : `postgres-bridge` (postgres:16-alpine) ajouté à `compose/dev.yml` + `compose/base.yml`, healthcheck + bridge dependency
- **Dockerfile** + `Dockerfile.dev` : `prisma generate` au postinstall, `prisma migrate deploy` au boot
- **Tests (4 fichiers, 26 nouveaux tests)** :
  - `tests/gsc-oauth-flow.test.ts` : encrypt round-trip, state HMAC + tamper, exchangeCode, refresh, persist, getAccessToken cache+refresh, oauthCallback
  - `tests/gsc-sync.test.ts` : parseRow, pagination, retry 429/5xx, syncProperty insert/delete/filter, syncAllVerified
  - `tests/gsc-query-parsing.test.ts` : buildWhereFragments whitelist, queryProperty totals/groupBy/limits, dashboardSummary
  - `tests/integration/gsc-end-to-end.test.ts` : E2E full flow Express + FakePrisma + mock Google
  - Total bridge tests : **125 ok / 125 pass** (99 existants + 26 GSC)
- **test-coverage-map.yaml** : bloc complet ajouté (gsc/* + db/prisma.ts + schema.prisma)
- **ENV** : `.env.example` créé avec GOOGLE_OAUTH_*, BRIDGE_DB_*, TOKEN_ENCRYPTION_KEY, GSC_* documentées

### Coordination cross-tickets

- **B3 (Hub contract base)** : modèle `Tenant` créé AVEC tous les champs Hub
  (hubTenantId/plan/planSource/status/apiKey/suspendedAt/softDeletedAt). B3
  n'a qu'à câbler les endpoints, pas à modifier le schema.
- **C2 (UI GSC tab)** : endpoint `GET /api/admin/tenant/:workspaceId/gsc?days=30`
  renvoie `{ property, totals, topQueries, topPages, timeseries }` prêt à
  brancher dans le composant.

### ENV Google OAuth

Credentials Google Cloud Console récupérées depuis `~/credentials/.all-creds.env` :
`GOOGLE_OAUTH_CLIENT_ID=792581780186-iag4kpqgn6d4iipv1rvrnloa7b925m5k.apps.googleusercontent.com`.
Redirect URI à ajouter dans Google Cloud Console quand la prod sera live :
`https://analytics-engine-bridge.staging.veridian.site/api/admin/gsc/oauth-callback`.

## Notes pour l'agent qui pick

- **Gros ticket** — prévoir une session entière dessus
- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/lib/gsc.ts` + `lib/gsc-query.ts` + `app/api/admin/gsc/sync/route.ts`
- Référence schéma legacy : `prisma/schema.prisma` (models `GscProperty`, `GscDaily`)
- **Sécurité critique** : OAuth tokens en DB DOIVENT être chiffrés (AES-256-GCM)
- L'OAuth Google nécessite que le redirect URI soit dans la console Google Cloud — créer un OAuth Client dédié bridge si nécessaire
- Le bridge a maintenant un Prisma client — ajouter Prisma deps + generate au boot
- **Migration data** : pour les tenants existants qui ont déjà GSC connecté côté legacy, prévoir un script `scripts/migrate-gsc-tenants.ts` qui dump `analytics.GscDaily` legacy → import dans bridge (cf. ticket D2)

---

## Update 2026-05-23 — UI-POLISH-CORE : sous-route Search Console livrée

PR #4 mergée sur `staging` puis `main` (SHA `c3ec010`).

Nouvelle sous-route native staminads à `/workspaces/$wsId/search-console` :

- Fichier : `console/src/routes/_authenticated/workspaces/$workspaceId/search-console.tsx`
- 5 composants legacy GSC portés depuis
  `veridian-analytics/components/gsc/` vers `console/src/veridian/gsc/` :
  - `performance-dashboard.tsx` (orchestrateur, simplifié — 4 fetchs
    parallèles → 1 endpoint summary)
  - `time-series-chart.tsx` (graphe SVG multi-courbes clicks/impressions/
    ctr/position)
  - `data-table.tsx` (tri client, filtre client)
  - `kpi-tile.tsx` (4 tiles cliquables)
  - `types.ts` (interfaces, METRIC_META, DIMENSION_META)
- Endpoint consommé : `GET /api/admin/tenant/:wsId/gsc?days=N`
  (handler `dashboardSummary` du bridge, livré par A4 — déjà en prod)
- Plage temporelle : 7d / 28d / 90d (le legacy avait 16 mois — overkill
  pour la V1 commerciale, on garde les 3 cas utiles)
- Onglets : Mots-clés (top 50) + Pages (top 50) — drop SearchAppearance/
  Country/Device legacy (moins utiles à un client PME local, peuvent être
  réactivés plus tard)
- Tous les états (loading/error/not-connected/data) couverts
- Lien "Search Console" ajouté dans la nav staminads (desktop + mobile)

### Indexation GSC — NON livrée

Robert a demandé l'indexation des pages (indexed/excluded/discovered) en
plus du tracking position/clics. **Pas livrée dans cette PR** : le bridge
actuel n'expose pas l'API `urlInspection.index.inspect` de GSC. C'est un
work à faire côté `veridian-bridge/src/gsc/query.ts` :

1. Ajouter un helper qui appelle `urlInspection.index.inspect` pour les
   top URLs (limite : 1 req par URL, quota strict côté Google)
2. Persister le statut dans `GscDaily` ou un nouveau modèle `GscIndexStatus`
3. Étendre `dashboardSummary` pour retourner un champ `indexStatus`
4. Ajouter une carte dédiée côté console (tile « Pages indexées : 124 / 187 »)

À ouvrir comme ticket bridge dédié (A4-V2-indexation). Pas bloquant pour
la commercialisation V1 — les 4 métriques GSC standard (clicks, impressions,
ctr, position) sont déjà beaucoup plus que ce que les clients PME ont
aujourd'hui.

### Audit Chrome MCP

`https://demo-analytics.veridian.site/workspaces/demo-apple/search-console`
en desktop 1440 et mobile 375 :
- État not-connected affiché correctement (le tenant démo Apple n'a pas
  de propriété GSC connectée)
- Header staminads natif présent + hero FR « Search Console »
- CTA « Connecter ma Search Console » fonctionnel (mailto)
- Pas d'erreur console venant de notre code (toutes les erreurs sont des
  extensions Chrome tierces sans rapport)

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

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

⏳ pending

## Notes pour l'agent qui pick

- **Gros ticket** — prévoir une session entière dessus
- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/lib/gsc.ts` + `lib/gsc-query.ts` + `app/api/admin/gsc/sync/route.ts`
- Référence schéma legacy : `prisma/schema.prisma` (models `GscProperty`, `GscDaily`)
- **Sécurité critique** : OAuth tokens en DB DOIVENT être chiffrés (AES-256-GCM)
- L'OAuth Google nécessite que le redirect URI soit dans la console Google Cloud — créer un OAuth Client dédié bridge si nécessaire
- Le bridge a maintenant un Prisma client — ajouter Prisma deps + generate au boot
- **Migration data** : pour les tenants existants qui ont déjà GSC connecté côté legacy, prévoir un script `scripts/migrate-gsc-tenants.ts` qui dump `analytics.GscDaily` legacy → import dans bridge (cf. ticket D2)

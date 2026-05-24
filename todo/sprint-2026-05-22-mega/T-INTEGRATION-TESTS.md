# [T] Suite de tests d'intégration RÉELS — bridge contre vrais services

> **Repo cible** : `veridian-analytics-engine`
> **Objectif** : "CI verte = tout a été testé sérieusement"
> **Décidé par Robert 2026-05-22**

---

## Le problème

Le sprint giga a livré 12 tickets avec ~222 tests "verts" côté bridge. **MAIS** : 29 fichiers de tests sur ~34 tournent contre un `FakePrismaClient` in-memory maison (453 lignes) + `fake-staminads`. Aucun test bridge ne tourne contre un vrai Postgres.

Conséquence : un test `dedup-by-email` qui passe sur FakePrisma ne garantit RIEN sur le vrai comportement Postgres (contrainte `@@unique`, erreur `P2002`, transactions, cascade FK, types `@db.Date`). **Tests verts ≠ code correct.**

Robert veut : quand la CI passe, ça veut dire que tout a été testé **sérieusement**, pas contre des mocks.

## La stratégie : doubler les chemins critiques

On NE supprime PAS les fakes (tests unitaires rapides = utiles). On **AJOUTE** une suite d'intégration qui tourne contre de **vrais services** :
- Vrai Postgres 16 (service GitHub Actions + docker compose local)
- Vraie staminads (l'engine staminads lui-même, ou un staminads minimal)
- Vraies migrations Prisma appliquées

## Découpage en chantiers parallèles (escadron d'agents)

| Chantier | Périmètre | Zone fichiers (pas de conflit) |
|---|---|---|
| **T1** | SOCLE : harness `bootBridgeWithRealDB()` + Postgres/ClickHouse en services CI + job `integration-tests` dans staging-deploy | `tests/integration/_harness/`, `staging-deploy.yml` |
| **T2** | Tests intégration Hub : provision (3 cas), attach-owner, health, HMAC valide/replay/tamper, paywall | `tests/integration/hub/` |
| **T3** | Tests intégration Forms : ingest happy-path, dedup réel (vraie contrainte unique), rate-limit, XSS, list | `tests/integration/forms/` |
| **T4** | Tests intégration GSC : oauth flow, sync upsert réel, query, cron sync-all | `tests/integration/gsc/` |
| **T5** | Tests intégration Push + Score/tenant-status : subscribe/send/cleanup 410, score contre vraie staminads | `tests/integration/push/`, `tests/integration/analytics/` |
| **T6** | Husky ultra-strict : pre-push exige qu'un fichier `src/X` critique ait un test d'INTÉGRATION (pas juste fake) + audit test-coverage-map | `.husky/`, `scripts/ci/` |

**Ordre** : T1 socle d'abord (les autres en dépendent). Puis T2-T5 en parallèle. T6 en parallèle de tout (zone indépendante).

## Exigences communes à tous les agents T*

1. **Worktree isolé** strict — jamais le checkout principal
2. **Husky jamais bypass**
3. **Modèle Opus**
4. Les tests d'intégration doivent **vraiment** taper le service réel — pas de fake déguisé
5. Chaque test d'intégration doit pouvoir tourner en local (`docker compose -f compose/test.yml up`) ET en CI
6. Commit conventional, merge sur `staging` (le trunk — le repo a été refondu : main ← staging, plus de `dev`)
7. Update `test-coverage-map.yaml`

## Critère de complétion global

- Tous les chemins critiques (provision, dedup, HMAC, paywall, GSC sync, push, score) ont AU MOINS un test qui tourne contre un vrai Postgres
- Le job CI `integration-tests` passe vert
- Husky pre-push refuse un nouveau fichier `src/` critique sans test d'intégration
- `docs/CI-ARCHITECTURE.md` documente la distinction tests unitaires (fakes) vs intégration (réels)

## Status

✅ DONE — T1 ✅ socle. T2 ✅ Hub. T3 ✅ Forms. T4 ✅ GSC. T5 ✅ Push + Score/status.
Suite complète : 24 fichiers `*.integration.test.ts` verts (`run-integration.mjs`).

---

## T5 — Tests intégration Push + Score/tenant-status ✅ DONE (2026-05-22, merge staging `cebd6da`)

7 fichiers `*.integration.test.ts` (37 tests) + 2 helpers.

**Push** (`veridian-bridge/tests/integration/push/`, 26 tests, `bootBridgeWithRealDB` → vrai Postgres) :
- `subscribe` (6) : `POST /api/push/subscribe` → PushSubscription réelle en
  Postgres ; re-subscribe idempotent prouvé par la contrainte `@@unique`
  réelle sur `endpoint` ; ré-attribution cross-tenant sans doublon.
- `unsubscribe` (5) : `UPDATE active=false` relu directement en DB ;
  no-op endpoint inconnu ; scope (ne touche que la sub ciblée).
- `send-notification` (7) : log `PushNotification` réellement inséré puis
  mis à jour (success/failure) ; `findMany active=true` filtré côté Postgres ;
  route admin `POST /api/admin/push/send` bout en bout.
- `expired-cleanup` (5) : web-push 410/404 → `updateMany` passe les subs
  `active=false` RÉELLEMENT en DB ; mix 201/410/500 ; bulk 410.
- `cascade` (3) : `DELETE Tenant` → PushSubscription/PushNotification
  cascadés par la FK Postgres (impossible à prouver sur FakePrisma).
- Seul mock = le `PushSender` (service tiers FCM/Mozilla), via
  `setPushSenderForTests`.

**Analytics** (`veridian-bridge/tests/integration/analytics/`, 11 tests,
`bootBridgeWithRealStaminads` → vraie staminads) :
- `_real-staminads.ts` : serveur HTTP staminads adossé à un VRAI ClickHouse —
  `/api/analytics.query` exécute une vraie agrégation
  `countIf(name='screen_view')` sur des événements réellement insérés.
  Pas un fake déguisé : X pageviews seedés → comptés par ClickHouse → score
  calculé par le vrai chemin HTTP bridge → staminads → ClickHouse.
- `score` (6) : `GET /tenant/:wsId/score` — score 30/50/0 selon
  pageviews+goals réels ; scope CH par workspace.
- `tenant-status` (5) : `GET /tenant/:wsId/status` SANS fetcher injecté —
  vrai `makeStaminadsPageviewsFetcher` → vrai appel HTTP → vraie agrégation CH.

**Isolation cross-fichier** : pas de `resetDb()` (TRUNCATE global) ;
`seedTenantUnique` randomise toutes les colonnes `@unique` (collision
cross-process) ; assertions scopées par `tenantId`. Le runner socle
`run-integration.mjs` (livré par un agent T*) sérialise les fichiers +
base Postgres jetable par invocation → suite déterministe.

`test-coverage-map.yaml` : sections `integration_covered_by` pour
`src/push/*`, `src/score.ts`, `src/tenant-status.ts`.

---

## T4 — Tests intégration GSC ✅ DONE (2026-05-22, merge staging `3fa7dd9`)

4 fichiers `*.integration.test.ts` dans `veridian-bridge/tests/integration/gsc/`
(à côté du `gsc-end-to-end.test.ts` FakePrisma de A4, conservé) — tapent un
VRAI Postgres via le harness T1 `bootBridgeWithRealDB()` :

- **`oauth-flow.integration.test.ts`** (10 tests) — `oauthBeginFlow` (URL
  Google consent + state HMAC anti-CSRF), `oauthCallback` (échange token
  Google mocké HTTP, persistance RÉELLE) : tokens chiffrés AES-256-GCM
  dans `GscProperty.oauthAccount`, vérifié par **lecture SQL brute** qu'aucun
  secret n'apparaît en clair. State falsifié/sans séparateur rejeté avant
  écriture. Re-callback idempotent (vraie contrainte @@unique).
- **`sync.integration.test.ts`** (12 tests) — `syncProperty` upsert RÉEL en
  `GscDaily` ; re-sync idempotent garanti par la vraie contrainte
  `@@unique([gscPropertyId,date,query,page,country,device,searchType])` (7
  dimensions) ; backoff 429/500 retry + 5xx persistant capturé + 403
  non-retry ; `syncAllVerified` ne traite que les `verified`.
- **`query.integration.test.ts`** (14 tests) — `queryProperty` /
  `dashboardSummary` : agrégats (SUM, GROUP BY, ORDER BY, ILIKE, position
  pondérée par impressions, pagination LIMIT/OFFSET) calculés par de VRAIES
  requêtes SQL `$queryRawUnsafe` — pas le ré-impl JS du FakePrisma.
- **`cascade.integration.test.ts`** (8 tests) — suppression Tenant → cascade
  FK réelle `GscProperty` puis `GscDaily` en chaîne ; isolation inter-tenants ;
  `@@unique(tenantId,siteUrl)` scopé ; FK orpheline → P2003.

Fichiers **auto-isolants** : chaque test seede un Tenant à id unique
cross-process (`mkTenant` + nonce), assertions scopées (`where` tenantId /
gscPropertyId). Tournent vert avec le runner séquentiel T3
`scripts/run-integration.mjs` ; 44 tests GSC, 17/17 fichiers d'intégration
verts au total.

`test-coverage-map.yaml` : section `integration_covered_by:` ajoutée pour
`src/gsc/*`.

---

## T3 — Tests intégration Forms ✅ DONE (2026-05-22, merge staging `e90be01`)

7 fichiers `*.integration.test.ts` dans `veridian-bridge/tests/integration/forms/`,
**28 tests verts contre un VRAI Postgres** (harness T1).

| Fichier | Tests | Ce qui tape vraiment Postgres |
|---|---|---|
| `ingest-happy-path.integration.test.ts` | 4 | Chaîne `FormSubmission → Lead → LeadSession → FormSchema` persistée et relue via `prisma` ; event `form_submission` poussé vers une vraie staminads (FakeStaminads HTTP) ; POST sans email → submission sans lead ; body invalide → 400, rien en DB |
| `dedup-by-email.integration.test.ts` | 5 | LE test critique : 2 POST même email/site → 1 Lead `submissionsCount=2` ; contrainte composite `@@unique([siteId,email])` prouvée par un `P2002` réel sur INSERT directe ; même email sur 2 sites → 2 Leads distincts ; dedup case-insensitive ; enrichissement progressif phone/name |
| `missing-sitekey.integration.test.ts` | 3 | siteKey inconnu / tenant soft-deleted → 401 ET 0 row écrite (`count()` sur les 4 tables) ; contrôle positif tenant actif |
| `rate-limit.integration.test.ts` | 2 | 11e req/min/IP → 429 + header `Retry-After` ; exactement 10 submissions en DB pas 11 ; quota par IP (IP B intacte) |
| `xss-sanitization.integration.test.ts` | 5 | `<script>` / `<img onerror>` / `javascript:` / `data:` strippés du JSONB RÉEL relu depuis Postgres ; sanitization récursive (objets/arrays imbriqués) ; round-trip JSONB des données légitimes |
| `list-submissions.integration.test.ts` | 6 | Pagination curseur réelle (`ORDER BY createdAt DESC` + cursor + skip:1, zéro doublon sur 3 pages) ; filtres `formSlug` / `since` / `until` ; 404 tenant inconnu ; 401 sans Bearer |
| `cascade-delete.integration.test.ts` | 3 | DELETE Site → cascade FK sur FormSubmission/FormSchema/Lead/LeadSession ; DELETE Lead → cascade LeadSession seulement ; DELETE Tenant → cascade complète Tenant → Site → tout |

**Fix socle apporté** : nouveau runner `veridian-bridge/scripts/run-integration.mjs`
remplace le glob `node --test` dans `test:integration{,:ci}`. `node --test`
exécute les fichiers en parallèle et `--test-concurrency=1` (posé par T2) s'est
révélé insuffisant (flaky sur node 22). Le runner :
1. exécute chaque fichier dans son propre process, STRICTEMENT séquentiellement ;
2. provisionne une **base Postgres jetable par invocation** (`<db>_run_<pid>_<ts>`,
   migrations appliquées, `DROP` en fin) → plusieurs suites (T2/T3/T4/T5) peuvent
   tourner en parallèle sans collision. Prouvé : 3 invocations concurrentes
   77/77 vertes chacune sur sa base isolée. Fallback transparent sur la base
   partagée si `psql`/admin indisponible.

**test-coverage-map.yaml** : section `integration_covered_by:` ajoutée au bloc
forms (8 sources `src/forms/*`) — lue par le gate T6 `check-integration-coverage.sh`.

---

## T2 — Tests intégration Hub ✅ DONE (2026-05-22, merge staging `b1103b3`)

5 fichiers `*.integration.test.ts` dans `veridian-bridge/tests/integration/hub/`,
**43 tests verts contre un VRAI Postgres** (compose/test.yml + harness T1).

| Fichier | Tests | Ce qui tape vraiment Postgres |
|---|---|---|
| `provision.integration.test.ts` | 11 | Cas A/B/C : rows Tenant écrites et relues via `prisma.tenant.findUnique` ; idempotence + refresh apiKey persisté ; 409 conflit sans mutation ; vraies contraintes `@@unique` workspaceId/hubTenantId/apiKey → `P2002` |
| `hmac.integration.test.ts` | 11 | Signature valide → mutation persistée en DB ; replay/tamper/bad-sig/headers manquants → 401 ET table Tenant vide |
| `attach-owner.integration.test.ts` | 7 | Lien user↔tenant réel dans la table `TenantOwner` (SQL direct) ; re-attach idempotent prouvé par `COUNT(*) = 1` |
| `health.integration.test.ts` | 8 | `sites_count` calculé par un vrai `prisma.site.count` ; `owner_attached`/`magic_link_capable` dérivés de données DB réelles |
| `paywall.integration.test.ts` | 6 | `requireActivePlan` branché sur `PrismaTenantStore` ; 3 statuts non-actifs → 402 ; `UPDATE` status en DB reflété immédiatement (pas de cache) |

**Fix socle apporté** : `test:integration{,:ci}` forcent `--test-concurrency=1`.
Les fichiers d'intégration partagent un seul Postgres et chaque `resetDb` fait
un `TRUNCATE` global — sans sérialisation, les fichiers se piétinent en CI.

**test-coverage-map.yaml** : section `integration_covered_by:` ajoutée aux 6
blocs critiques Hub (provision/attach-owner/health/store/hmac/paywall) — lue
et validée par le gate T6 `check-integration-coverage.sh`.

---

## T1 — SOCLE ✅ DONE (2026-05-22, merge staging `c22aa53`)

Le harness est livré, mergé sur `staging`, CI verte. T2..T5 écrivent leurs
tests AVEC l'API ci-dessous — ils ne touchent PAS `tests/integration/_harness/`.

### Fichiers du socle

| Fichier | Rôle |
|---|---|
| `compose/test.yml` | Postgres 16 + ClickHouse 24.8 éphémères (ports 55432 / 58123 / 59000, tmpfs, zéro volume) |
| `veridian-bridge/tests/integration/_harness/index.ts` | API du harness (boot / reset / seed) |
| `veridian-bridge/tests/integration/_harness/prisma-tenant-store.ts` | `PrismaTenantStore` — `TenantStore` adossé à Postgres (routes Hub) |
| `veridian-bridge/tests/integration/_harness/signed-fetch.ts` | `signedFetch()` — requêtes HMAC pour les tests Hub |
| `veridian-bridge/tests/integration/_harness/smoke.integration.test.ts` | Test de référence (pattern à copier) |
| `scripts/run-integration-tests.sh` | Runner local (up compose → test → teardown) |
| `staging-deploy.yml` étage 1.f `integration-tests` | Job CI bloquant, services Postgres+ClickHouse |

### API EXACTE du harness — `import ... from "../_harness/index.js"`

```ts
// ─── BOOT ───────────────────────────────────────────────────────────────
bootBridgeWithRealDB(opts?: BootOptions): Promise<BridgeHarness>
// → { url: string, prisma: PrismaClient, store: TenantStore, close: () => Promise<void> }
//   url    : instance bridge HTTP (port éphémère) — TOUTES les routes montées
//            (base + Hub HMAC + GSC + Forms + Push)
//   prisma : vrai PrismaClient sur la DB de test — pour assertions DB + seed
//   store  : PrismaTenantStore réel (utilisé par les routes /api/tenants/*)
//   close  : ferme le serveur + déconnecte Prisma (à appeler dans after())

bootBridgeWithRealStaminads(opts?: BootOptions): Promise<StaminadsBridgeHarness>
// → BridgeHarness + { staminadsUrl: string }
//   Si opts.staminadsUrl ou env STAMINADS_TEST_URL fourni → vraie staminads.
//   Sinon → faux serveur staminads HTTP local (FakeStaminads).
//   Pour les tests T5 score / tenant-status.

// BootOptions (tout optionnel) :
interface BootOptions {
  staminadsUrl?: string;          // default endpoint inerte http://127.0.0.1:9
  skipHmac?: boolean;             // default false (les tests Hub signent)
  createStaminadsWorkspace?: (input) => Promise<{workspaceId, apiKey}>; // hook provision
  loadStats?: (tenant) => Promise<HealthStats>;  // hook /api/tenants/:id/health
}

// ─── RESET (isolation) ──────────────────────────────────────────────────
resetDb(prisma: PrismaClient): Promise<void>
// TRUNCATE CASCADE de toutes les tables app. À appeler en beforeEach().

// ─── SEED ───────────────────────────────────────────────────────────────
seedTenant(prisma, overrides?: SeedTenantOverrides): Promise<Tenant>
// Crée une row Tenant réelle. Champs uniques (workspaceId, slug, hubTenantId,
// apiKey) auto-générés frais → pas de collision entre 2 appels sans override.
// overrides: { workspaceId?, slug?, name?, hubTenantId?, plan?, planSource?,
//              status?, apiKey?, suspendedAt?, softDeletedAt? }

seedSite(prisma, tenantId: string, overrides?: SeedSiteOverrides): Promise<Site>
// Crée une row Site réelle rattachée à un Tenant. Pour tests Forms / Push.
// overrides: { siteKey?, domain?, name? }

// ─── SIGNED FETCH (tests Hub HMAC) ──────────────────────────────────────
signedFetch(url, method, path, body, opts?: SignedFetchOptions): Promise<Response>
// Requête HTTP signée HMAC. opts pour simuler attaques :
// { secret?, timestampOverride?, signatureOverride?, omitTimestamp?,
//   omitSignature?, bodyAfterSign? }

// ─── CONSTANTES exportées ───────────────────────────────────────────────
TEST_HMAC_SECRET     // secret HMAC Hub (signedFetch l'utilise par défaut)
TEST_ADMIN_KEY       // Bearer pour les routes /api/admin/*
TEST_ENCRYPTION_KEY  // clé AES-256-GCM (64 hex) pour les tokens GSC
```

### Pattern obligatoire pour T2..T5

```ts
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { bootBridgeWithRealDB, resetDb, seedTenant,
         type BridgeHarness } from "../_harness/index.js";

let h: BridgeHarness;
before(async () => { h = await bootBridgeWithRealDB(); });   // 1× par fichier
after(async () => { await h.close(); });                     // TOUJOURS
beforeEach(async () => { await resetDb(h.prisma); });        // isolation

test("...", async () => {
  await seedTenant(h.prisma, { slug: "acme" });
  const res = await fetch(`${h.url}/api/admin/...`, {
    headers: { Authorization: `Bearer ${TEST_ADMIN_KEY}` },
  });
  assert.equal(res.status, 200);
});
```

### Règles T2..T5

1. **Nom de fichier** : `*.integration.test.ts` (jamais `*.test.ts` — sinon
   happé par le glob `test:ci` rapide sans Postgres → plante).
2. Tests dans `tests/integration/<feature>/` (hub / forms / gsc / push / analytics).
3. `before`/`after` pour boot/close 1× par fichier (le boot coûte ~1s).
4. `beforeEach(() => resetDb(h.prisma))` systématique.
5. Ne JAMAIS toucher `process.env` — le harness gère la config.
6. `h.prisma` pour les assertions DB directes, `h.url` pour le HTTP.

### Lancer en local

```bash
cd veridian-bridge
npm run test:integration:local   # gère compose/test.yml (up → test → down)
# ou, si compose/test.yml déjà up :
BRIDGE_TEST_DATABASE_URL=postgresql://bridge_test:bridge_test_pwd@127.0.0.1:55432/veridian_bridge_test \
  npm run test:integration
```

### Scripts npm (bridge)

| Script | Effet |
|---|---|
| `test:ci` / `test` | tests unitaires (fakes) — exclut `*.integration.test.ts` |
| `test:integration` | tests `*.integration.test.ts` (services doivent être up) |
| `test:integration:ci` | idem, reporter TAP (utilisé en CI) |
| `test:integration:local` | up `compose/test.yml` → test → teardown |

### T6 — Husky ultra-strict + gate couverture intégration → ✅ LIVRÉ 2026-05-22

Merge `staging` : `2724f772dd66c3575cce9dc2530c1ff90065a1dd`

Livré :
- **`scripts/ci/check-integration-coverage.sh`** (nouveau) — pour chaque
  fichier CRITIQUE modifié, exige un `*.integration.test.ts` qui le couvre
  (mapping via section `integration_covered_by:` du `test-coverage-map.yaml`).
  Fichiers critiques : `veridian-bridge/src/{forms,push,hub,gsc}/*`,
  `hub-hmac.ts`, `paywall.ts`, `score.ts`, `tenant-status.ts`.
  **Mode actuel : `warn` + allowlist transitoire** (les 23 fichiers critiques
  sont allowlistés avec `# TODO: intégration T2/T3/T4/T5`). Le push n'est PAS
  bloqué tant que T1-T5 montent la couverture.
- **`static-audit.sh` durci** — `it.only`/`test.only`/`describe.only` et
  `xit`/`xdescribe`/`xtest` bloquants dans les fichiers de tests ;
  `it.skip`/`describe.skip` en warning.
- **Split unitaire/intégration** — `veridian-bridge/package.json` : `test:ci`
  exclut désormais les `*.integration.test.ts` (pre-push rapide) ; ajout
  `test:integration` + `test:integration:ci` pour le job CI.
- **`pre-push` réordonné** — protected-branch → conv-commits → test-mapping →
  **integration-coverage** → static-audit → env-sync → typecheck+tests
  unitaires → npm audit. Ne lance PAS les tests d'intégration (CI s'en charge).
- **Fix** : fallback `BASE_REF` obsolète `origin/dev` → `origin/staging`.
- **`docs/CI-ARCHITECTURE.md` §2.5** — distinction tests unitaires (fakes,
  pre-push) vs intégration (réels, CI) + procédure passage warn→block.

**Passage du gate `warn` → `block`** (à faire quand T2-T5 ont fini) :
1. T2-T5 ont mergé leurs `*.integration.test.ts` sur `staging`.
2. Chaque groupe critique a sa section `integration_covered_by:` dans
   `test-coverage-map.yaml`.
3. Vider l'`ALLOWLIST` en tête de `check-integration-coverage.sh`.
4. Passer la constante `MODE="block"` dans le même script.

⚠ Note infra : les runners GitHub Actions du repo sont inactifs depuis
2026-04-24 (dernier run avant refonte). Le push `staging` n'a pas déclenché
`staging-deploy.yml`. À vérifier côté infra — hors scope T6.

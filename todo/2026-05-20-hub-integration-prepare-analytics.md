# [HUB INTEGRATION] Préparer Analytics au contrat Hub Veridian

> **Type** : Préparation contrat Hub (de `❌` à `✅` ligne par ligne dans matrice §10 de CONTRAT-HUB.md)
> **Sévérité** : 🟧 P2 (active, à câbler par phases dans le sprint courant)
> **Owner** : agent Analytics
> **Spec source de vérité** : [`../CONTRAT-HUB.md`](../CONTRAT-HUB.md) (2929 lignes)
> **Créé** : 2026-05-20

---

## Pourquoi

Aujourd'hui Analytics est **bring-your-own-key** (chaque tenant crée son compte directement sur `analytics.app.veridian.site`, pas via Hub). Robert veut converger les 6 apps Veridian vers un **provisioning Hub unifié** pour :

1. **1 email → 1 compte Veridian → N apps** (pas re-signup chaque app)
2. **Billing centralisé** via Stripe côté Hub
3. **Plan unique** propagé aux apps (free/pro/etc.)
4. **Magic link cross-app** (Hub → app sans re-login)
5. **Soft delete + restore + paywall obfusqué** (v1.1 du contrat)

Matrice §10 actuelle (CONTRAT-HUB.md ligne 2241+) : **Analytics = ❌ partout**.
Ce ticket vise à passer à **≥80% ✅ d'ici fin de sprint S3**.

---

## État du code base actuel — analyse (2026-05-21)

> Précision agent : le contrat Hub doit être implémenté côté **`veridian-analytics-engine/veridian-bridge`** (l'app NestJS+bridge cible) et **pas** côté `veridian-analytics` legacy (qu'on abandonne après migration).

**Ce qui existe déjà côté `veridian-analytics` legacy (à ne PAS porter — c'est l'ancien)** :
- `auth.ts` Auth.js v5 Credentials provider — sera remplacé par Pattern B (Bearer api_key tenant) côté nouveau bridge
- `lib/admin-auth.ts` + `lib/admin-guard.ts` — pattern bring-your-own-key avec header `x-admin-key` — sera remplacé par Pattern A HMAC Hub
- `lib/magic-link.ts` + `lib/otp.ts` — auth local — sera remplacé par `POST /api/workspaces.generateMagicLink` (§5.6)
- Routes `app/api/admin/*` — qui consomment l'admin key Hub legacy — seront migrées vers les 12 endpoints `/api/tenants/*` du contrat

**Ce qui existe côté `veridian-analytics-engine/veridian-bridge` (la cible — à étendre)** :
- 3 routes admin actuelles : `provision-tenant`, `provision-existing-tenant` (à créer en Phase B sprint), magic link sortant
- 0 endpoint contrat Hub HMAC pour l'instant — tout à câbler
- DB Postgres bridge : à créer (cf. ticket port features legacy, table `Tenant` à étendre selon ce qui suit)

**Modèle Prisma legacy à ne PAS migrer (sauf colonnes utiles)** : `Tenant`, `Membership`, `User`, `Account`, `Session`, `VerificationToken` — ces tables Auth.js sont remplacées par staminads native auth + bridge tokens.

**Modèle Prisma legacy À porter dans bridge** (cf. ticket [`2026-05-21-features-legacy-to-staminads.md`](./2026-05-21-features-legacy-to-staminads.md)) :
- `Site` (siteKey, domain, name)
- `GscProperty` + `GscDaily` (intégration Search Console)
- `FormSubmission` + `FormSchema` + `Lead` + `LeadSession` (forms + dedup leads)
- `PushSubscription` (PWA notifs)

Ce qui suit (endpoints HMAC + paywall + idempotency + observabilité) sera implémenté **dans le bridge**, pas dans le legacy.

---

## Endpoints à implémenter (Pattern A — HMAC Hub)

> Référence : `../CONTRAT-HUB.md` §5

### Phase 1 — Provisioning de base (Session S1)

- [ ] **`POST /api/tenants/provision`** (§5.1)
  - Input HMAC : `{ tenant_id, owner_email, plan, locale, metadata }`
  - Idempotent (rejouer = même réponse)
  - 3 cas à gérer (A : nouveau, B : existant ré-attaché, C : conflit)
  - Output : `{ tenant_id, api_key, dashboard_url }`
- [ ] **`POST /api/tenants/attach-owner`** (§5.3)
  - Lie un user Veridian (par email) au tenant comme OWNER membership
- [ ] **`GET /api/tenants/{id}/health`** (§5.5)
  - Pour healthcheck Hub : retourne `{ status, last_event_at, sites_count }`

### Phase 2 — Lifecycle (Session S3)

- [ ] **`POST /api/tenants/update-plan`** (§5.2)
- [ ] **`POST /api/tenants/suspend`** (§5.4)
- [ ] **`POST /api/tenants/resume`** (§5.4)
- [ ] **`POST /api/tenants/{id}/soft-delete`** (§5.8.1)
- [ ] **`POST /api/tenants/{id}/restore`** (§5.8.2)
- [ ] **`POST /api/tenants/{id}/purge`** (§5.8.3)
- [ ] **`GET /api/tenants/{id}/usage-summary`** (§5.8.5)
- [ ] **`POST /api/workspaces.generateMagicLink`** (§5.6) — pour le Hub → magic link auto-login

### Phase 3 — Webhooks app → Hub (Pattern C, Session S3)

- [ ] `tenant.suspended` (quand Analytics suspend localement)
- [ ] `tenant.resumed`
- [ ] `tenant.deleted`
- [ ] `tenant.owner_changed`
- [ ] `tenant.quota_exceeded` (quand un tenant dépasse son plan)

### Phase 4 — Avancé (Session S3)

- [ ] `POST /api/webhooks/analytics/tenant.touched` (§5.8.4) — repousse `purge_eligible_at`
- [ ] **Idempotency-Key** header (§5.11) sur `provision`, `update-plan`, `soft-delete`, `purge`
- [ ] Table `veridian_idempotency_keys` + cleanup cron quotidien
- [ ] **Format d'erreurs standardisé** (§5.10) : `{ error_code, message, retryable, details }`

---

## Modèle de données à étendre

Migration Prisma sur `analytics` schema (Session S1 pour le minimum) :

```prisma
model Tenant {
  // existant
  id              String  @id @default(cuid())
  slug            String  @unique
  name            String
  // ...

  // Hub integration
  hubTenantId     String? @unique  // null tant que pas provisionné via Hub
  plan            String  @default("free")  // free / pro / business / enterprise / lifetime_* / internal
  planSource      String  @default("hub")   // hub | manual (cf §5.14 plan_source immunité Stripe)
  status          String  @default("active") // active | suspended | soft_deleted | trial_expired
  apiKey          String? // api_key tenant délivrée au provisioning Hub
  suspendedAt     DateTime?
  softDeletedAt   DateTime?
  purgeEligibleAt DateTime?  // v1.1 lifecycle

  // existant
  sites           Site[]
  memberships     Membership[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@schema("analytics")
}

// Pour Idempotency-Key (§5.11)
model IdempotencyKey {
  key       String   @id  // header Idempotency-Key
  endpoint  String   // ex: "POST /api/tenants/provision"
  bodyHash  String   // SHA-256 du body pour détecter rejeu modifié
  response  Json     // réponse cached à renvoyer
  createdAt DateTime @default(now())
  expiresAt DateTime  // TTL 7j

  @@index([expiresAt])
  @@schema("analytics")
}
```

---

## Lib HMAC

`lib/hub-hmac.ts` :

```ts
// Vérifie signature `{ts}.{body}` SHA-256 avec HUB_HMAC_SECRET_*
// - Anti-replay : timestamp ≤ 5 min de l'horloge serveur
// - Comparaison constant-time (crypto.timingSafeEqual)
// - Retourne `{ valid: boolean, error?: string }`
```

ENV (Dokploy) :
- `HUB_HMAC_SECRET_STAGING` (staging)
- `HUB_HMAC_SECRET_PROD` (prod)
- Mode dev local : `SKIP_HMAC=true` (cf §6.6)

---

## Paywall (§5.9 — v1.1)

> Activé sur statut `soft_deleted` ou `trial_expired`.

### Lib

`lib/paywall.ts` :

```ts
async function requireActivePlan(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant.status === 'suspended' || tenant.status === 'trial_expired') {
    throw new PaywallError(402, 'plan_expired');
  }
  if (tenant.status === 'soft_deleted') {
    throw new PaywallError(402, 'tenant_soft_deleted');
  }
}
```

### Champs sensibles à obfusquer (cf §5.9.4)

À documenter dans `lib/paywall.ts` :

```ts
const SENSITIVE_FIELDS = {
  // GET endpoints qui exposent des données analytics privilégiées
  '/api/admin/sites': ['siteKey'],  // siteKey = secret, donc obfusqué
  '/api/dashboard/pageviews': ['ip', 'userAgent', 'referer'],
  '/api/dashboard/forms/[id]': ['email', 'phone', 'submissionData'],
  '/api/dashboard/gsc': ['searchQuery'], // hide GSC queries en paywall
  '/api/dashboard/calls': ['callerId', 'recordingUrl'],
};
```

Format obfuscation : garder 33% des chars + bullets (`john.doe@gmail.com` → `joh•••••••@•••••.com`).

### UI

- Composant `<Paywall>` modale plein écran qui couvre le dashboard quand tenant en paywall
- Composant `<BlurredText>` qui blur les champs obfusqués + tooltip "Upgrade to view"

---

## Auth — 3 patterns (§6)

- **Pattern A (HMAC Hub → Analytics)** : endpoints `/api/tenants/*` — vérification HMAC signature
- **Pattern B (Bearer api_key tenant)** : utilisé quand Hub redirige un user vers Analytics avec un token
- **Pattern C (Bearer Hub webhook token)** : webhooks Analytics → Hub
  - ENV `HUB_WEBHOOK_TOKEN_STAGING/PROD`
  - Inclus dans header `Authorization: Bearer ${HUB_WEBHOOK_TOKEN}` sur tous nos webhooks app → Hub

---

## Tests d'intégration à câbler

Référence : §10.5 du contrat (Tests d'intégration)

- [ ] **Scénario provision idempotent** (Cas A/B/C de §5.1) — bloquant pour S1
- [ ] **Scénario attach-owner** happy + erreurs (user inexistant, déjà attaché)
- [ ] **Scénario suspend/resume cycle**
- [ ] **Scénario health avant/après attach**
- [ ] **Scénario HMAC reject** : replay > 5 min, body modifié, signature invalide
- [ ] **Scénario soft-delete + paywall obfuscation** (v1.1)
- [ ] **Scénario touch → repousse purge_eligible** (v1.1)
- [ ] **Scénario purge avec garde-fous** (v1.1)
- [ ] **Scénario plan_source immunité Stripe** (v1.1) — Stripe ne doit JAMAIS update si `planSource=manual`
- [ ] **Format erreurs standardisé** §5.10 (v1.1)

---

## Observabilité (§13 — v1.1)

- [ ] Logs JSON structurés avec **`tenant_id` dans chaque log** (correlation)
- [ ] Endpoint `/metrics` Prometheus (compteurs HMAC valides/invalides, latence endpoints, etc.)
- [ ] Alertes Grafana (cf §13.4 du contrat) sur :
  - Erreurs HMAC > seuil
  - Provision failures
  - Webhooks app → Hub timeout / 5xx

---

## Pricing target Robert (à figer §3.4)

Quand Analytics passe SaaS public, on aura besoin de figer le pricing. Brainstorm Robert :

- **free** : 1 site, 10k pageviews/mois, dashboard de base
- **pro** : N sites, X pageviews/mois, GSC + push + forms, AI assistant
- **enterprise** : illimité, multi-membre, custom domain, SLA, support

À figer dans une session dédiée avec Robert (pas urgent tant que pas SaaS public, mais à anticiper).

---

## Critères de complétion sprint

À la fin de S3, la matrice §10 du `CONTRAT-HUB.md` doit être mise à jour :

- §10.1 Endpoints obligatoires : Analytics ≥ 10/12 ✅
- §10.2 Plans supportés : free + pro + enterprise au minimum
- §10.3 Webhooks app → Hub : Analytics ≥ 3/5 ✅
- §10.4 Auth & sécurité : tout ✅
- §10.5 Tests d'intégration : ≥ 7/9 ✅
- §10.6 Paywall obfusqué : tout ✅
- §10.7 Observabilité : tout ✅
- §10.8 Idempotency : tout ✅

Quand on coche ces lignes dans `CONTRAT-HUB.md`, on commit en parallèle ce ticket avec un `## ✅ Phase X livrée — YYYY-MM-DD`.

---

## Dépendances

- **Hub** doit avoir livré son provisioning côté Hub (déjà en place pour Notifuse + Prospection, à confirmer pour Analytics)
- **Notifuse-Veridian** : modèle de référence — copier le pattern `dns_verification_service` adapté à notre contexte (audit cross-app)
- **Sprint staminads** : indépendant, peut être livré en parallèle (Hub ne dépend pas de staminads)

---

## Référence rapide

- Contrat complet : `../CONTRAT-HUB.md`
- Matrice §10 (ligne 2218+) : grille de complétion
- Tickets cross-app dormants (à activer fin de sprint) :
  - [`2026-05-20-add-discovery-endpoint-by-email.md`](./2026-05-20-add-discovery-endpoint-by-email.md)
  - [`2026-05-20-add-oauth-buttons-login-page.md`](./2026-05-20-add-oauth-buttons-login-page.md)
  - [`2026-05-20-hub-integration-when-saas-launched.md`](./2026-05-20-hub-integration-when-saas-launched.md) — devient le ticket "post-Saas public" une fois le contrat câblé

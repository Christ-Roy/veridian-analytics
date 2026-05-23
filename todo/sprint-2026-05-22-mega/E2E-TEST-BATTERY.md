# [E2E-BATTERY] Batterie complète de tests E2E — stack analytics-engine

> **Statut** : 🟡 STANDBY — démarre après validation Robert (post-v0.5.0)
> **Repo cible** : `veridian-analytics-engine` (tests à la racine `tests/e2e/`)
> **Mode** : 1 agent dédié Opus, worktree isolé, **ZÉRO build local**
> **Charge estimée** : ~12-16h agent
> **Déclencheur** : commande `/e2e-test-battery` ou Robert tranche
> **Dépend de** : v0.5.0-giga-sprint-complete (déployé prod 2026-05-23)

---

## 🎯 Objectif

Construire une **batterie de tests E2E exhaustive** qui valide la stack
analytics-engine **end-to-end** sur staging ET prod, en couvrant TOUS les
flows critiques. Aujourd'hui on a :

- ✅ Tests unitaires Vitest/node:test (~400 tests bridge, ~200 console)
- ✅ Tests d'intégration bridge contre vrai Postgres/ClickHouse (T1-T5)
- ❌ **PAS de Playwright E2E** sur la console
- ❌ **PAS de smoke prod automatisé** complet
- ❌ **PAS de tests de contrats cross-app** (Hub ↔ bridge HMAC)
- ❌ **PAS de tests des flows métier en bout en bout** (tracker → ingestion → dashboard)

Cible : **0 régression silencieuse** entre staging et prod, gates CI vraiment
bloquants, alertes au moindre dysfonctionnement.

---

## 🚨 RÈGLE ABSOLUE — ZÉRO BUILD LOCAL

L'agent travaille **uniquement** via :
- ✅ `git`, `gh`, `ssh prod-pub`, `ssh dev-pub`, `curl`, Dokploy API
- ✅ Édition de fichiers, écriture des tests Playwright/Vitest
- ✅ `docker compose config -q` (validation instantanée)
- ✅ Chrome MCP pour validation visuelle

INTERDIT en local :
- ❌ `npm install`, `vite build`, `vitest run`, `playwright install`
- ❌ `docker build`, `docker compose up`
- ❌ Aucune boucle d'attente RAM pour builder

Tout build/test/install → **CI GitHub Actions** ou **dev-pub via SSH**.

---

## 📐 STRUCTURE CIBLE

```
veridian-analytics-engine/
├── tests/e2e/
│   ├── playwright.config.ts          ← config Playwright (3 projets : chromium-desktop, chromium-mobile, webkit)
│   ├── fixtures/
│   │   ├── workspace.ts              ← helper auth + setup workspace
│   │   ├── tracker.ts                ← injecte le tracker dans une page test
│   │   ├── hub-hmac.ts               ← signature HMAC pour simuler le Hub
│   │   └── data-seed.ts              ← seed ClickHouse + Postgres avant chaque test
│   ├── helpers/
│   │   ├── api-client.ts             ← wrapper fetch bridge admin
│   │   ├── screenshot-diff.ts        ← régression visuelle
│   │   └── retry.ts                  ← polling pour ClickHouse async
│   ├── 01-smoke/                     ← smoke rapide < 60s
│   │   ├── healthcheck.spec.ts
│   │   ├── routes-reachable.spec.ts
│   │   └── ssl-cert.spec.ts
│   ├── 02-tracker-to-dashboard/      ← flow ingestion → analytics
│   │   ├── pageview-event.spec.ts
│   │   ├── session-tracking.spec.ts
│   │   ├── goal-event.spec.ts
│   │   ├── visitor-id-cookie.spec.ts
│   │   └── async-clickhouse-delay.spec.ts
│   ├── 03-forms-leads/               ← flow B1
│   │   ├── form-submission.spec.ts
│   │   ├── lead-dedup-by-email.spec.ts
│   │   ├── lead-session-matching.spec.ts
│   │   ├── rate-limit.spec.ts
│   │   └── xss-sanitization.spec.ts
│   ├── 04-push-pwa/                  ← flow B2
│   │   ├── vapid-public-key.spec.ts
│   │   ├── subscribe-unsubscribe.spec.ts
│   │   ├── send-notification.spec.ts
│   │   └── expired-cleanup.spec.ts
│   ├── 05-gsc-oauth/                 ← flow A4
│   │   ├── oauth-begin-redirect.spec.ts
│   │   ├── oauth-callback-encrypted-tokens.spec.ts
│   │   ├── sync-property.spec.ts
│   │   └── query-dashboard.spec.ts
│   ├── 06-hub-contract/              ← flow B3 (HMAC)
│   │   ├── hmac-valid.spec.ts
│   │   ├── hmac-replay-attack.spec.ts
│   │   ├── hmac-body-modified.spec.ts
│   │   ├── provision-tenant.spec.ts
│   │   ├── attach-owner.spec.ts
│   │   └── tenant-health.spec.ts
│   ├── 07-settings-credentials/      ← flow U8
│   │   ├── settings-page-render.spec.ts
│   │   ├── credentials-encrypt-roundtrip.spec.ts
│   │   ├── credentials-test-connection.spec.ts
│   │   └── credentials-masked-on-read.spec.ts
│   ├── 08-voip-calls/                ← flow B-VOIP + U9
│   │   ├── sync-call-logs.spec.ts
│   │   ├── matching-visitorid.spec.ts
│   │   └── calls-tab-render.spec.ts
│   ├── 09-dashboard-ui/              ← flow C2 + UI-INTEGRATION
│   │   ├── dashboard-root.spec.ts
│   │   ├── score-hero.spec.ts
│   │   ├── services-actifs-cards.spec.ts
│   │   ├── shadow-marketing-blocks.spec.ts
│   │   ├── tabs-navigation.spec.ts
│   │   └── empty-state.spec.ts
│   ├── 10-onboarding-wizard/         ← flow C3
│   │   ├── welcome-flow.spec.ts
│   │   ├── tracker-snippet-copy.spec.ts
│   │   └── check-tracker-live.spec.ts
│   ├── 11-demo-public/               ← flow E1 + démo staging
│   │   ├── demo-workspace-accessible.spec.ts
│   │   ├── demo-restricted-guards.spec.ts (signup/billing bloqués)
│   │   ├── demo-banner-cta.spec.ts
│   │   ├── demo-seed-reseed.spec.ts
│   │   └── demo-rate-limit.spec.ts
│   ├── 12-auth-flow/                 ← flow U9
│   │   ├── login-branded.spec.ts
│   │   ├── forgot-password.spec.ts
│   │   ├── 404-branded.spec.ts
│   │   └── impersonation-banner.spec.ts
│   ├── 13-cross-app/                 ← contrats inter-app
│   │   ├── hub-to-bridge-provision.spec.ts (Hub réel staging signe HMAC → bridge crée tenant)
│   │   ├── bridge-to-staminads-event.spec.ts (form submission → event ClickHouse)
│   │   └── notifuse-magic-link.spec.ts (si pertinent)
│   ├── 14-perf-regression/           ← visuel + perf
│   │   ├── lighthouse-dashboard.spec.ts
│   │   ├── lighthouse-demo.spec.ts
│   │   ├── visual-regression-dashboard.spec.ts (Playwright snapshots)
│   │   └── visual-regression-tabs.spec.ts
│   └── 15-chaos/                     ← scénarios dégradés
│       ├── bridge-down.spec.ts (engine sans bridge → UI dégradée propre, pas crash)
│       ├── clickhouse-down.spec.ts
│       ├── postgres-bridge-down.spec.ts
│       └── slow-network.spec.ts
└── .github/workflows/
    ├── e2e-smoke-staging.yml         ← post-deploy staging → smoke 01 (60s)
    ├── e2e-full-staging.yml          ← nightly + on-demand → 01-15 (15-30 min)
    ├── e2e-smoke-prod.yml            ← post-deploy prod → smoke 01 (60s) + critique 06+11
    └── e2e-visual-regression.yml     ← hebdo → 14 avec golden updates manuels
```

---

## 📋 EXIGENCES PAR SCÉNARIO

### 01 — Smoke (< 60s, BLOQUANT en CI)
Pour chaque cible (staging, prod, démo prod, démo staging) :
- [ ] `/api/health` (engine) → 200 + JSON valide + version + clickhouse:ok
- [ ] `/health` (bridge) → 200 + staminadsUrl correct
- [ ] SSL : issuer = Let's Encrypt R12/R13, valide ≥ 7 jours
- [ ] Route racine → 200 ou redirect attendu (pas 4xx/5xx)
- [ ] Headers sécu : HSTS, X-Content-Type-Options, X-Frame-Options
- [ ] Console JS clean au load racine (0 erreur)

### 02 — Tracker → Dashboard (golden path)
- [ ] Page test avec snippet tracker → POST `/api/event` → ClickHouse insert
- [ ] Attendre que l'event apparaisse dans staminads `analytics.query`
- [ ] Vérifier que le bridge `/api/admin/tenant/:wsId/status` voit l'event
- [ ] Score block reflète le pageview (score >= 30 après 1 pageview)
- [ ] Sparkline dashboard montre la barre du jour

### 03 — Forms → Lead (flow business critique)
- [ ] POST `/api/ingest/form` avec email → FormSubmission row + Lead row
- [ ] Replay même email → submissionsCount=2, 1 seul Lead
- [ ] visitorId cookie présent → LeadSession liée à la session staminads
- [ ] Event `form_submission` poussé sur staminads (vérif via analytics.query)
- [ ] Rate limit : 11e req/min → 429
- [ ] XSS : payload avec `<script>alert(1)</script>` → stocké safe, pas exécuté

### 04 — Push notifications PWA
- [ ] GET vapid-key → public key valide
- [ ] POST subscribe avec endpoint mock → PushSubscription row
- [ ] POST admin/push/send (Bearer) → web-push appelé pour chaque sub
- [ ] Sub avec endpoint qui renvoie 410 Gone → marked active=false

### 05 — GSC OAuth + sync
- [ ] POST oauth-begin → URL Google OAuth retournée + state HMAC
- [ ] Mock callback avec code → tokens AES-256-GCM en DB
- [ ] POST sync → GscDaily rows insérées idempotentes
- [ ] GET `/api/admin/tenant/:wsId/gsc?days=30` → format dashboard valide

### 06 — Hub HMAC contracts (sécurité critique)
- [ ] HMAC valide (signature correcte) → request passe
- [ ] HMAC invalide → 401
- [ ] Replay attack (timestamp > 5min) → 401
- [ ] Body modifié après sig → 401
- [ ] POST provision Cas A/B/C selon CONTRAT-HUB.md
- [ ] POST attach-owner idempotent
- [ ] GET health → metrics correctes

### 07 — Settings + credentials
- [ ] Page settings rendue avec sections Account/Site/GSC/VoIP/Notifs
- [ ] POST credentials VoIP → chiffré en DB (vérif Postgres)
- [ ] GET credentials → renvoie masqué `••••1234`
- [ ] POST credentials/test → connexion mock OK
- [ ] DELETE credentials → row delete

### 08 — VoIP calls (B-VOIP + U9)
- [ ] Sync OVH/Telnyx mock → SipCall rows upsert idempotents
- [ ] Visitor ID matching via Lead.phone → SipCall.visitorId rempli
- [ ] GET calls?days=30 → format CallsResponse U9
- [ ] Tab Calls : empty state, "VoIP pas branché" state, data state

### 09 — Dashboard UI
- [ ] Page dashboard root rend les 3 sections (Score / Services actifs / Boostez)
- [ ] Loading state : skeletons visibles, pas de spinner
- [ ] Error state : retry button cliquable, fait re-fetch
- [ ] Empty state : workspace vide → CTA "Installer le tracker"
- [ ] Mobile 375px : layout stack, touch targets ≥ 44px
- [ ] Tabs navigation : URL change, contenu change, deep-link OK

### 10 — Onboarding wizard
- [ ] `/welcome` accessible post-login
- [ ] Snippet tracker affiché + bouton copier → clipboard contient le snippet
- [ ] Check-tracker live : page test envoie un event → wizard détecte → étape suivante débloquée

### 11 — Démo publique
- [ ] `demo-analytics.veridian.site/workspaces/demo-apple` → page chargée
- [ ] Bandeau démo visible + CTA `mailto:` fonctionnel
- [ ] **Vérifier qu'IS_DEMO=true bloque** : tentative signup → 400/403
- [ ] Tentative workspace.create → 400/403
- [ ] Rate limit Traefik : 61e req/min/IP → 429
- [ ] Re-seed via secret → workspace `demo-apple` repeuplé
- [ ] Démo staging même comportement

### 12 — Auth + pages système
- [ ] Page login brandée Veridian (logo, couleurs)
- [ ] Forgot password flow envoie un email (vérif via Notifuse staging si possible, sinon mock)
- [ ] Page 404 Veridian-brandée (pas staminads brut)
- [ ] Impersonation banner visible quand admin impersonne

### 13 — Cross-app (contrats inter-services)
- [ ] Hub staging signe HMAC + POST `/api/tenants/provision` sur bridge staging → tenant créé
- [ ] Form submission via tracker → event `form_submission` apparaît dans staminads analytics
- [ ] Si applicable : magic link Notifuse → redirect dashboard Veridian

### 14 — Régression visuelle + perf
- [ ] Playwright snapshots de référence pour : dashboard, settings, welcome, démo
- [ ] Lighthouse desktop : ≥ 90 Perf/Access/BestPractices/SEO sur démo
- [ ] Lighthouse mobile : ≥ 80 sur démo
- [ ] CLS < 0.1, LCP < 2.5s sur le dashboard

### 15 — Chaos (résilience)
- [ ] `docker stop` bridge sur staging → engine répond toujours, UI dégradée propre
- [ ] `docker stop` clickhouse → bridge `/health` renvoie 503 propre, pas leak
- [ ] `docker stop` postgres-bridge → endpoints admin/settings → 503 propre
- [ ] Throttle réseau 200kbps → loaders affichés > 3s, pas de freeze UI

---

## 🛠️ STACK TECHNIQUE

- **Playwright** 1.50+ : tests E2E console UI (chromium + webkit + mobile viewport)
- **node:test** ou Vitest : tests E2E API-only (bridge endpoints + cross-service)
- **MSW** : mock externe Google API / Telnyx / OVH dans certains scenarios
- **playwright-test-coverage** : couverture E2E si possible
- **lighthouse-ci** : audits perf dans 14
- **playwright/test-snapshot-utils** : régression visuelle dans 14
- **dockerized targets** : tous les tests E2E pointent vers les vrais services
  staging/prod/démo (pas de stack locale)

---

## 🚦 WORKFLOWS CI

### `e2e-smoke-staging.yml` (post-deploy staging)
- Trigger : `workflow_run` après `Staging CI/CD` étage 3 success
- Exécute : 01 + 06 (HMAC critique)
- Timeout : 90s
- Bloquant : oui (rollback déclenché si échec)

### `e2e-full-staging.yml`
- Trigger : nightly 02:00 UTC + `workflow_dispatch` manuel
- Exécute : 01 → 15 sauf 14 chaos isolé
- Timeout : 30 min
- Non bloquant CI (warn + issue auto)

### `e2e-smoke-prod.yml`
- Trigger : `workflow_run` après `Prod CI/CD` deploy-prod success
- Exécute : 01 + 11 (démo) + 06 (HMAC)
- Timeout : 2 min
- Bloquant : déclenche rollback prod si échec

### `e2e-visual-regression.yml`
- Trigger : hebdo dimanche 03:00 UTC + manual
- Exécute : 14 uniquement
- Update goldens : nécessite review humaine (PR auto avec diffs visuels)

---

## 📊 RAPPORTS

- Chaque run E2E uploade un rapport HTML Playwright comme artifact
- Lien dans le PR check status (clickable)
- Slack/Telegram notification si smoke prod échoue
- Dashboard Grafana Cloud (existant) ingère les durées + taux d'échec par scénario

---

## ✅ DÉFINITION DE "TERMINÉ"

- [ ] Les 15 dossiers `tests/e2e/01-*` à `15-*` existent avec ≥ 80% des scénarios listés implémentés
- [ ] Les 4 workflows `.github/workflows/e2e-*.yml` sont actifs et verts
- [ ] `e2e-smoke-staging` et `e2e-smoke-prod` sont **bloquants** dans la chaîne CI
- [ ] `e2e-full-staging` tourne nightly et reporte issues GitHub auto sur échecs
- [ ] `e2e-visual-regression` produit des goldens committés
- [ ] Documentation `docs/E2E-TESTING.md` : comment lancer, comment update goldens, comment debugger un test cassé
- [ ] Couverture des chemins critiques : provisioning Hub, ingestion tracker, forms→lead, GSC OAuth, démo, push, VoIP — chacun a ≥ 1 test E2E qui tape une vraie stack

---

## ⚠️ PRÉCAUTIONS

- **JAMAIS** tester contre la prod réelle avec des données qui pollueraient les
  workspaces clients. Toujours créer des workspaces de test dédiés (préfixe
  `e2e-test-`) et les supprimer dans `afterAll`.
- **JAMAIS** envoyer de vrai push notification, de vrai email transactionnel,
  ni de vrai webhook tiers. Mock systématique des endpoints externes (Google,
  Telnyx, OVH, web-push).
- **Sécrets** : utiliser des secrets de test dédiés (`E2E_*_TEST`), jamais les
  secrets prod réels.
- **Démo** : tester sur `demo-staging-analytics.veridian.site` plutôt que prod
  pour les scénarios destructifs (re-seed, etc.).

---

## 🤝 COORDINATION

- Ce ticket démarre **après** `v0.5.0-giga-sprint-complete` validée par Robert
- L'agent UI polish (`UI-POLISH-TEAM`) peut démarrer en parallèle — leur tests
  Vitest console + screenshots seront utiles comme base mais distincts des E2E
- L'agent infra (veridian-infra) doit avoir câblé `e2e-smoke-prod` bloquant
  dans le workflow `Prod CI/CD` (étage post-deploy)

---

## Status

🟡 STANDBY — déclencheur `/e2e-test-battery` ou go explicite de Robert

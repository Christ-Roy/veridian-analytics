# 🚀 GIGA SPRINT — 10 agents en parallèle

> **Date démarrage** : session prochaine (2026-05-22)
> **Cible** : livraison complète en ≤ 1 semaine avec 10 agents Claude indépendants
> **Coordination** : agent principal Robert + tickets autonomes addressables individuellement

---

## 📋 Vue d'ensemble — 12 tickets indépendants

Chaque ticket est conçu pour être **autonome** : un agent qui débarque peut le picker, le livrer, push, sans coordination avec les autres. **Dépendances minimales documentées en tête de ticket**.

### Backend bridge (4 tickets parallélisables)

| # | Ticket | Owner | Charge | Dépend de |
|---|---|---|---|---|
| **A1** | [score-veridian-port.md](./A1-score-veridian-port.md) | Agent backend bridge | 4h | rien |
| **A2** | [tenant-status-port.md](./A2-tenant-status-port.md) | Agent backend bridge | 3h | rien |
| **A3** | [shadow-marketing-port.md](./A3-shadow-marketing-port.md) | Agent backend bridge | 2h | A2 (consomme tenant-status) |
| **A4** | [gsc-integration-port.md](./A4-gsc-integration-port.md) | Agent backend bridge | 8h | rien (DB Postgres bridge à créer) |

### Backend ingestion + Hub (3 tickets)

| # | Ticket | Owner | Charge | Dépend de |
|---|---|---|---|---|
| **B1** | [forms-leads-port.md](./B1-forms-leads-port.md) | Agent backend bridge | 6h | rien |
| **B2** | [push-pwa-port.md](./B2-push-pwa-port.md) | Agent backend bridge | 4h | rien |
| **B3** | [hub-contract-base.md](./B3-hub-contract-base.md) | Agent backend bridge | 6h | rien (3 endpoints + HMAC lib) |

### Frontend console staminads (3 tickets)

| # | Ticket | Owner | Charge | Dépend de |
|---|---|---|---|---|
| **C1** | [ui-port-components.md](./C1-ui-port-components.md) | Agent frontend | 6h | rien (composants visuels uniquement) |
| **C2** | [ui-port-pages.md](./C2-ui-port-pages.md) | Agent frontend | 8h | C1 + A1/A2/A3 endpoints disponibles |
| **C3** | [ui-onboarding-wizard.md](./C3-ui-onboarding-wizard.md) | Agent frontend | 4h | C1 |

### Produit Veridian (2 tickets)

| # | Ticket | Owner | Charge | Dépend de |
|---|---|---|---|---|
| **D1** | [url-shortener.md](./D1-url-shortener.md) | Agent fullstack legacy | 8h | rien (vit dans veridian-analytics Next.js legacy) |
| **D2** | [migrate-5-clients.md](./D2-migrate-5-clients.md) | Agent ops | 6h | A1+A2+A3+B1 livrés + visitor_id staminads patché |

---

## 🤝 Coordination

### Pour chaque agent qui pick un ticket

1. **Lis le ticket** en entier
2. **Vérifie les dépendances** mentionnées en tête
3. **Crée une branche** : `feat/<ticket-id>-<slug>` (ex: `feat/A1-score-veridian-port`)
4. **Code + tests** (Husky pre-push refuse sans test sur fichiers critiques)
5. **Push** sur la branche
6. **Mets à jour le ticket** : checkbox `[x]` au fur et à mesure, et ajoute un `## Status` en bas du fichier
7. **Quand prêt à merger** : si vert, merge sur `staging` ou `main` selon le repo cible
8. **Crée une PR ou commit direct** selon le mode du repo cible (`veridian-analytics-engine` = branche `staging` direct, `veridian-analytics` = idem)

### Conflits entre agents

- **Composants UI** : C1 livre les composants, C2 et C3 les consomment. Si C2/C3 démarrent avant C1, ils stubbent les composants en placeholder et remplacent quand C1 livre.
- **Modèles BDD** : A4/B1/B2 ajoutent chacun leurs tables. Pas de conflit tant qu'ils ne touchent pas les mêmes tables.
- **Migrations Prisma** : si plusieurs agents touchent au schema bridge, **séquencer** par ordre alphabétique du ticket (A4 → B1 → B2). Chaque migration a son timestamp.

### Communication entre agents

- **Pas de Slack / Discord** : on n'a pas ça. Les agents communiquent via :
  - Le ticket lui-même (section Status)
  - Le commit history (chaque agent voit ce que les autres ont push)
  - Le README de ce dossier (mise à jour des statuts)

### Validation finale

Quand les 12 tickets sont `[x]`, Robert :
- Audit visuel sur env dev (`https://analytics-engine-dev.staging.veridian.site/`)
- Si OK → bascule staging-edge prod (cf ticket D2 migrate-5-clients)
- Tag `v0.5.0-giga-sprint-complete`

---

## ⚙️ Pré-requis avant démarrage

- ✅ Env dev hot-reload opérationnel (`analytics-engine-dev.staging.veridian.site` → 200)
- ✅ Branche `dev` synchronisée sur dev-pub
- ✅ Husky pre-push câblé (refuse sans test)
- ✅ Disque dev-pub à 86% (à surveiller pendant le sprint, cleanup si > 90%)
- ⏳ Visitor_id patch staminads à livrer (cf. roadmap staminads Phase 2) — pré-requis pour D2

---

## 📊 Matrice d'attribution suggérée (10 agents)

| Agent | Tickets |
|---|---|
| 1 | A1 (score) → C2 (UI dashboard root) |
| 2 | A2 (tenant-status) → A3 (shadow-marketing) |
| 3 | A4 (GSC integration) — gros morceau, dédié |
| 4 | B1 (forms+leads) |
| 5 | B2 (push PWA) |
| 6 | B3 (Hub contract base) |
| 7 | C1 (UI composants) → C3 (onboarding wizard) |
| 8 | C2 (UI pages — gros morceau, mais commencé par agent 1) |
| 9 | D1 (URL shortener) — autonome dans repo legacy |
| 10 | D2 (migrate 5 clients) — bloqué tant que A1+A2+A3+B1 pas livrés, peut commencer par préparer scripts |

Robert reste maître du sprint et tranche les blocages.

---

## 📚 Référence — voir aussi

- [`../INDEX.md`](../INDEX.md) — boussole générale agent
- [`../SPRINT.md`](../SPRINT.md) — sprint 4 sessions agent principal (vue alternative)
- [`../UI-POLISH.md`](../UI-POLISH.md) — polish UI continu live avec Robert (post-sprint)
- [`../2026-05-17-integration-staminads.md`](../2026-05-17-integration-staminads.md) — roadmap staminads
- [`../2026-05-20-sprint-staminads-migration-prod.md`](../2026-05-20-sprint-staminads-migration-prod.md) — sprint prod parent
- [`../../CONTRAT-HUB.md`](../../../CONTRAT-HUB.md) — contrat Hub source de vérité

---

## ✅ État du sprint (mis à jour par les agents)

### Stratégie de batching adoptée (2026-05-21 par agent principal)

Les 10 agents en parallèle stricto sensu = non viable :
- Dépendances réelles : A3 dep A2 · B1/B2/B3 dep A4 (DB Postgres) · C2 dep A1+A2+A3+A4+C1 · C3 dep C1 · D2 dep A1+A2+A3+B1
- 10 worktrees pnpm install simultanés sur dev-pub (87% disque) = crash
- Migrations Prisma concurrentes = conflits timestamps garantis
- 10 modifs simultanées sur test-coverage-map.yaml = merge hell

**3 batches séquentiels au lieu de 1 vague de 10** :
- **Batch 1** (parallèle 6 agents) : A1, A2, A4, B3*, C1, D1 — vraiment indépendants
  *B3 attend A4 pour la DB mais peut démarrer la lib HMAC + tests en parallèle
- **Batch 2** (parallèle 3) après A4 mergée : A3, B1, B2
- **Batch 3** (parallèle 3) après C1 + endpoints A* mergés : C2, C3, D2

| Ticket | Status | Owner | Notes |
|---|---|---|---|
| A1 | ✅ done | agent | port score → bridge (commit 1c022d8 sur dev) |
| A2 | ✅ done | agent | port tenant-status → bridge (commit 52ee4a7 sur dev) |
| A3 | ✅ done | agent | port shadow-marketing → bridge (commit ecd31f5 sur dev) |
| A4 | ✅ done | agent | port GSC + DB Postgres bridge (commit 147a190 sur dev — branche `feat/A4-gsc-integration-port`) |
| B1 | ✅ done | agent | port FormSubmission + Lead → bridge (commit 7c8d08a sur dev — branche `feat/B1-forms-leads-port`) |
| B2 | ✅ done | agent | port Push Notifications PWA → bridge (commit 83cabd9 sur dev — branche `feat/B2-push-pwa-port`) |
| B3 | ✅ done | agent | Hub contract HMAC (commit 4329e2a sur dev) |
| C1 | ✅ done | agent | port composants UI → console/src/veridian/ (commit 10aea16 sur dev) |
| C2 | ✅ done | agent | pages UI — dashboard.tsx + dashboard-tabs (forms/gsc/push) dans console/src/veridian/pages/ |
| C3 | ✅ done | agent | onboarding wizard — welcome.tsx + check-tracker (commit 09d1680) |
| D1 | 🟡 PR ouverte | agent | URL shortener — PR #17 sur repo legacy veridian-analytics (à merger) |
| D2 | ✅ done | agent F2 | scripts migration 5 clients livrés sur staging (SHA 7d50784) — migration prod réelle = décision Robert |
| UI-INTEGRATION | ✅ done | agent | dashboard Veridian intégré (commit 3381e10) |
| E1 | ✅ done | agent | démo publique demo-analytics.veridian.site (api/src/demo + branding) |
| CI-HUSKY | ✅ done | agent | husky ultra-strict + tests intégration réels T2-T5 (commit 2724f77) |
| U8 | ✅ done | agent U8 | page Settings tenant + credentials VoIP self-service (chiffrement AES-256-GCM) — staging SHA 1c716c6 (feature 55c3459). Fixes CI annexes : TOKEN_ENCRYPTION_KEY dans .env staging + bump timeout deploy 10→18min. |

Légende status : ⏳ pending | 🚧 in_progress | ✅ done | ❌ blocked

---

## 🏁 PHASE FINITION (2026-05-22 — après remise à plat)

Tout le code du sprint est dans `origin/staging` (13 commits ahead of `main`).
La branche `dev` a été consommée (promue dev→staging) puis supprimée — normal.

**RÈGLE ABSOLUE remise à plat** : aucun build/test/install en local. Tout sur
dev-pub ou CI GitHub Actions. Cf memory [[feedback_no_local_docker_build]].

### Reste à finir

| # | Tâche | Détail |
|---|---|---|
| F1 ✅ | Fix CI `Staging CI/CD` | **Livré.** 2 commits : (1) `da08c54` — ajout `VAPID_*` + `HUB_HMAC_SECRET` au step "Compose config check" de `staging-deploy.yml` ; (2) `98f58bc` — cause racine des annulations en série : staging est derrière Tailscale (`*.staging.veridian.site` → IP tailnet), les smokes étage 3/4/5 curl-aient depuis le runner GitHub (pas sur le tailnet) → smoke réécrit pour tourner via SSH sur dev-pub (`docker compose ps` + `docker exec`). `Staging CI/CD` **100% vert** sur `98f58bc` (run 26299971335). |
| F1 ✅ | Fix CI `Prod CI/CD` | **Livré** (`37580e5` sur `staging`). Bug job-dependency : sur `workflow_dispatch`, `structural-gate` est skipped, `build` est gated `if: always()`, et les jobs en aval (trivy/deploy-prod/e2e) sans `if:` propre se faisaient skipper via le `success()` implicite. Ajout `if: !cancelled() && needs.*.result == 'success'` sur trivy-bridge/trivy-engine/deploy-prod/e2e-prod-smoke. |
| F1 🔴 | Promo `staging → main` + deploy prod | **BLOQUÉ par GitHub Actions billing.** `main` est déjà à `98f58bc` (promo SSH-smoke faite). MAIS depuis ~17:00 UTC le 2026-05-22 tous les runs échouent en 2s sans runner : *"The job was not started because recent account payments have failed or your spending limit needs to be increased"*. → **Action Robert : GitHub → Settings → Billing & plans → relever le spending limit Actions / corriger le paiement.** Une fois débloqué : `Staging CI/CD` doit repasser vert sur `37580e5`, puis promo staging→main, puis `Prod CI/CD` déploie (deploy-prod câblé Dokploy `compose-synthesize-virtual-transmitter-i9bv43`). Le deploy prod du sprint n'a PAS encore eu lieu (run prod 26300502428 a buildé les images mais deploy-prod skippé — bug corrigé par `37580e5`). |
| F2 ✅ | D2 — scripts migration | Scripts de migration des 5 clients livrés sur `staging` (SHA `7d50784`) : endpoint `provision-existing-tenant`, `scripts/migration/` (provisionning + dual-tracking + historique GSC/Forms + alerting), 61 tests, README + CHECKLIST. Migration réelle PAS exécutée (décision Robert). |
| — | D1 PR #17 | URL shortener sur repo legacy `veridian-analytics` — à merger (décision Robert). |

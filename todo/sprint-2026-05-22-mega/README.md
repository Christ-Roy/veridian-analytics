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
| D2 | ⏳ pending | — | migration 5 clients — scripts à préparer (PAS de migration prod réelle sans go Robert) |
| UI-INTEGRATION | ✅ done | agent | dashboard Veridian intégré (commit 3381e10) |
| E1 | ✅ done | agent | démo publique demo-analytics.veridian.site (api/src/demo + branding) |
| CI-HUSKY | ✅ done | agent | husky ultra-strict + tests intégration réels T2-T5 (commit 2724f77) |

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
| F1 | Fix CI `Staging CI/CD` | Manque `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` dans le step "Compose config check" de `.github/workflows/staging-deploy.yml` (job quick-checks, ~ligne 89). 3 lignes YAML. |
| F1 | Promo `staging → main` | Une fois `Staging CI/CD` vert : merge ff-only staging→main, déclenche deploy prod du sprint complet. |
| F2 | D2 — scripts migration | Écrire + tester les scripts de migration des 5 clients. NE PAS migrer les vrais clients (décision Robert séparée). |
| — | D1 PR #17 | URL shortener sur repo legacy `veridian-analytics` — à merger (décision Robert). |

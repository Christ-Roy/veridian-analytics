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

| Ticket | Status | Owner | Notes |
|---|---|---|---|
| A1 | ⏳ pending | — | — |
| A2 | ⏳ pending | — | — |
| A3 | ⏳ pending | — | — |
| A4 | ⏳ pending | — | — |
| B1 | ⏳ pending | — | — |
| B2 | ⏳ pending | — | — |
| B3 | ⏳ pending | — | — |
| C1 | ⏳ pending | — | — |
| C2 | ⏳ pending | — | — |
| C3 | ⏳ pending | — | — |
| D1 | ⏳ pending | — | — |
| D2 | ⏳ pending | — | — |

Légende status : ⏳ pending | 🚧 in_progress | ✅ done | ❌ blocked

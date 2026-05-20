# 🗺️ Index TODO — veridian-analytics

> **Tu es un agent qui débarque ?** Lis ce fichier en premier, puis va au [SPRINT actif](#-sprint-actif).
> Ce fichier est la **boussole**. Il ne contient pas de tâches — uniquement des pointeurs.
> Mis à jour 2026-05-20.

---

## 🚦 Etat du repo en 30 secondes

- **App** : Veridian Analytics — dashboard SEO + tracking multitenant pour les sites clients Veridian
- **Stack** : Next.js 15.5.18 (App Router) + Auth.js v5 + Prisma 6+ + Postgres + Vitest + Playwright
- **Prod** : `https://analytics.app.veridian.site` — **9 tenants**, 5 actifs (avse-monétique 1504 PV/30j, morel-volailles 674, robert-deboucheur 270, tramtech-dépannage 87, arnaud-capitaine 0)
- **Staging classique (Traefik public)** : `https://analytics-staging.veridian.site` (branche `staging`)
- **Env DEV hot-reload (Tailscale only)** : `https://dev-server-1.tail324436.ts.net/` (branche `dev` — cf [memory `project_analytics_engine_dev_env`])
- **Décision majeure 2026-05-17/20** : migration progressive vers **staminads** comme moteur ingestion+dashboards
  - Fork `Christ-Roy/veridian-analytics-engine` déjà setup en staging (Phase 1 livrée)
  - Migration des 5 clients prod via **dual-tracking 30j** (pattern validé)

---

## 🎯 Sprint actif

👉 **[SPRINT.md](./SPRINT.md)** — sprint vivant en 2-3 sessions, checkboxes ordonnées, agents pas perdus

Le sprint actif couvre 3 phases :
- **A** : URL shortener interne (1-2j) — prio 1, produit autonome
- **B** : Dual-tracking staminads 30j sur les 5 clients actifs (3j)
- **C** : Cutover legacy à J+30 (1j)

Avant ou en parallèle : patch SDK `visitor_id` côté `veridian-analytics-engine` (cf. roadmap staminads).

---

## 🎨 Polish UI continu (hot-reload avec Robert)

👉 **[UI-POLISH.md](./UI-POLISH.md)** — backlog des features dashboard qui méritent un coup de pinceau, fait en live avec Robert sur l'env dev hot-reload

À ouvrir quand Robert dit "le dashboard est moche", "le tableau X est illisible", "le bouton est mal placé". On édite, on push sur `dev`, on regarde sur `dev-server-1.tail324436.ts.net`, on itère.

---

## 📚 Roadmap & tickets

### Sprint en cours (P2)
- 🟧 **[2026-05-20-sprint-staminads-migration-prod.md](./2026-05-20-sprint-staminads-migration-prod.md)** — détail complet phases A/B/C avec critères d'acceptation

### Roadmap moyen terme (P2-P3)
- 🟧 **[2026-05-17-integration-staminads.md](./2026-05-17-integration-staminads.md)** — roadmap staminads 6 phases (Phase 0+1 ✓, Phase 2 visitor_id à venir)
- 🟧 **[2026-05-20-hub-integration-prepare-analytics.md](./2026-05-20-hub-integration-prepare-analytics.md)** — préparation contrat Hub (12 endpoints HMAC, webhooks, paywall) — actif maintenant pour préparer le SaaS public
- 🟢 **[2026-05-19-auto-promote-staging-main.md](./2026-05-19-auto-promote-staging-main.md)** — câbler auto-promote (P3, 30 min)

### Tickets cross-app dormants (P5 — réveille quand Analytics passe SaaS public)
- ⚪ **[2026-05-20-add-discovery-endpoint-by-email.md](./2026-05-20-add-discovery-endpoint-by-email.md)** — endpoint `GET /api/users/by-email` pour Hub discovery
- ⚪ **[2026-05-20-add-oauth-buttons-login-page.md](./2026-05-20-add-oauth-buttons-login-page.md)** — boutons OAuth login page (redirigent vers Hub)
- ⚪ **[2026-05-20-hub-integration-when-saas-launched.md](./2026-05-20-hub-integration-when-saas-launched.md)** — chapeau cross-app SaaS public (référence parent)

### Roadmap globale + dette
- 📋 **[apps/analytics/TODO.md](./apps/analytics/TODO.md)** — CI/CD, sécurité, dette technique, infrastructure
- 💡 **[../docs/roadmap/IDEAS.md](../docs/roadmap/IDEAS.md)** — pool d'idées candidates
- 🔭 **[../docs/roadmap/LONG-TERM-VISION.md](../docs/roadmap/LONG-TERM-VISION.md)** — positionnement long terme

---

## 🤝 Contrats inter-apps

Analytics est consommée par **Hub** via `https://analytics.app.veridian.site/api/admin/*` avec `x-admin-key`. Le contrat complet (12 endpoints + 5 webhooks + paywall + observabilité) est dans :

- **`../CONTRAT-HUB.md`** — la spec de référence (2929 lignes, source de vérité)
- **Section 10** (lignes 2218+) : matrice de complétion par app — Analytics est à `❌` partout, c'est ce que cible le ticket `2026-05-20-hub-integration-prepare-analytics.md`

---

## 🧠 Mémoires Claude pertinentes

À lire selon le sujet :

- **`project_analytics_engine_strategy`** — décision 2026-05-17 d'adopter staminads
- **`project_analytics_engine_decisions`** — 4 décisions clés (AGPL / visitor_id / migration / phases)
- **`project_analytics_engine_dev_env`** — env DEV hot-reload sur dev-pub via Tailscale
- **`feedback_no_local_docker_build`** — Robert préfère build CI ou dev-pub
- **`feedback_docker_compose_project_isolation`** — incident 2026-05-18 (project name partagé tue staging)
- **`feedback_run_ci_locally_first`** — reproduire CI en local AVANT push
- **`feedback_dev_url_before_push`** — tester sur staging avant prod
- **`feedback_existing_tenants_migration`** — 9 tenants prod = toujours penser à la rétro-compat

Index complet : `~/.claude/projects/-home-brunon5-Bureau-veridian-platform-veridian-analytics/memory/MEMORY.md`

---

## ⛔ Règles non négociables (rappel CLAUDE.md repo)

- **JAMAIS** modifier la prod sans accord
- **JAMAIS** désactiver le CVE audit gate (`pnpm audit --prod --audit-level high`)
- **JAMAIS** push direct main sans dual-tracking validé (cf `feedback_existing_tenants_migration`)
- **TOUJOURS** snapshot DB avant migration (cf `project_blue_green_pattern`)
- **TOUJOURS** lire la stack avant de proposer (`ls`, `cat package.json`, `head README.md`)
- **TOUJOURS** reproduire CI en local : `pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm audit --prod --audit-level high && pnpm build`

---

## 📍 Navigation rapide

| Tu veux… | Va dans… |
|---|---|
| Démarrer immédiatement | [SPRINT.md](./SPRINT.md) |
| Polish UI avec Robert en live | [UI-POLISH.md](./UI-POLISH.md) |
| Comprendre la stratégie staminads | [2026-05-17-integration-staminads.md](./2026-05-17-integration-staminads.md) |
| Câbler le Hub | [2026-05-20-hub-integration-prepare-analytics.md](./2026-05-20-hub-integration-prepare-analytics.md) |
| Voir la dette CI / sécu | [apps/analytics/TODO.md](./apps/analytics/TODO.md) |
| Le contrat Hub source de vérité | `../CONTRAT-HUB.md` |

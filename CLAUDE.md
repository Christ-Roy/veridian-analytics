# Veridian Analytics — Instructions agent

> Repo polyrepo extrait du monorepo `veridian-platform` le 2026-05-13.
> Worktree local : `~/Bureau/veridian-platform-analytics/`
> Dossier renommé possible : `~/Bureau/veridian-analytics/`

## Ce que c'est

Dashboard analytics + SEO multitenant pour les sites Veridian.
Stack Next.js 15 / Auth.js v5 / Prisma 6+ / Postgres / Vitest / Playwright.

## Avant de toucher quoi que ce soit

1. Lire ce fichier + `README.md` + `MONOREPO-LINKS.md`
2. Vérifier `pnpm audit --prod --audit-level high` est vert
3. Vérifier qu'aucune autre PR ne touche le même domaine

## Règles workflow

- **Branches** : `feat/<slug>` ou `fix/<slug>` (pas de préfixe `analytics/`
  contrairement au monorepo — on est déjà dans le repo analytics)
- **Commits** : conventional commits sans le scope `(analytics)` ; ex
  `feat: add GSC API throttle` plutôt que `feat(analytics): add GSC API throttle`
- **PR** : doit être verte (test + e2e + audit) avant merge
- **Push main** = deploy prod automatique. Réfléchis avant.

## Avant CHAQUE push (CI locale obligatoire)

D'après `feedback_run_ci_locally_first` : reproduire le pipeline CI en local
AVANT de push, pour pas brûler 10 min de CI cloud sur un test qui aurait échoué
en local.

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm rebuild @prisma/client prisma esbuild sharp
pnpm exec prisma generate
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm audit --prod --audit-level high
pnpm build
```

Si l'un échoue → fix avant push.

## Tester sur dev avant prod

D'après `feedback_dev_url_before_push` : pour tout changement custom (React
component, hook, schéma Prisma, compose), valider sur le staging
`https://analytics-staging.veridian.site` AVANT push prod.

```bash
# Build local + push image temp + pull sur staging
pnpm build
docker build -t ghcr.io/christ-roy/analytics:dev-$(git rev-parse --short HEAD) .
docker push ghcr.io/christ-roy/analytics:dev-$(git rev-parse --short HEAD)
# Puis sur dev server : modifier .env ANALYTICS_IMAGE_TAG temporairement + restart
```

## Sécurité

- **AUTH_SECRET, DATABASE_URL, ADMIN_API_KEY** : Dokploy ENV uniquement
- **`.env.example`** : que des placeholders, jamais de vraie valeur
- **CVE** : CI bloque sur HIGH/CRITICAL (`pnpm audit --prod --audit-level high`)
- **Trivy** : scan quotidien image, HIGH/CRITICAL bloquant
- **Pas de version beta** d'un framework critique (Next.js, Auth.js) en prod
- **Pas de page `/admin/*` sans `requireAdmin()` server-side** (cf CVE-2025-29927)

## Prod opérationnelle

- **Compose Dokploy** : `compose-synthesize-virtual-transmitter-i9bv43`
  (`ssh prod-pub 'sudo ls /etc/dokploy/compose/compose-synthesize-virtual-transmitter-i9bv43/'`)
- **Container** : `compose-synthesize-virtual-transmitter-i9bv43-analytics-prod-1`
- **Image SHA** prod actuelle : voir `docker-compose.yml` (pinned)
- **Health check** : `https://analytics.app.veridian.site/api/health`
- **Logs** : `ssh prod-pub 'sudo docker logs compose-synthesize-virtual-transmitter-i9bv43-analytics-prod-1 --tail 100 -f'`

## Inter-services

Analytics est consommée par Hub (`Christ-Roy/veridian-hub`) via :
`https://analytics.app.veridian.site/api/admin/*` + header
`Authorization: Bearer <ADMIN_API_KEY>`.

Tout changement de l'API admin doit être coordonné avec le repo Hub.

## Pour aller plus loin

- Roadmap globale Veridian → `veridian-platform/todo/TODO-LIVE.md`
- Sprint GitOps en cours → `~/Bureau/SPRINT-GITOPS-VERIDIAN.md`
- Standards CI/CD → workflows réutilisables `Christ-Roy/veridian-platform/.github/workflows/_*.yml`
- Pattern blue-green migrations → mémoire `project_blue_green_pattern`

## Règles absolues

- **JAMAIS** modifier la prod sans accord
- **JAMAIS** désactiver le CVE audit gate
- **JAMAIS** push direct sur main sans PR review
- **TOUJOURS** snapshot avant migration DB (cf `project_blue_green_pattern`)
- **TOUJOURS** réfléchir aux tenants existants avant feature DB-impacting

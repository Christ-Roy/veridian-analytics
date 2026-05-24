# Veridian Analytics

> ## ⚠️ Repo en fin de vie (depuis 2026-05-23)
>
> L'app commercialisée est désormais **`veridian-analytics-engine`**
> (fork staminads — Vite + TanStack Router + ClickHouse + bridge Express).
> Ce repo est maintenu en hospice le temps de migrer les 5 clients
> existants, puis sera archivé.
>
> **Pas de nouvelle feature ici.** Pas de refactor "propre". Pas de
> Dependabot mergé. Voir `CLAUDE.md` §VISION pour les conditions de
> dépose et la liste exhaustive du scope finalisé.

SaaS multitenant analytics + dashboard SEO pour les sites Veridian.
Extrait du monorepo `veridian-platform` le 2026-05-13.

## Stack

- **Framework** : Next.js 15.5 (App Router, standalone build)
- **Auth** : Auth.js v5 (credentials, JWT cookies)
- **DB** : Postgres (schema `analytics`) + Prisma 6.19+
- **Tests** : Vitest (unit) + Playwright (e2e)
- **Package manager** : pnpm 10
- **Deploy** : GHCR → Dokploy GitOps (compose pull depuis ce repo)

## URLs

| Env | URL |
|---|---|
| Dev local | http://localhost:3000 |
| Staging | https://analytics-staging.veridian.site |
| Prod | https://analytics.app.veridian.site |

## Run local

```bash
pnpm install --ignore-scripts
pnpm rebuild @prisma/client prisma esbuild sharp
cp .env.example .env.local  # fill values
pnpm exec prisma db push
pnpm dev  # http://localhost:3000
```

## Run tests

```bash
pnpm exec vitest run              # unit tests
pnpm exec playwright test         # e2e tests
pnpm exec tsc --noEmit            # typecheck
pnpm audit --prod --audit-level high  # CVE audit
```

## Build & run prod (test local)

```bash
pnpm build
node .next/standalone/server.js
```

## Deploy

1. Push sur `main` → CI build + push GHCR
2. CI appelle l'API Dokploy `compose.redeploy` (compose-id stocké en
   GitHub Variable `ANALYTICS_COMPOSE_ID_PROD`)
3. Le compose Dokploy pull la nouvelle image et redémarre
4. Health check post-deploy + rollback auto si KO

Voir `.github/workflows/ci.yml` pour le pipeline complet.

## Architecture multitenant

- Chaque client a son `Tenant` (slug unique)
- 1 tenant = N sites (`Site.tenantId`)
- 1 site = données GSC + tracker frontend + appels VoIP enrichis
- Hub (`veridian-hub`) provisionne tenants via `ADMIN_API_KEY`

## Sécurité

- `pnpm audit --prod --audit-level high` bloquant en CI
- Trivy scan quotidien sur image Docker (HIGH/CRIT bloquant)
- Dependabot hebdomadaire (npm + docker + actions)
- AUTH_SECRET ne sort jamais du Dokploy ENV
- Headers de sécurité injectés via `next.config.ts`

## Docs

- `MONOREPO-LINKS.md` — liens vers le monorepo et autres repos polyrepo
- `CLAUDE.md` — instructions pour les agents Claude qui bossent ici
- `docs/gsc-setup.md` — branchement Google Search Console
- `docs/integration-sites-clients.md` — install tracker côté sites clients
- `docs/pwa-reference/` — référence d'usage PWA en lecture client

## Contribuer

1. Branche : `feat/<slug>` ou `fix/<slug>`
2. Tests verts en local : `pnpm exec vitest run && pnpm exec tsc --noEmit && pnpm audit --prod --audit-level high`
3. PR vers `main`
4. CI doit être verte (test + e2e + audit) avant merge
5. Push main = deploy prod automatique

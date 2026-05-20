# Analytics — TODO detaillee

> Roadmap long terme : [`../../../docs/roadmap/LONG-TERM-VISION.md`](../../../docs/roadmap/LONG-TERM-VISION.md)
> Idées features : [`../../../docs/roadmap/IDEAS.md`](../../../docs/roadmap/IDEAS.md)
>
> Veridian Analytics est le dashboard SEO + analytics multitenant que Robert montre
> aux clients sites vitrines (Morel, Tramtech, AVSE, FGMC, etc.) pour prouver les
> perfs du site et upsell campagnes Ads/SEO.
> **Next.js 15.5.18, App Router, pnpm 10.33.0, Auth.js v5 (Credentials bcrypt),
> Prisma 6.19+ sur veridian-core-db schema analytics.**
> Extrait du monorepo `veridian-platform` vers `Christ-Roy/veridian-analytics` le 2026-05-13.

---

## 🚀 Etat actuel (2026-05-13)

- **Repo** : [Christ-Roy/veridian-analytics](https://github.com/Christ-Roy/veridian-analytics) (public, polyrepo)
- **Version** : voir `package.json` (Next 15.5.18, prisma 6.19+, next-auth 5.0.0-beta.25)
- **Dernier deploy prod** : commit `d358416` — bump SHA image v0.1.22 (`@sha256:8186b4ef...`)
- **URL prod** : https://analytics.app.veridian.site
- **URL staging** : https://analytics-staging.veridian.site (dev-server)
- **Sante** : 🟢 (post-extraction polyrepo + GitOps Dokploy + headers sécu + CVE picomatch fixée)
- **Stack Dokploy** : compose ID `Ri8lnog40Jgxn5xWOhaQg`, sourceType `git`, autoDeploy ON
- **Webhook GitHub → Dokploy** : id `622973990` actif sur push main
- **Container prod** : `compose-synthesize-virtual-transmitter-i9bv43-analytics-prod-1`
- **9 tenants en prod** : robert-deboucheur, avse-monetique, fgmc, demo-analytics, morel-volailles-com, tramtech-depannage-fr, app-veridian-site, arnaudcapitaine-com, veridian

## 📦 Architecture

```
veridian-analytics/         # repo polyrepo (extrait monorepo 2026-05-13)
├── app/                   # Next.js App Router
│   ├── api/               # routes API (admin, auth, ingest tracker, push)
│   ├── dashboard/         # vue tenant — gsc, calls, forms, push, settings
│   ├── login/             # Auth.js credentials + magic link
│   └── welcome/           # onboarding nouveau tenant
├── lib/                   # admin-auth, admin-guard, prisma, rate-limit, gsc, web-push
├── prisma/                # schema.prisma + migrations (schema `analytics`)
├── public/                # tracker.js (servi aux sites clients), assets
├── tests/                 # vitest unit (264 tests) + Playwright e2e
├── auth.ts                # Auth.js v5 config (Credentials bcrypt + JWT)
├── middleware.ts          # NextAuth middleware + x-pathname-url
├── next.config.ts         # standalone + headers sécu (HSTS, X-Frame, etc.)
├── docker-compose.yml     # Dokploy GitOps — image SHA-pinned
└── Dockerfile             # multi-stage Node 22 Alpine, pnpm 10.33.0
```

## ✅ Recently shipped (2026-05-13)

- **Extraction polyrepo** : 43 commits préservés via `git filter-repo --subdirectory-filter analytics/`
- **Stack Dokploy GitOps** : bascule Raw → Git provider, webhook auto-deploy
- **Image SHA-pinned** : `@sha256:8186b4ef...` (v0.1.22) dans compose
- **Headers de sécurité HTTP** : HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff,
  Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo désactivés)
- **CI/CD complète polyrepo** : pipeline `test + e2e + audit + docker (GHCR) + deploy-prod + rollback`
- **CVE-2026-33671 picomatch** : override pnpm `^4.0.4` + `.trivyignore` documenté (Next.js bundle interne)
- **CI security Trivy quotidien** : scan image + SARIF GitHub Security tab
- **Dependabot configuré** : npm + docker + docker-compose + github-actions hebdo
- **Dockerfile pnpm pin 10.33.0** : évite drift avec `pnpm@latest` (qui shippait v11 cassée)

## 🟡 TODO opérationnelle

### Pré-requis polyrepo (court terme)

- [ ] **Transférer GHCR package** `ghcr.io/christ-roy/analytics` du repo monorepo vers `veridian-analytics`
      → https://github.com/users/Christ-Roy/packages/container/analytics/settings → Manage Actions Access → Add `veridian-analytics`
      → Permet de **retirer le secret `CR_PAT`** et utiliser `GITHUB_TOKEN` natif
- [ ] **Branch protection main** sur `veridian-analytics` (require PR + checks verts avant merge)
- [ ] **Ajouter self-hosted runner** au repo (`Settings → Actions → Runners`) pour builds Docker rapides (~25s au lieu de 1m45s sur ubuntu-latest)
- [ ] **Cleanup monorepo PR #109** : merger une fois le conflit CLAUDE.md résolu (Robert a édité en parallèle)
- [ ] Vérifier que les PRs Dependabot du monorepo concernant `analytics/` sont fermées (obsolètes)

### Sécurité (suivi sprint security)

- [ ] **Bump next.js** quand version >15.5.18 bundle picomatch >=4.0.4 → retirer `.trivyignore` CVE-2026-33671
      Tracking : https://github.com/vercel/next.js/issues (date revue 2026-07-13)
- [ ] **Bump next-auth 5.0.0-beta.25 → stable** quand dispo. Beta en prod = mauvaise pratique
      (cf CLAUDE.md global "JAMAIS de version beta d'un framework critique en prod")
- [ ] **Auditer Content-Security-Policy** : header pas encore configuré dans `next.config.ts`,
      mais Analytics charge des assets externes (tracker.js sur sites clients, GSC OAuth).
      Faire un CSP `report-only` d'abord, mesurer le bruit, puis activer.
- [ ] **Verifier `requireAdmin()` server-side** sur toutes les routes `/api/admin/*`
      (cf CVE-2025-29927 middleware edge bypass, CLAUDE.md sécurité)

### CI/CD améliorations

- [ ] **Réactiver job `deploy-staging` + `e2e-staging`** une fois self-hosted runner ajouté
      (retiré dans commit `1d74615` car nécessitait `~/analytics-test` sur dev-server)
- [ ] **Action `pnpm/action-setup@v4` deprecated Node 20** → bumper vers version supportant Node 24
      (warning visible sur tous les runs, deadline juin 2026)
- [ ] **`aquasecurity/trivy-action@v0.36.0`** — vérifier nouvelles releases régulièrement
- [ ] **`github/codeql-action/upload-sarif@v3`** deprecated décembre 2026 → bumper vers v4

### Features (priorité Robert)

- [ ] **🟧 SPRINT ACTIF — Migration staminads + URL shortener prod** :
      [`../../2026-05-20-sprint-staminads-migration-prod.md`](../../2026-05-20-sprint-staminads-migration-prod.md)
      - Phase A : raccourcisseur d'URL interne (`/r/<slug>`, table `ShortLink`, admin)
      - Phase B : dual-tracking staminads 30j sur les 5 clients actifs
      - Phase C : cutover legacy à J+30
- [ ] **Roadmap staminads complète** : [`../../2026-05-17-integration-staminads.md`](../../2026-05-17-integration-staminads.md)
      (Phase 0→1 ✓ livrées, Phase 2 visitor_id à venir, Phase 5 VoIP différée)
- [ ] **Auto-promote staging→main** : [`../../2026-05-19-auto-promote-staging-main.md`](../../2026-05-19-auto-promote-staging-main.md)
      (P3, 30min — câbler quand on a un cycle stable de push)
- [ ] **Tickets cross-app dormants (P5)** activables quand Analytics passe en SaaS public :
  - [`../../2026-05-20-add-discovery-endpoint-by-email.md`](../../2026-05-20-add-discovery-endpoint-by-email.md)
  - [`../../2026-05-20-add-oauth-buttons-login-page.md`](../../2026-05-20-add-oauth-buttons-login-page.md)
  - [`../../2026-05-20-hub-integration-when-saas-launched.md`](../../2026-05-20-hub-integration-when-saas-launched.md)
- [ ] Voir `docs/roadmap/IDEAS.md` pour la liste exhaustive des features candidates
- [ ] Voir `docs/roadmap/LONG-TERM-VISION.md` pour le positionnement long terme

## 🐛 Dette technique connue

### Mineure (non-bloquante)

- **Headers `Content-Security-Policy` manquant** (les 5 autres headers sécu sont OK)
- **`package.json` engines** pas pinné (Node version) → cause potentielle de drift CI/Docker
- **3 CVE moderate** sur `pnpm audit` (non-bloquantes, à surveiller)
- **Node.js 20 deprecated** dans les actions GitHub Actions (warning, deadline septembre 2026)

### Architecturale

- Pas de séparation env `dev` / `staging` / `prod` dans le repo polyrepo (pour l'instant)
- `analytics-staging.veridian.site` tourne sur dev-server avec `~/analytics-test` docker compose,
  pas géré par ce repo. À migrer vers Dokploy + GitOps quand staging redevient critique.

## 📚 Références importantes

- **Mémoires Claude** :
  - `feedback_extract_app_from_monorepo` — règles + procédure git filter-repo
  - `session_2026-05-13_notifuse_gitops_extraction` — pièges API Dokploy + dual-router Traefik
  - `session_2026-05-13_prospection_extract` — leçons GHCR transfer + ENV pas auto-héritées GitOps
  - `project_polyrepo_migration` — état migration polyrepo Veridian
  - `project_dokploy_gitops_migration` — sprint GitOps complet
- **Sprint actif** : [`~/Bureau/SPRINT-GITOPS-VERIDIAN.md`](../../../../SPRINT-GITOPS-VERIDIAN.md)
- **Pattern blue-green migrations** : mémoire `project_blue_green_pattern`
- **CLAUDE.md repo** : [`../../../CLAUDE.md`](../../../CLAUDE.md) (règles agent + sécurité)
- **CLAUDE.md global** : `~/.claude/CLAUDE.md` (sécurité non négociable, CVE vigilance)

## 🎯 Inter-services

- **Hub** (`Christ-Roy/veridian-hub`) consomme Analytics via `https://analytics.app.veridian.site/api/admin/*`
  avec header `x-admin-key: <ADMIN_API_KEY>` (pas `Authorization: Bearer` malgré ce que l'instinct dit)
- **Tracker JS** (`/tracker.js`) installé sur les sites clients (Morel, Tramtech, AVSE, FGMC...)
  pour pageviews + forms + appels VoIP
- **Hub callback** pour provisioning tenant via `POST /api/admin/tenants` (clé `ADMIN_API_KEY`)
- **Skill `/analytics-provision`** orchestre la création tenant + site + GSC pour un nouveau client

## ⚠️ Règles de travail spécifiques Analytics

- **Tester sur dev avant push prod** : `analytics-staging.veridian.site` (cf `feedback_dev_url_before_push`)
- **Reproduce CI en local AVANT push** : `pnpm exec tsc --noEmit && pnpm exec vitest run && pnpm audit --prod --audit-level high && pnpm build`
  (cf `feedback_run_ci_locally_first`)
- **Tenants existants** : toujours penser aux 9 tenants prod avant migration DB (cf `feedback_existing_tenants_migration`)
- **JAMAIS désactiver le CVE audit gate** (cf CLAUDE.md global)
- **Compose Dokploy SHA-pinned** : bump le SHA dans `docker-compose.yml` quand on veut promouvoir une nouvelle image
  (la CI le bump pas automatiquement pour l'instant — manuel ou via Dependabot Docker)

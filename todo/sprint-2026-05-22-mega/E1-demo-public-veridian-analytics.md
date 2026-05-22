# [E1] Démo publique `demo-analytics.veridian.site` — clone du pattern `demo.staminads.com`

> **Repo cible** : `veridian-analytics-engine` (le fork staminads — déjà tout le code dispo)
> **Branche** : `feat/E1-demo-public`
> **Charge** : 4-6h (agent dédié Opus, prend son temps)
> **Dépend de** : rien — staminads upstream a déjà tout (`api/src/demo/`, `compose-demo.yaml`)
> **Bloque** : rien — c'est de la croissance / marketing

---

## But

Brancher une **instance publique** de Veridian Analytics en mode démo, accessible sur `https://demo-analytics.veridian.site`, où n'importe qui (prospect, lead, journaliste, curieux) peut voir un workspace pré-rempli avec 200k sessions / 90 jours de data réaliste **sans login**. Objectif business : convertir des prospects qui veulent voir l'app avant de signer.

Clone du pattern `https://demo.staminads.com/workspaces/demo-apple` qu'on a découvert (et qui existe déjà dans NOTRE fork — module `api/src/demo/` au complet).

---

## Ce qu'il y a DÉJÀ (no-code needed)

Staminads upstream a tout livré, on n'a qu'à activer + déployer :

| Bric | Localisation | Rôle |
|---|---|---|
| `DemoService.generate()` | `api/src/demo/demo.service.ts` | Génère workspace `demo-apple` + 200k sessions / 90j + annotation "iPhone 16 Launch" |
| `DemoController` | `api/src/demo/demo.controller.ts` | 2 endpoints `POST /api/demo.generate` + `POST /api/demo.delete`, protégés par `?secret=xxx` |
| `DemoSecretGuard` | `api/src/demo/guards/demo-secret.guard.ts` | timing-safe compare query param `secret` vs ENV `DEMO_SECRET` |
| `DemoRestrictedGuard` | `api/src/common/guards/demo-restricted.guard.ts` | Si `IS_DEMO=true` → bloque les features write (signup, billing, etc.) côté API |
| `compose-demo.yaml` | racine repo | Compose pré-câblé app + ClickHouse, ENV `IS_DEMO=true` + `DEMO_SECRET` |
| Tests e2e | `api/test/demo-mode.e2e-spec.ts` | Garantit l'isolation lecture-seule |
| Decorator `@DemoProtected()` | `api/src/demo/decorators/demo-protected.decorator.ts` | Marquer les endpoints réservés mode démo |

---

## À livrer

### 1. Branding Veridian (vs staminads brut)

L'instance démo doit afficher **"Veridian Analytics"** pas "Staminads". Quoi modifier :

- [ ] `console/index.html` : title + favicon + meta og:image **uniquement quand `IS_DEMO=true`** (sinon on n'impacte pas la console interne)
- [ ] Logo header console : Veridian (utiliser `/home/brunon5/Bureau/veridian-platform/veridian-analytics/public/logo*` ou similaire)
- [ ] Footer console : ajouter un bandeau "Vous regardez la démo Veridian Analytics" + CTA "Demander une démo réelle" (link `https://veridian.site/contact` ou `mailto:robert.brunon@veridian.site?subject=Demande%20démo%20Veridian%20Analytics`)
- [ ] Couleur primaire de la palette console = palette Veridian (vert/teal) si pas trop intrusif sur l'UI staminads (à voir avec le scope CSS de C1)
- [ ] Le **nom du workspace** dans la démo : passer de `Apple Demo` à `Veridian Analytics Demo` (modif `DEMO_WORKSPACE_NAME` dans `api/src/demo/demo.service.ts`)
- [ ] Garder `apple.com` comme site tracké (c'est joli, tout le monde reconnaît, et changer le hostname = devoir aussi changer les fixtures pages/referers cohérentes ; pas la peine sauf si on a le temps)

### 2. DNS + Traefik

- [ ] **DNS Cloudflare** : créer `demo-analytics.veridian.site` → CNAME proxied vers le dev-pub (37.187.199.185) OU prod (selon décision déploiement, cf §5)
- [ ] **Cert Let's Encrypt** auto via le Traefik concerné
- [ ] **Sous-domaine** : confirmer avec Robert = `demo-analytics.veridian.site` (pas `analytics-demo.` ni autre — décidé 2026-05-22)

### 3. Déploiement

Deux options. **Recommandation : option B** (instance prod isolée), car la démo doit toujours être up même si dev-pub crashe.

**Option A — dev-pub (rapide)** :
- Ajouter un stack docker compose sur dev-pub
- Service systemd pour auto-restart
- Resources mem_limit 1G, cpus 1

**Option B — Dokploy prod (recommandé)** :
- Créer un compose Dokploy dédié `compose-veridian-analytics-demo`
- Image : `ghcr.io/christ-roy/veridian-analytics-engine:latest` (la même que staging/prod, mais avec ENV `IS_DEMO=true`)
- ClickHouse dédié (pas le shared prod — la démo ne doit jamais polluer la prod réelle)
- Resources : mem_limit 2G, cpus 1
- Traefik label sur `demo-analytics.veridian.site`
- Cert Let's Encrypt
- Backup : aucun (le seed se rejoue)

### 4. Secret + provisioning

- [ ] Générer `DEMO_SECRET` (32 chars hex via `openssl rand -hex 32`)
- [ ] Ajouter dans `~/credentials/.all-creds.env` (key `DEMO_SECRET_ANALYTICS`)
- [ ] Injecter dans le compose (option A) ou ENV Dokploy (option B)
- [ ] **Premier seed** : `curl -X POST 'https://demo-analytics.veridian.site/api/demo.generate?secret=$DEMO_SECRET'` une fois
- [ ] Vérif visuelle : `https://demo-analytics.veridian.site/workspaces/demo-apple` doit afficher le workspace seedé

### 5. Cron de re-seed (rafraîchir données)

Le workspace démo doit rester "actuel" — sinon les dates dans le dashboard glissent et c'est moche.

- [ ] Cron daily à 03:00 UTC sur dev-pub : `curl -X POST 'https://demo-analytics.veridian.site/api/demo.delete?secret=...' && curl -X POST 'https://demo-analytics.veridian.site/api/demo.generate?secret=...'`
- [ ] Le re-seed prend ~5-10min (200k sessions × 90 jours) — pas un problème pendant la nuit
- [ ] Logger le résultat dans `journalctl` pour vérif
- [ ] Inspirer le pattern du cron `gsc-sync-cron.yml` qu'on est en train de câbler (workflow GH Actions OU cron systemd dev-pub, à toi de voir le plus adapté)

### 6. Sécurité

- [ ] **`IS_DEMO=true` doit bloquer les écritures** côté API — vérifier que `DemoRestrictedGuard` est appliqué aux endpoints sensibles (signup, billing, password reset, workspace.create, workspace.delete, etc.). Si manquant sur certains, ajouter.
- [ ] **Rate limit** sur l'instance démo (`express-rate-limit` ou Traefik) : 60 req/min/IP (anti-scraping abusif)
- [ ] **Headers sécu** : CSP, HSTS, X-Frame-Options. Si différents de staging/prod, document why.
- [ ] **Ne PAS exposer le bridge** (`analytics-engine-bridge-demo.veridian.site`) — la démo ne doit servir QUE le frontend + l'API publique staminads. Le bridge n'a pas vocation à être public en démo.
- [ ] **Robots.txt** : autoriser indexation de la page d'accueil seulement (SEO démo) ; pas du contenu workspace (pour éviter du noise dans Google sur des dates fictives)
- [ ] **HTTPS only** : redirect HTTP → HTTPS automatique via Traefik
- [ ] **Pas de mention `staminads`** dans les meta SEO / Open Graph (pour pas qu'on soit dilué dans leur SEO ni qu'eux dans le nôtre)

### 7. CTAs marketing

L'instance démo doit convertir, pas juste afficher. Brancher :

- [ ] Bandeau header **uniquement en mode démo** : "🎯 Vous regardez la démo publique de **Veridian Analytics**. [Demander un compte gratuit →](mailto:robert.brunon@veridian.site?subject=Demande%20Veridian%20Analytics)"
- [ ] Page de garde `/` (si pas déjà la liste workspaces) : courte présentation Veridian + bouton "Voir la démo Apple" → `/workspaces/demo-apple`
- [ ] Footer : "Hébergé en France · Pas de cookies tiers · Source de la démo : 200 000 sessions générées" + lien `https://veridian.site`
- [ ] **Tracking de conversion** sur les clics CTA (avec staminads démo lui-même, ironique mais cool — workspace dédié `demo-conversions` qui track les clics depuis la démo vers le `mailto:` Veridian)

### 8. Tests + monitoring

- [ ] Smoke test playwright : ouvrir `https://demo-analytics.veridian.site/workspaces/demo-apple` → vérifier qu'on voit > 0 visiteurs sur 30j sans login
- [ ] Healthcheck `/api/health` répondant 200
- [ ] Smoke quotidien (avant le re-seed) : si la page est 5xx, alerter via Telegram
- [ ] Ajouter à `obs check` (cf §1 du repo veridian-infra) une ligne pour l'instance démo

### 9. Documentation

- [ ] `docs/DEMO-PUBLIC.md` (nouveau dans le repo) : architecture, comment re-seeder à la main, où trouver le secret, comment changer le branding si besoin V2
- [ ] Mention dans `~/.claude/projects/-home-brunon5-Bureau-veridian-platform-veridian-analytics/memory/` : nouvelle memory `project_demo_public_veridian.md` avec l'URL + le secret name + le compose ID si Dokploy

### 10. Audit final Chrome MCP

- [ ] Ouvrir `https://demo-analytics.veridian.site` dans Chrome MCP, vérif :
  - Page accessible sans login ✓
  - Workspace `demo-apple` visible ✓
  - 200k sessions visibles dans le dashboard ✓
  - CTA mailto fonctionne ✓
  - Console JS clean (pas d'erreurs 4xx/5xx) ✓
  - Mobile responsive (375px) ✓
  - Lighthouse > 80 (perf + accessibility + SEO)
- [ ] Screenshots committés dans `docs/demo-screenshots/`

---

## Choix techniques à arbitrer

**À toi (l'agent E1) de trancher** :

- Option A vs B (déploiement) : Robert préfère B (prod isolée Dokploy) **sauf si** ça prend > 2h de plus que A. À toi de voir.
- Re-seed cron : workflow GitHub Actions ou cron systemd dev-pub ? Penche pour systemd dev-pub (plus simple, pas de runner CI à mobiliser pendant 10min).
- Branding "Veridian" : modif `console/` UI directement vs CSS injection runtime via une var d'env ? Penche pour conditionnel `IS_DEMO=true` (modifs ciblées, pas un fork de la console).
- Workspace name "Apple Demo" → "Veridian Analytics Demo" : modif `demo.service.ts` (impacte tests e2e). Faire et fixer les tests.

---

## Pas de "je continue ?". Pas de raccourci. Tu prends ton temps.

L'objectif business : Robert envoie l'URL à un prospect, le prospect ouvre, voit la démo en 5 secondes, comprend la valeur, clique sur le CTA. Tout doit être lisse.

---

## Status

✅ done — 2026-05-22 (mergé sur `dev`)

### Livré

- **API** : `demo.login` (auto-login anonyme JWT), `public-config` (le SPA
  détecte `IS_DEMO` au runtime — bundle unique), `health` (liveness probe).
  `AuthModule` réexporte `JwtModule`. `demo.service` : `ensureDemoUser` +
  `ensureSetupComplete`. Workspace renommé "Veridian Analytics Demo".
  `SetupMiddleware` whitelist les endpoints publics.
- **Console** : `DemoBanner` + `DemoFooter` (gated `is_demo`, console
  interne intacte), auto-login démo au boot, branding Veridian
  (title/favicon/logo), `veridian-logo.svg`, `robots.txt`.
- **Déploiement** : `compose/demo.yml` (stack Dokploy isolée — engine +
  ClickHouse dédié, pas de bridge, rate-limit Traefik 60/min/IP).
- **Cron re-seed** : `scripts/demo/` — systemd timer daily 03:00 UTC sur
  dev-pub + installeur.
- **DNS** : A `demo-analytics.veridian.site → 51.210.7.44` (Dokploy prod).
- **Secret** : `DEMO_SECRET_ANALYTICS` dans `~/credentials/.all-creds.env`.
- **Docs** : `docs/DEMO-PUBLIC.md` + memory `project_demo_public_veridian.md`.
- **Tests** : 53 unit (demo+health) + 29 e2e demo-mode, tous verts.

### Choix tranchés

- Déploiement : **Option B** (Dokploy prod isolé) — la démo reste up même
  si dev-pub crashe.
- Re-seed : **cron systemd dev-pub** (pas de runner CI mobilisé 10 min).
- Branding : **conditionnel `IS_DEMO=true`** au runtime (pas de fork
  console, pas de rebuild d'image).
- Repo `veridian-analytics-engine` privé → stack Dokploy en `sourceType:
  raw` (YAML collé), pas git source.

## Notes coordination

- L'agent **CI/Husky hardening** modifie `.github/workflows/` + `.husky/` — pas de chevauchement avec toi (tu touches `api/src/demo/*`, `compose-demo.yaml`, DNS, Dokploy, docs).
- L'agent **UI polish** modifie `console/src/veridian/*` — léger chevauchement si tu changes la console pour le mode démo. Coordonne : tu modifies UNIQUEMENT `console/` quand `IS_DEMO=true`, lui modifie tout le reste.
- L'agent **B1 forms** et **B2 push** sur le bridge — aucun chevauchement avec toi.

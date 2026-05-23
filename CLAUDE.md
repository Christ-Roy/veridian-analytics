# Veridian Analytics — Instructions agent

> Repo polyrepo extrait du monorepo `veridian-platform` le 2026-05-13.
> Worktree local : `~/Bureau/veridian-platform-analytics/`
> Dossier renommé possible : `~/Bureau/veridian-analytics/`

---

## 🎯 VISION ANALYTICS — figée 2026-05-23 par Robert

> Cette section est la **source de vérité scope** pour analytics-engine.
> Lecture obligatoire avant tout ticket touchant à analytics.
> Toute proposition contradictoire = remonter à Robert AVANT d'agir.

### Stack cible

L'app future qui sera commercialisée vit dans le repo **`veridian-analytics-engine`**
(fork staminads — Vite + TanStack Router + AntDesign + bridge Express + ClickHouse + Postgres).

### Repo legacy `veridian-analytics` — CONDAMNÉ À MORT à terme

Robert le 2026-05-23 : *"on va dégager le repo legacy à terme sois pas timide"*.

Ce repo `veridian-analytics` (Next.js / Auth.js / Prisma / Postgres) n'est PAS
juste "en gel feature". Il est en **fin de vie programmée**.

**Conditions de dépose** (toutes doivent être vraies) :
1. Les 5 clients existants ont migré vers `veridian-analytics-engine` (cf
   ticket `D2-migrate-5-clients.md` — scripts livrés, exécution en attente)
2. Le DNS `analytics.app.veridian.site` (legacy) est basculé ou retiré
   au profit de `analytics-engine.app.veridian.site` (engine)
3. Hub côté provisioning a coupé tout appel vers le bridge legacy
   (`Christ-Roy/veridian-hub/lib/analytics/*` — vérifier)
4. URL shortener `lnk.veridian.site` (ticket D1) déplacé vers engine OU
   externalisé (Cloudflare Workers, par ex.) OU dégagé si Robert n'en veut
   plus

**Quand toutes ces conditions sont vraies → archive + remove du repo** :
- Tag `legacy-final-snapshot` posé sur le dernier commit
- Stack Dokploy `compose-synthesize-virtual-transmitter-i9bv43` détruite
- DNS retiré
- Repo GitHub passé en archive (read-only)
- Worktree local supprimé

**Donc pour ce CLAUDE.md** : tout ce qui suit cette section décrit le legacy
condamné. Lis-le si tu maintiens du code legacy ponctuel (bug critique chez un
client pas encore migré). Sinon → **ignore et travaille sur `veridian-analytics-engine`**.

Pas de nouvelle feature, pas de refactor "propre", pas d'investissement ici.
On laisse le legacy mourir tranquille pendant que les clients migrent.

### Scope final commercialisable — 3 features et c'est TOUT

1. **Visiteurs uniques + analytics natif staminads** — dashboard `/workspaces/$wsId/`
   et toutes les pages staminads vanille (Live, Explore, Goals, Filters,
   Annotations, Settings). On NE refait PAS ce que staminads fait déjà bien.

2. **Calls — téléphonie OVH** : connecter OVH dans Settings, le bridge pull
   les call logs, sous-route native `/workspaces/$wsId/calls`. Matching
   appel ↔ visiteur via Lead.phone.

3. **Search Console — bonus SEO** : connecter Google Search Console dans
   Settings, le bridge pull les data GSC, sous-route native
   `/workspaces/$wsId/search-console`. Affiche : **top mots-clés recherche,
   ranking pages, indexation des pages** + dashboard performance natif.

**Et c'est tout.** Tout le reste qui a été porté du legacy = à débrancher.

### Features explicitement HORS scope (à débrancher ou archiver)

| Feature livrée pendant le sprint | Décision Robert |
|---|---|
| **Score Veridian global** (composant hero) | ❌ Débrancher → `_optional-features/`. Pas dans le pricing. |
| **Shadow marketing blocks** (CTA upsell sur services inactifs) | ❌ Débrancher → `_optional-features/`. |
| **Locked service page** (paywall feature) | ❌ Débrancher → `_optional-features/`. |
| **Sous-route custom Veridian dashboard** (`/workspaces/$wsId/veridian`) | ❌ Supprimer. L'utilisateur reste sur le dashboard staminads natif. |
| **Forms ingestion + Lead dedup + LeadSession** (ticket B1) | ❌ **SUPPRIMER** — bridge `src/forms/` drop, tables Prisma drop, endpoint `/api/ingest/form` retiré, UI retirée. Les sites client utilisent les **goals staminads natifs** (`event: form_submission`) comme tous les autres analytics. |
| **PWA + Push notifications** (ticket B2, VAPID, service worker) | 📦 **ARCHIVER** — code déplacé sous `_archive/`, aucune entrée UI, ENV `VAPID_*` retirée des composes. Pas de suppression DB (tables conservées au cas où). |
| **Page admin Robert** (legacy `app/admin/page.tsx`) | ❌ NE PAS PORTER. Pas besoin d'admin global en V1. |

### Conséquences techniques

- **Build/CI** : on n'embarque plus `web-push` dans le bridge. Les checks Trivy passent plus vite.
- **Tests E2E** : `tests/e2e/03-forms-leads/`, `tests/e2e/04-push-pwa/` supprimés.
  Pas de specs maintenues sur des features qu'on ne commercialise pas.
- **Démo publique** (`demo-analytics.veridian.site`) : reflète le scope final.
  Pas de tabs Forms/Push visibles. Pas d'onglet "Veridian" custom.
  La démo montre **uniquement** ce qui sera vendu (visiteurs uniques + Calls + GSC).
- **Tunnel `veridian.*.{workspaceId}.tsx`** : supprimé. Les features Veridian vivent
  dans les sous-routes natives `workspaces/$workspaceId/{calls,search-console,welcome}.tsx`
  intégrées au layout staminads (nav + breadcrumbs + workspace selector + AssistantPanel).

### Langue : français par défaut

L'app **commercialisée en France pour des clients français**. Toute la console
est en **français** (in-place, pas de système i18n) :
- HTML `lang="fr"`
- Vouvoiement par défaut
- Accents préservés (à, é, è, ç, ô, ï…)
- Anglicismes acceptés uniquement pour noms propres (Analytics, Search Console,
  GSC, URL, API, HMAC)
- Format date `dd/MM/yyyy HH:mm`, virgule décimale française pour les chiffres

Pas de toggle EN/FR dans l'UI (= simplifie). Si Robert décide d'ouvrir à
l'international plus tard, on ajoute un i18n setup à ce moment-là.

### Hygiène code

- **ZÉRO build local** : les builds (`npm install`, `vite build`, `vitest`,
  `playwright install`, `docker build`) explosent la RAM de la machine de Robert
  (7.6Gi). Tout build/test → CI GitHub Actions ou dev-pub via SSH. Cf memory
  `feedback_no_local_docker_build` (durcie 2026-05-22).
- **Sous-agents en Opus uniquement** (`model: "opus"`) — cf memory
  `feedback_subagents_opus_only`.
- **Husky pre-push ULTRA-STRICT** : JAMAIS `--no-verify`.
- **Worktree isolé strict** : ne jamais travailler dans le checkout principal
  partagé. Cf memory `feedback_never_touch_other_agents` et incident 2026-05-22
  où 2 agents se sont écrasés mutuellement.

### Anti-régression : ce qui ne doit pas être perdu

Robert a explicitement formulé cette vision le 2026-05-23 après audit du sprint
giga. Si un futur agent re-porte score/shadow/locked/forms/push parce qu'il
trouve les tickets en `_optional-features/` ou `_archive/` → **erreur**. Ces
features sont **désactivées commercialement**, pas en attente de réactivation
automatique. Toute réactivation = décision business Robert.

---

## Ce que c'est

Dashboard analytics + SEO multitenant pour les sites Veridian.
Stack Next.js 15 / Auth.js v5 / Prisma 6+ / Postgres / Vitest / Playwright.

**Note** : la stack décrite ci-dessus concerne le repo **legacy** `veridian-analytics`.
La stack cible commercialisée est dans `veridian-analytics-engine` (cf section
VISION ci-dessus).

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

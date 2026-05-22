# [UI-AGENT] Brancher proprement les features livrées dans la console

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche** : `feat/ui-integration-live` (depuis `dev`)
> **Charge** : ouvert (l'agent prend son temps, ce n'est PAS un sprint flash)
> **Dépend de** : C1 ✅ (composants portés) + A1 ✅ + A2 ✅ + A3 ✅ (endpoints bridge)
> **Bloque** : rien — c'est de l'intégration continue

---

## But

Brancher les composants Veridian (livrés par C1) sur les endpoints bridge réels (livrés par A1/A2/A3) et faire une **page dashboard root parfaitement intégrée et JOLIE**.

L'agent UI doit :
- Prendre son temps (qualité > vitesse)
- Itérer plusieurs fois (Chrome MCP pour audit visuel à chaque pass)
- Avoir l'œil esthétique : spacing, typo, contraste, animations subtiles, dark mode si possible
- Brancher **uniquement ce qui est faisable maintenant** (cf. matrice ci-dessous), stub propre pour le reste avec `TODO: enable when [ticket] mergé`

---

## Matrice : ce qui est faisable MAINTENANT

| Feature | Endpoint bridge | Composant C1 dispo | Faisable now |
|---|---|---|---|
| Score Veridian global | `GET /api/admin/tenant/:workspaceId/score` ✅ A1 | `service-score-block.tsx` ✅ | **OUI** |
| Tenant status (services actifs/inactifs) | `GET /api/admin/tenant/:workspaceId/status` ✅ A2 | (utilise les counts pour rendre les blocs) | **OUI** |
| Shadow marketing (services inactifs) | `GET /api/admin/shadow-marketing` ✅ A3 (public) | `shadow-marketing-block.tsx` ✅ | **OUI** |
| Sparkline pageviews 30j | (peut être fait via staminads.query custom) | `sparkline.tsx` ✅ | **OUI** (V1 simple) |
| Locked service page | (utilise `inactiveServices` du status) | `locked-service-page.tsx` ✅ | **OUI** |
| Impersonation banner | (V1 toujours `impersonating=false`) | `impersonation-banner.tsx` ✅ | **OUI** (stub statique) |
| PWA install + push | C1 a livré stub V1 | `pwa-register.tsx` ✅ | **OUI** (juste l'install prompt, push réel = B2) |
| GSC tab | endpoint A4 pas mergé | — | NON, stub avec `TODO A4` |
| Forms tab | endpoint B1 pas mergé | — | NON, stub avec `TODO B1` |
| Onboarding wizard | endpoint C3 pas livré | — | NON |

---

## À livrer

### 1. Page dashboard root `/veridian/dashboard/:workspaceId`

Dans `console/src/veridian/pages/` (nouveau dossier, hors AntDesign upstream) :

- [ ] `console/src/veridian/pages/dashboard.tsx` — page root qui fetch :
  - `GET /api/admin/tenant/:workspaceId/score`
  - `GET /api/admin/tenant/:workspaceId/status`
  - `GET /api/admin/shadow-marketing`
  - (parallèle via Promise.all)
- [ ] Layout 2 colonnes ou 3 colonnes selon écran (responsive Tailwind)
- [ ] Skeleton loader pendant fetch (pas de spinner naze)
- [ ] Error state propre si bridge down (avec retry button)
- [ ] Header : nom du tenant + slug + status (active/suspended) + bouton "Voir le site"
- [ ] **Section "Score Veridian"** en haut : utilise `service-score-block.tsx` avec data réelle
- [ ] **Section "Services actifs"** : grid de cards pour chaque service `active` (pageviews count, sparkline 30j placeholder pour V1)
- [ ] **Section "Boostez vos résultats"** : grid des `shadow-marketing-block.tsx` pour chaque service `inactive` avec CTA `mailto:` pré-rempli (`{{domain}}` remplacé par le domaine du tenant)
- [ ] Animations subtiles : fade-in cards en entrée, hover sur les blocks (scale 1.02 + shadow), aucune animation gratuite

### 2. Intégration dans la console staminads

- [ ] Route React Router (ou équivalent staminads) `/veridian/dashboard/:workspaceId` accessible depuis la navigation
- [ ] Ne PAS casser la nav AntDesign upstream
- [ ] Ajouter un lien "Veridian Dashboard" dans le menu staminads (où c'est naturel, à toi de voir)
- [ ] Le scope Tailwind `<div className="veridian-scope">` doit englober toute la page Veridian

### 3. Esthétique — exigence Robert

Tu es l'agent UI. Tu as l'œil :

- **Typography** : Inter ou similaire, hiérarchie claire (tracking, leading, weight)
- **Couleurs** : palette Veridian (vérifie le legacy `~/Bureau/veridian-platform/veridian-analytics/app/globals.css` ou tailwind.config pour les CSS vars exactes — `--background`, `--foreground`, `--primary`, etc.)
- **Spacing** : grille 4/8/16/24/32px, pas de marges au pifomètre
- **Cards** : `rounded-2xl`, `shadow-sm` hover `shadow-md`, transition smooth
- **Score block** : doit être *le hero* de la page — gros, lisible, avec une jauge ou progress visuelle évidente
- **Shadow marketing blocks** : doivent vraiment donner envie de cliquer (CTA contrasté, pas timide)
- **Empty states** : quand workspace vide, message bienvenu + CTA "Installer le tracker" (la modal viendra plus tard via C3)
- **Mobile-responsive** : la page doit être utilisable sur mobile (Robert check parfois depuis son téléphone)

### 4. Audit visuel avec Chrome MCP

Tu DOIS utiliser Chrome MCP pour vérifier ton travail visuellement à chaque itération significative :

- Lance la page sur `analytics-engine-dev.staging.veridian.site` (env hot-reload, ton code arrive là dès le push origin/dev — vérif par `ssh dev-pub 'cd /opt/dev/analytics-engine && git pull --ff-only origin dev'`)
- Capture screenshots à chaque étape (desktop + mobile via `resize_window`)
- Inspecte la console pour les erreurs JS (console doit être clean)
- Inspecte le network pour valider que les 3 fetch sont parallèles et < 500ms
- Itère sur l'esthétique : pas la première version qui sort, la 3e ou 4e

### 5. Tests Vitest

- [ ] `console/src/veridian/pages/__tests__/dashboard.test.tsx` :
  - Render avec data complète → toutes sections présentes
  - Render avec loading → skeleton visible
  - Render avec error → retry button cliquable
  - Mock fetch des 3 endpoints (MSW ou stub `vi.fn()`)
- [ ] Mise à jour `test-coverage-map.yaml`

### 6. Documentation visuelle

Crée un dossier `console/src/veridian/pages/screenshots/` avec :
- `dashboard-desktop.png` (1440px)
- `dashboard-mobile.png` (375px)
- `dashboard-empty-state.png`
- `dashboard-loading.png`
- `dashboard-error.png`

Ces screenshots seront committés dans le repo (taille raisonnable, < 300KB chacun via compression).

---

## Tests à PRÉPARER pour les features futures (mais NE PAS BRANCHER)

Pour que les agents B1/B2/A4/C2 trouvent une UI prête quand ils livrent leurs endpoints :

- [ ] Stub component `console/src/veridian/pages/dashboard-tabs/forms-tab.tsx` qui affiche "🚧 Forms — disponible après ticket B1" avec un mockup design
- [ ] Stub `console/src/veridian/pages/dashboard-tabs/gsc-tab.tsx` avec mockup "🚧 GSC — disponible après ticket A4"
- [ ] Stub `console/src/veridian/pages/dashboard-tabs/push-tab.tsx` avec mockup "🚧 Push — disponible après ticket B2"
- [ ] Les stubs sont ESTHÉTIQUES (Robert peut les montrer en démo), pas du "TODO" moche

---

## Process

1. **Pull dev** à jour (au moment où tu démarres : A1 ✅ A2 ✅ A3 ✅ C1 ✅, peut-être A4/B3 mergés entretemps — adapte)
2. **Lis les composants C1** en entier pour comprendre leurs props
3. **Lis les endpoints A1/A2/A3** en entier (`veridian-bridge/src/app.ts`) pour les types de retour
4. **Lis le legacy** `~/Bureau/veridian-platform/veridian-analytics/app/admin/[workspaceId]/page.tsx` (s'il existe) ou équivalent — pour piquer l'inspiration design **sans** dupliquer le code
5. **Itère** : v1 fonctionnelle → screenshot → améliore → v2 → screenshot → améliore → v3 final
6. **Push** sur `feat/ui-integration-live` 
7. **Merge** sur `dev` (ff-only)
8. **Pull sur dev-pub** pour que l'env hot-reload reflète
9. **Audit Chrome MCP final** sur l'URL réelle, screenshot la version live, ajout à `screenshots/`

---

## Coordination

- L'agent CI/Husky hardening (`ab31938b4d7e4f00d`) bosse en parallèle sur les workflows GitHub Actions / hooks Husky — pas de conflit avec toi (tu touches à `console/`, lui à `.github/` + `.husky/` + `scripts/`)
- Agents A4 (GSC) et B3 (Hub HMAC) toujours en cours — quand ils mergeront, tu pourras enrichir tes tabs stub (en V2 dans une autre passe)

---

## Pas de "je continue ?". Pas de raccourci esthétique. Tu prends ton temps.

L'objectif : que Robert ouvre la page sur son téléphone, fasse "wow", et n'ait rien à redire.

---

## ✅ LIVRÉ — 2026-05-22

**Commit** : `3381e10` (merge ff-only sur `dev`) — branche `feat/ui-integration-live`.

**Livré** :
- `console/src/veridian/pages/dashboard.tsx` — page root, fetch parallèle
  score/status/shadow-marketing, hero score, services actifs, shadow
  marketing, skeleton/error/empty states, 4 tabs.
- `console/src/veridian/pages/dashboard-tabs/` — stubs esthétiques
  Forms (B1) / GSC (A4) / Push (B2) avec mockups démo-ready + `_shared.tsx`.
- `console/src/veridian/api.ts` — client bridge typé (BridgeApiError,
  fetchDashboard aggregator Promise.all).
- `console/src/veridian/theme.css` — thème dark teal scopé `.veridian-scope`.
- `console/src/routes/_authenticated/veridian.dashboard.$workspaceId.tsx`
  — route TanStack sous `_authenticated`.
- Lien "Veridian" ajouté dans la nav workspace staminads (desktop + mobile)
  dans `workspaces/$workspaceId.tsx`.
- `console/public/veridian-preview.html` — preview offline multi-état
  (`?state=ready|loading|error|empty`), démo-ready sans backend.
- `console/src/veridian/pages/screenshots/` — 5 PNG (desktop, mobile,
  loading, error, empty-state), tous < 300KB.
- 8 tests Vitest `dashboard.test.tsx` (24 tests veridian au total — verts).

**Audit Chrome MCP** : rendu validé (palette dark teal, hero score 65,
sparklines verts, shadow blocks contrastés). Console JS clean (seule
exception = extension MCP, hors code app).

**Build / tests** : `npm run build` ✅ · `vitest` 24/24 ✅ · `tsc` ✅ ·
pre-push hook ALL GREEN (222 tests bridge, 0 CVE).

**Reste pour V2** (hors scope, dépend d'autres tickets) :
- Sparklines réelles 30j (besoin endpoint `/timeseries` bridge)
- Tabs Forms/GSC/Push à brancher quand B1/A4/B2 mergés
- Onboarding wizard (C3)

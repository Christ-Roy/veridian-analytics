# [SPRINT] Port UI Analytics legacy + polish initial dans la console staminads

> **Type** : Frontend port + polish design system Veridian dans `veridian-analytics-engine/console/`
> **Sévérité** : 🟧 P2 (sprint principal — sans UI Robert ne voit rien)
> **Owner** : agent Analytics (mode hot-reload sur dev-pub via Tailscale)
> **Créé** : 2026-05-21
> **Dépend de** : [`2026-05-21-features-legacy-to-staminads.md`](./2026-05-21-features-legacy-to-staminads.md) Phase B1 (backend endpoints disponibles)

---

## Pourquoi un ticket UI séparé du polish UI continu ?

| Fichier | But | Cadence |
|---|---|---|
| [`UI-POLISH.md`](./UI-POLISH.md) | Liste vivante des polish à faire en LIVE avec Robert sur env dev (1 modif = 1 push = 1 reload) | Continue (mini-itérations < 5 min) |
| **Ce ticket** (2026-05-21) | **Port initial complet** des composants Veridian dans la console staminads, puis premier polish global avec Chrome MCP (audit pages × responsive × accessibilité × console errors) | Sprint 1-2 jours, livré en bloc |

Une fois ce ticket livré (UI fonctionnelle, propre, sans erreur console), on bascule sur `UI-POLISH.md` pour les micro-ajustements continus avec toi.

---

## Phase U1 — Port composants Veridian (jour 1)

### U1.1 — Composants React à porter depuis `veridian-analytics` legacy

**Source** : `~/Bureau/veridian-platform/veridian-analytics/components/`

| Composant legacy | Cible dans staminads console |
|---|---|
| `components/service-score-block.tsx` | `console/src/veridian/service-score-block.tsx` |
| `components/shadow-marketing-block.tsx` | `console/src/veridian/shadow-marketing-block.tsx` |
| `components/locked-service-page.tsx` | `console/src/veridian/locked-service-page.tsx` |
| `components/sparkline.tsx` | `console/src/veridian/sparkline.tsx` |
| `components/impersonation-banner.tsx` | `console/src/veridian/impersonation-banner.tsx` |
| `components/gsc/*` | `console/src/veridian/gsc/*` |
| `components/ui/card.tsx` (shadcn) | `console/src/veridian/ui/card.tsx` (gardé pour les blocks Veridian, pas pour le reste de staminads qui utilise AntDesign) |

- [ ] **Règle d'isolation** : nos blocks Veridian = Tailwind + shadcn/ui (cohérent legacy). Le reste de la console staminads = AntDesign upstream. On encapsule, on ne mélange pas (sinon AGPL conflict + casse upstream upgrade).
- [ ] Ajouter Tailwind à la config Vite de la console (si pas déjà) — config minimaliste scopée sur `src/veridian/**` pour ne pas polluer le CSS upstream
- [ ] Ajouter shadcn deps : `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (déjà présent ? vérifier)
- [ ] Tests Vitest pour les composants (existants côté legacy à reporter)

### U1.2 — Pages dashboard à porter

| Page legacy | Cible dans staminads console (route) |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` (271 lignes — Score + grille services) | Embed au top de la page d'accueil workspace staminads existante |
| `app/(dashboard)/dashboard/gsc/page.tsx` (87L) | Nouvelle route `/workspace/:id/gsc` |
| `app/(dashboard)/dashboard/forms/page.tsx` (200L) | Nouvelle route `/workspace/:id/forms` |
| `app/(dashboard)/dashboard/calls/page.tsx` (254L) | Nouvelle route `/workspace/:id/calls` (vide V1, affiche "Bientôt — VoIP en cours d'intégration") |
| `app/(dashboard)/dashboard/push/page.tsx` (42L) | Nouvelle route `/workspace/:id/push` |
| `app/(dashboard)/dashboard/settings/page.tsx` (15L — placeholder) | Embed dans settings staminads upstream |
| `app/admin/page.tsx` | Nouvelle route `/admin` (réservée SUPERADMIN) avec liste cross-workspace + impersonation |

- [ ] Adapter les pages legacy : remplacer `auth()` Auth.js par auth bridge (token JWT staminads + check via bridge `GET /api/admin/whoami`)
- [ ] Remplacer fetch Prisma direct par fetch bridge HTTP (`/api/admin/tenant/:slug/score`, etc.)
- [ ] Garder les `export const dynamic = 'force-dynamic'` équivalent côté React (TanStack Query `refetchOnMount: 'always'`)

---

## Phase U2 — Audit polish avec Chrome MCP (jour 2 matin)

> **Tool** : `mcp__claude-in-chrome__*` — l'agent ouvre la console en headfull, navigue les pages, screenshote, lit la console, valide responsive.
> **Pré-requis** : env dev opérationnel sur `https://analytics-engine-dev.staging.veridian.site/`.

### U2.1 — Checklist d'audit page par page

Pour CHAQUE page portée :

- [ ] Screenshot desktop 1440×900
- [ ] Screenshot mobile 375×667
- [ ] Vérifier `mcp__claude-in-chrome__read_console_messages` : **zéro erreur**, zéro warning React non lié à staminads upstream
- [ ] Vérifier les requêtes réseau (`read_network_requests`) : pas de 404, pas de CORS, pas de payload énorme (>500kB JS)
- [ ] Vérifier l'accessibilité minimale :
  - Tous les `<img>` ont un `alt`
  - Tous les `<input>` ont un `<label>`
  - Heading order (h1 → h2 → h3, pas de saut)
  - Contraste WCAG AA (vérifié via DevTools accessibility tab)
- [ ] Vérifier le responsive : pas de scroll horizontal sur mobile, les tableaux ont une stratégie (scroll int. ou cards stack)

### U2.2 — Pages cibles de l'audit

- [ ] `/` (dashboard workspace) — Score + ServiceScoreBlocks + ShadowMarketingBlocks
- [ ] `/workspace/:id/gsc` — Tableau queries (top 100), filtres, état vide
- [ ] `/workspace/:id/forms` — Liste FormSubmission + détail
- [ ] `/workspace/:id/calls` — État "Bientôt" (V1 placeholder)
- [ ] `/workspace/:id/push` — Form envoi notif + liste abonnés
- [ ] `/workspace/:id/settings` — Membres + api key + webhook URLs
- [ ] `/login` — Form credentials + magic link
- [ ] `/welcome` — Onboarding wizard 3 étapes (snippet → pose → vérif)
- [ ] `/admin` — Liste cross-workspace + impersonation banner
- [ ] `/r/[slug]` — 404 lien expiré (ticket S1 shortener, à coordonner)

### U2.3 — Capture des findings

- [ ] Pour chaque souci détecté : entrée dans `UI-POLISH.md` avec checkbox + page + nature du problème
- [ ] **Pas de fix dans cette phase** — on inventorie, on fixera bloc par bloc en live avec Robert (sauf si trivial : alt manquant, label manquant, typo)

---

## Phase U3 — Premier polish global (jour 2 après-midi)

### U3.1 — Design system Veridian

- [ ] **Palette** : reprendre la palette Veridian existante depuis `tailwind.config.ts` legacy (analyser les couleurs primaires/secondaires/accents)
- [ ] **Typo** : police principale Veridian (à confirmer avec Robert)
- [ ] **Boutons** : variantes primary / secondary / ghost / danger / link (cohérent legacy)
- [ ] **Inputs** : style cohérent label + validation inline + erreur
- [ ] **Cards KPI** : layout standardisé (label + valeur + delta vs période précédente + icône)

### U3.2 — Composants partagés

- [ ] **DataTable** : ressortir un composant réutilisable (tableaux dans GSC, Forms, Calls, Admin)
- [ ] **DateRangePicker** : un composant unique pour tous les filtres temps
- [ ] **EmptyState** : illustration + texte + CTA (modèle réutilisable pour "Pas encore de data", "Connecte GSC", etc.)
- [ ] **Toast** : succès / erreur / info — design cohérent
- [ ] **Modal** : sizing standardisé + esc + click outside
- [ ] **LoadingSkeleton** : skeleton plutôt que spinner (perception perf meilleure)

### U3.3 — Onboarding tenant wizard

> Trigger : un user crée un workspace, il atterit sur `/welcome` qui le guide pour installer le snippet.

- [ ] Étape 1 : "Copie ton snippet" (encart code + bouton copier) avec UTM convention pré-expliquée
- [ ] Étape 2 : "Pose-le dans le `<head>`" (illustration + lien doc)
- [ ] Étape 3 : "Vérifier" → ping `/api/admin/tenant/:slug/check-tracker` qui retourne `{ tracking: 'ok', firstSeenAt: '...' }` ou `{ tracking: 'waiting', lastChecked: '...' }`
- [ ] Si tracking ok → redirect dashboard
- [ ] Si tracking jamais reçu après 24h → email Notifuse "Tu as oublié ?"

---

## Phase U4 — Validation finale (jour 2 fin)

- [ ] Chrome MCP audit final : toutes les pages portées sans erreur console, sans warning critique
- [ ] Screenshot tour complet (10 pages) commités dans `docs/screenshots-2026-05-XX/` pour traçabilité
- [ ] Robert valide visuellement sur l'env dev (`https://analytics-engine-dev.staging.veridian.site/`)
- [ ] Tag git `v0.4.0-ui-port-done`

---

## Workflow hot-reload obligatoire

1. **Bosser sur la branche `dev`** du repo `veridian-analytics-engine`
2. **Push `dev`** → CI quick checks (compose lint + bridge tests + SDK vitest)
3. **`ssh dev-pub 'bash /opt/dev/analytics-engine/scripts/dev-up.sh'`** → reload auto (NestJS watch ~1-2s, Vite HMR si configuré pour la console)
4. **Refresh** `https://analytics-engine-dev.staging.veridian.site/` dans navigateur
5. **Robert valide visuellement** OU agent valide via Chrome MCP
6. **Quand bloc OK** : `git checkout staging && git merge dev && git push` → CI deploy staging Traefik standard

**Pas de build local d'image** (cf. memory `feedback_no_local_docker_build`).

---

## Hors scope

- **AntDesign upgrade** côté staminads upstream — on n'y touche pas
- **AI assistant Veridian** sur les blocks Score/Shadow — V2 (l'AI assistant staminads natif reste sur ses propres métriques)
- **i18n complet** — V2 (FR-only V1, c'est la cible Robert)
- **Mobile-first refactor** — on s'assure que ça marche mobile mais on ne refait pas le design en mobile-first

---

## Critères d'acceptation

- [ ] Toutes les pages legacy ont leur équivalent dans console staminads (sauf calls qui est placeholder V1)
- [ ] Console MCP screenshot des 10 pages sans erreur console
- [ ] Robert ouvre 1 workspace test, voit Score Veridian + Shadow blocks + GSC + Forms — verdict "ça ressemble à mon analytics actuel mais en mieux"
- [ ] CI verte, husky pre-push valide

---

## Référence

- Memory `feedback_no_local_docker_build` — pas de build local
- Memory `project_analytics_engine_dev_env` — flow dev hot-reload
- Ticket parent : [`2026-05-21-features-legacy-to-staminads.md`](./2026-05-21-features-legacy-to-staminads.md)
- UI polish continue : [`UI-POLISH.md`](./UI-POLISH.md)

# [UI-POLISH-TEAM] Giga-ticket polish UI Veridian Analytics — STANDBY

> **Statut** : 🟡 STANDBY — ne PAS démarrer tant que le backend n'est pas "pixel"
> **Déclencheur** : commande `/ui-polish-team` lancée par Robert quand le backend
>   est validé (tous les endpoints stables, tests verts, CI sérieuse, prod déployée)
> **Repo cible** : `veridian-analytics-engine/console`
> **Mode d'exécution** : TEAM d'agents UI en parallèle (pas 1 agent solo)
> **Charge estimée** : ~40-60h agent réparties sur la team
> **Branche** : chaque agent sur `feat/ui-polish-<domaine>` depuis `staging`

---

## ⛔ PRÉ-REQUIS BLOQUANTS — ne pas démarrer avant que TOUT soit vert

Cette équipe ne démarre QUE lorsque le backend est "pixel perfect". Checklist d'entrée :

- [ ] **Tous les endpoints bridge stables** : score, tenant-status, shadow-marketing,
      GSC, forms, push, hub-contract, voip, settings/credentials — réponses figées,
      plus de breaking change prévu
- [ ] **Tests backend verts** : suite bridge complète (`npm run test:ci`) + tests
      d'intégration réels (T2-T5 contre vrais Postgres/ClickHouse) au vert
- [ ] **CI `Staging CI/CD` verte de bout en bout** : étages 1 (quick-checks, CVE,
      Trivy, tests SDK/API/console/intégration) + 2 (build) + 3 (deploy staging)
- [ ] **CI `Prod CI/CD` opérationnelle** : deploy prod + smoke + rollback auto câblés
- [ ] **Husky pre-push ultra-strict actif** et respecté (jamais bypass)
- [ ] **Prod déployée** : `staging → main` promu, prod healthy
- [ ] **Démo `demo-analytics.veridian.site`** : HTTPS valide + données visibles
- [ ] **Schémas Prisma figés** : plus de migration structurelle prévue
- [ ] **Contrats API documentés** : types de retour de chaque endpoint stables et
      reflétés dans `console/src/veridian/types.ts`

Si un seul point n'est pas vert → la team UI ne démarre pas. Robert tranche.

---

## 🎯 OBJECTIF

Transformer l'UI Veridian (fonctionnelle mais "v1") en une UI **production-grade,
esthétique, cohérente, accessible, performante** — au niveau Linear / Vercel /
Stripe / Plausible. Aujourd'hui les composants existent et marchent, mais :
manque de polish visuel, incohérences de spacing/typo, états limites bâclés,
pas d'audit accessibilité, pas de tests E2E visuels, animations absentes ou
gratuites, responsive perfectible.

**Robert ouvre l'app sur son téléphone et sur desktop → effet "wow", rien à redire.**

---

## 📦 ÉTAT EXISTANT (point de départ — vérifié dans `origin/staging` 2026-05-22)

Stack console : **React 19 + TanStack Router 1.14 + TanStack Query 5 + AntD 6 +
Tailwind 4 (`@tailwindcss/vite`) + echarts 6 + lucide-react + CVA + clsx +
tailwind-merge**. Tests : Vitest + Testing Library.

**Pages Veridian déjà livrées** (`console/src/routes/_authenticated/`) :
- `veridian.dashboard.$workspaceId.tsx` — dashboard root
- `veridian.settings.$workspaceId.tsx` — settings tenant
- `veridian.welcome.$workspaceId.tsx` — onboarding wizard

**Composants Veridian** (`console/src/veridian/`) :
- `service-score-block.tsx`, `shadow-marketing-block.tsx`, `locked-service-page.tsx`,
  `sparkline.tsx`, `impersonation-banner.tsx`, `demo-banner.tsx`, `demo-footer.tsx`,
  `error-pages.tsx`, `auth-shell.tsx`, `pwa-register.tsx`
- `ui/` : `card.tsx`, `button.tsx`, `badge.tsx` (shadcn-like)
- `pages/dashboard.tsx` + `pages/dashboard-tabs/` : `forms-tab.tsx`, `gsc-tab.tsx`,
  `push-tab.tsx`, `calls-tab.tsx` (+ `calls-tab-views.tsx`, `calls-hooks.ts`)
- `pages/settings.tsx`, `pages/welcome.tsx`
- `api.ts` (client fetch bridge), `types.ts`, `theme.css` (scope Tailwind), `utils.ts`
- `screenshots/` : 5 captures dashboard (desktop/mobile/empty/loading/error)

**Architecture validée** : les features Veridian sont intégrées DANS la console
staminads (mêmes routes TanStack, même app, même auth JWT). Pas de tunnel, pas
d'iframe. Composants scopés Tailwind (`theme.css` + `veridian-scope`) pour
cohabiter avec l'AntDesign upstream sans le casser.

---

## 🧩 DÉCOUPAGE EN LOTS (1 agent ou binôme par lot)

### LOT 1 — Design system & fondations visuelles

- [ ] **Design tokens** : auditer `theme.css`, formaliser une palette complète
      (couleurs sémantiques : primary/success/warning/danger/info + neutres 50→950),
      échelle de spacing (4/8/12/16/24/32/48/64), rayons, ombres, z-index
- [ ] **Typographie** : échelle type cohérente (display/h1-h6/body/caption/mono),
      font Inter (ou équivalent) chargée proprement (preload, font-display:swap),
      line-height + letter-spacing par niveau
- [ ] **Dark mode** : si pas déjà géré, le câbler proprement (toutes les surfaces
      Veridian), toggle, persistance, respect `prefers-color-scheme`
- [ ] **Primitives UI** : compléter `ui/` — ajouter au besoin `input`, `select`,
      `tooltip`, `dialog/modal`, `tabs`, `skeleton`, `toast`, `dropdown`, `switch`,
      `table` cohérents (shadcn-like, CVA pour les variants)
- [ ] **Icônes** : convention unique (lucide-react), tailles standardisées
- [ ] **Cohérence avec AntD upstream** : s'assurer que le scope `veridian-scope`
      isole bien, que Tailwind preflight ne pourrit pas AntD, et inversement
- [ ] Documenter le design system dans `console/src/veridian/DESIGN-SYSTEM.md`

### LOT 2 — Dashboard root + score hero

- [ ] **Score Veridian** = hero de la page : grand, lisible, jauge/progress
      visuelle évidente, animation d'apparition du chiffre (count-up)
- [ ] **Section services actifs** : cards homogènes, sparklines soignées
      (couleurs, courbes lissées, tooltip au survol), états de chargement
- [ ] **Section "Boostez vos résultats"** (shadow marketing) : cards qui donnent
      envie de cliquer — gradient subtil, hover qui réveille, CTA contrasté,
      `mailto:` pré-rempli correct (`{{domain}}` substitué)
- [ ] **Header tenant** : nom, slug, status (badge), bouton "Voir le site"
- [ ] **Layout responsive** : grid desktop → stack mobile, breakpoints propres
- [ ] **Skeleton loaders** : shimmer cohérent, pas de spinner
- [ ] **Error state** : bienveillant, retry fonctionnel, pas de page rouge
- [ ] **Empty state** (workspace vierge) : message d'accueil + CTA installer tracker
- [ ] **Animations** : fade-in/stagger des cards à l'entrée, hover scale subtil,
      AUCUNE animation gratuite

### LOT 3 — Les 4 tabs (Forms / GSC / Push / Calls)

Pour CHAQUE tab, même niveau d'exigence :
- [ ] **Forms tab** : table submissions soignée, filtres, pagination, détail lead,
      stats en tête, graphe, états loading/error/empty
- [ ] **GSC tab** : top queries / top pages, graphe clics-impressions-CTR-position,
      sélecteur de période, état "Search Console pas connecté" avec CTA
- [ ] **Push tab** : liste subscribers, historique notifs, formulaire d'envoi,
      stats succès/échec, état "pas d'abonnés"
- [ ] **Calls tab** : table appels, stats (total/manqués/durée moy/taux réponse),
      graphe appels/jour, lecteur d'enregistrement, état "VoIP pas branché" → CTA Settings
- [ ] **Barre de tabs** : cohérente, responsive (scroll horizontal mobile),
      indicateur actif, ordre logique, deep-linkable (URL par tab)
- [ ] **Cohérence inter-tabs** : mêmes patterns de table, mêmes filtres, mêmes
      empty/loading/error states partout

### LOT 4 — Settings + onboarding wizard

- [ ] **Page Settings** : les 5 sections (Compte / Site & tracking / GSC / VoIP /
      Notifications) — formulaires soignés, validation inline, feedback de sauvegarde,
      états des credentials (connecté/pas connecté), masquage des secrets `••••`,
      bouton "Tester la connexion" avec feedback
- [ ] **Onboarding wizard** (`welcome.tsx`) : parcours fluide multi-étapes,
      progress indicator, check-tracker en temps réel, transitions soignées,
      CTA clairs, ne jamais bloquer l'utilisateur
- [ ] **Snippet tracker** : bloc de code avec syntax highlight, bouton copier + toast

### LOT 5 — Auth, pages système & branding

- [ ] **Login** : brandé Veridian (logo, couleurs) sur instance Veridian,
      layout centré soigné, gestion d'erreur claire
- [ ] **Forgot / reset password** : cohérents avec login
- [ ] **Page 404 / 500 / erreur** : brandées Veridian, tone bienveillant, CTA retour
- [ ] **`no-access` / invite** : soignées
- [ ] **auth-shell** : layout commun des pages non authentifiées
- [ ] **Impersonation banner** : visible et claire quand un admin impersonne
- [ ] **Branding global** : logo, favicon, meta, titre — cohérents partout,
      conditionnels `IS_DEMO` pour la démo publique
- [ ] **Demo banner + footer** : soignés (la démo publique doit donner envie de signer)

### LOT 6 — Navigation & intégration dans la console staminads

- [ ] **Liens Veridian dans la nav staminads** : les routes `veridian.*` doivent
      être accessibles depuis le menu, à un endroit naturel, sans casser la nav AntD
- [ ] **Cohérence visuelle** entre les pages Veridian (Tailwind) et la coquille
      staminads (AntD) — transitions douces, pas de rupture brutale de style
- [ ] **Breadcrumbs / fil d'ariane** si pertinent
- [ ] **Sélecteur de workspace** : cohérent avec les pages Veridian

### LOT 7 — Responsive & mobile

- [ ] **Audit mobile complet** : chaque page Veridian testée 375px / 768px / 1024px / 1440px
- [ ] **Touch targets** ≥ 44px, pas de hover-only sur mobile
- [ ] **Tables** → cartes ou scroll horizontal propre sur mobile
- [ ] **Graphes echarts** : responsive, lisibles sur petit écran
- [ ] **Modales / drawers** : full-screen mobile
- [ ] **PWA** : `pwa-register.tsx` — install prompt soigné, manifeste, icônes,
      splash screen, comportement offline gracieux

### LOT 8 — Accessibilité (WCAG 2.1 AA)

- [ ] **Contraste** : tous les textes ≥ AA (4.5:1 / 3:1 large)
- [ ] **Navigation clavier** : tous les interactifs atteignables, focus visible,
      ordre de tab logique, pas de piège au clavier
- [ ] **ARIA** : rôles, labels, `aria-live` pour les états dynamiques (toasts,
      chargements), `alt` sur toutes les images
- [ ] **Heading order** : hiérarchie h1→h6 correcte par page
- [ ] **Formulaires** : labels associés, messages d'erreur liés, `aria-invalid`
- [ ] **Reduced motion** : respecter `prefers-reduced-motion`
- [ ] **Lecteur d'écran** : smoke test des parcours clés

### LOT 9 — Performance UI

- [ ] **Lighthouse** : viser ≥ 90 sur Performance / Accessibility / Best Practices / SEO
      pour les pages Veridian (et la démo publique)
- [ ] **Bundle** : code-splitting par route, lazy-load des tabs et des graphes echarts,
      analyse du bundle, pas de dépendance lourde inutile
- [ ] **Images** : WebP, dimensions explicites, lazy-load, preload du critique
- [ ] **Fetch** : les appels bridge en parallèle (`Promise.all`), cache TanStack Query
      bien configuré (staleTime, gcTime), pas de waterfall
- [ ] **Pas de layout shift** (CLS) : skeletons aux bonnes dimensions
- [ ] **Cold start** perçu : first meaningful paint rapide

### LOT 10 — Tests UI & qualité

- [ ] **Tests unitaires Vitest + RTL** : compléter la couverture de chaque
      composant et page (états loading/data/error/empty), viser une couverture
      sérieuse, pas du test cosmétique
- [ ] **Tests E2E Playwright** : parcours complets — login → dashboard → chaque tab,
      onboarding wizard de bout en bout, settings + test connexion, flow démo
- [ ] **Tests de régression visuelle** : screenshots de référence (Playwright
      snapshots) pour les pages clés, desktop + mobile
- [ ] **`test-coverage-map.yaml`** à jour pour tout le nouveau code UI
- [ ] **CI** : les tests UI (Vitest + Playwright) intégrés à `Staging CI/CD`,
      bloquants. Un gate visuel si pertinent.
- [ ] **Husky pre-push** : respecté, jamais bypass

### LOT 11 — Audit visuel Chrome MCP & itération

- [ ] Chaque agent qui livre une page DOIT l'auditer dans Chrome MCP :
      screenshots desktop + mobile, console JS clean (0 erreur), network sain
- [ ] **Itérer** : pas la v1 qui sort — 3-4 passes sur l'esthétique
- [ ] Mettre à jour `console/src/veridian/pages/screenshots/` avec les captures finales
- [ ] Audit final croisé : un agent relit l'ensemble pour la cohérence globale

### LOT 12 — Polish transverse & détails

- [ ] **Micro-interactions** : hovers, focus, transitions, feedback de clic —
      cohérents et subtils partout
- [ ] **Toasts / notifications** : système unifié, positionnement, durée, stacking
- [ ] **États de chargement** : cohérents (skeleton partout, jamais de spinner nu)
- [ ] **Copy / wording** : français correct, ton Veridian, pas de jargon, pas de
      "Lorem ipsum" résiduel, messages d'erreur utiles
- [ ] **Empty states** : illustrés, encourageants, avec CTA — sur toutes les pages
- [ ] **Favicon, meta, OpenGraph, titre d'onglet** : corrects et cohérents
- [ ] **Détails** : alignements pixel, pas de scrollbar parasite, pas de débordement,
      pas de FOUC, pas de flash de thème

---

## 🤝 COORDINATION DE LA TEAM

- **1 agent (ou binôme) par lot**, worktree isolé, branche `feat/ui-polish-<lot>`
- **LOT 1 (design system) en premier** — les autres lots en dépendent. Les lots
  2-12 démarrent une fois LOT 1 mergé (les tokens/primitives sont la fondation).
- **Lots 2-9** parallélisables après LOT 1.
- **LOT 10 (tests)** et **LOT 11 (audit Chrome MCP)** : en continu + passe finale.
- **LOT 12 (polish transverse)** : passe finale après que les lots de pages sont livrés.
- Chaque agent : Opus, worktree isolé, **ZÉRO build local** (CI ou dev-pub),
  Husky jamais bypass, merge sur `staging` après CI verte.
- Éviter les conflits : chaque lot touche des fichiers distincts. Le `dashboard.tsx`
  et la nav sont des zones partagées → coordonner (lot 6 pilote la nav).

---

## ✅ DÉFINITION DE "TERMINÉ" (la team ne s'arrête pas avant)

- [ ] Design system documenté et appliqué partout
- [ ] Les 3 pages + 4 tabs + settings + wizard + pages auth/erreur = polish production-grade
- [ ] Dark mode complet et cohérent
- [ ] Responsive validé 375 → 1440px sur toutes les pages
- [ ] WCAG 2.1 AA respecté (contraste, clavier, ARIA, reduced-motion)
- [ ] Lighthouse ≥ 90 sur les 4 axes pour les pages Veridian
- [ ] Tests Vitest + Playwright verts, intégrés à la CI, bloquants
- [ ] Régression visuelle en place
- [ ] Audit Chrome MCP fait, screenshots finaux committés
- [ ] 0 erreur console JS, 0 layout shift, 0 FOUC
- [ ] Robert ouvre l'app desktop + mobile → "wow", rien à redire

---

## 📌 RÈGLES NON NÉGOCIABLES (rappel)

1. **STANDBY** — ne démarrer que quand les pré-requis backend sont TOUS verts
2. **ZÉRO build local** — tout sur dev-pub ou CI (cf memory `feedback_no_local_docker_build`)
3. **Sous-agents en Opus** uniquement (cf memory `feedback_subagents_opus_only`)
4. **Husky pre-push jamais bypass**
5. **Ne pas casser l'AntD upstream** — scope Tailwind strict
6. **Ne pas toucher au backend** — ce ticket est UI pure ; si un besoin backend
   émerge, créer un ticket séparé, ne pas le faire dans ce lot
7. **Trunk-based** : merge sur `staging`, pas de branche feature longue durée

---

## Status

🟡 STANDBY — en attente de la validation backend par Robert (`/ui-polish-team`)

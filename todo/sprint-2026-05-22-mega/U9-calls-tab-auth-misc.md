# [U9] Tab Calls + flow auth + pages manquantes console

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche** : `feat/U9-calls-auth` depuis `staging`
> **Charge** : 6h
> **Dépend de** : B-VOIP (endpoint `/api/admin/tenant/:wsId/calls`) — stub propre si pas livré

---

## But

Compléter les pages console qui manquent au giga ticket UI initial : le tab Calls
(VoIP), le flow login/welcome, et la page Settings est traitée séparément (U8).

## 1. Tab Calls / VoIP

`console/src/veridian/pages/dashboard-tabs/calls-tab.tsx`

- Consomme `GET /api/admin/tenant/:wsId/calls?days=30` (livré par B-VOIP)
- Table des appels : date, direction (entrant/sortant), numéro, durée, statut, lien enregistrement
- Stats en haut : total appels, appels manqués, durée moyenne, taux de réponse
- Graphe appels par jour
- Si le tenant n'a pas branché de VoIP → état "Connectez votre téléphonie"
  + CTA vers Settings (U8)
- Si VoIP branché mais 0 appel → empty state
- États loading / error
- Hook `useCalls(wsId, days)`

## 2. Flow auth — login / welcome

La console staminads upstream a déjà son auth (JWT). À vérifier / habiller :
- Page login : s'assurer qu'elle est brandée Veridian (logo, couleurs) quand on
  est sur une instance Veridian
- Lien vers `/welcome` (le wizard onboarding U4) après premier login
- Page "mot de passe oublié" si pas déjà gérée par staminads

## 3. Intégration des 4 tabs dans le dashboard

Le `dashboard.tsx` actuel a des tabs. Vérifier que les 4 tabs réels
(GSC=U1, Forms=U2, Push=U3, Calls=U9) + le tab Settings (U8) sont tous
correctement montés dans la navigation, ordre logique, responsive.

## 4. Page 404 / erreurs brandées Veridian

Page 404 et page d'erreur génériques, tone Veridian (pas le 404 staminads brut).

## Tests
- Vitest pour calls-tab + les pages auth habillées

## Coordination
- U1/U2/U3 livrent leurs tabs en parallèle — U9 ajoute le 4e (Calls) + assure
  la cohérence de la barre de tabs
- U6 (polish) passera après pour l'harmonisation visuelle finale

## Status
✅ livré — 2026-05-22 — SHA staging `6e24085` (repo veridian-analytics-engine)

### Livré
- **Tab Calls VoIP** (vraie page, pas un stub) :
  `console/src/veridian/pages/dashboard-tabs/calls-tab.tsx` (orchestrateur)
  + `calls-tab-views.tsx` (vues : stats / graphe appels-jour / table /
  états not-connected / empty / error / skeleton) + `calls-hooks.ts`
  (hook `useCalls(wsId, days)` + formatters `formatDuration` /
  `formatCallDate`). Consomme `GET /api/admin/tenant/:wsId/calls?days=30`.
  Le 404 « endpoint B-VOIP pas encore livré » est traité comme l'état
  « Connectez votre téléphonie » (CTA), jamais une erreur rouge.
  → B-VOIP a livré son endpoint le même jour (`0eca29e`) : contrat
  `CallsResponse` aligné au pixel (vérifié contre `voip/query.ts`).
- **Flow auth brandé Veridian** : `console/src/veridian/auth-shell.tsx`
  centralise le branding (logo Veridian vs Staminads selon `isDemo`) ;
  `login.tsx` / `forgot-password.tsx` / `reset-password.$token.tsx`
  refactorés sur `AuthShell` + i18n FR. Avant : forgot/reset affichaient
  le logo Staminads en dur même sur instance Veridian.
- **Pages 404 + erreur brandées** : `console/src/veridian/error-pages.tsx`
  (FR) branchées sur `__root.tsx` (`notFoundComponent` / `errorComponent`)
  + `router.tsx` (`defaultNotFoundComponent`).
- **Intégration tabs** : 4e tab « Appels » monté dans `dashboard.tsx`
  (ordre : Vue d'ensemble / Formulaires / Search Console / Appels /
  Notifications). U8 livre Settings en route séparée, pas en tab.
- **CI** : nouveau job `console-checks` (Vitest `console/src/veridian`)
  dans `dev-checks.yml` + `staging-deploy.yml` — les suites console
  n'étaient validées que par le pre-push local, jamais en CI.
- **Tests Vitest** : `calls-tab.test.tsx` (12 cas), `auth-shell.test.tsx`,
  `error-pages.test.tsx`. `test-coverage-map.yaml` étendu.

### CI
Toutes les étapes code-pertinentes vertes sur `staging` : `Étage 1.g —
Tests console Veridian (Vitest)` (nouveau job U9) et `Étage 2 — Build
images` passent dans 100 % des runs. Seul `Étage 3 — Deploy staging`
est régulièrement annulé par le `concurrency: cancel-in-progress` — les
agents du giga-sprint poussent sur `staging` plus vite qu'un deploy ne
dure (~18 min). Ce n'est PAS un défaut U9 : l'agent INFRA durcit le
pipeline de deploy en parallèle (`84c2000`, `1c716c6`, `7f5dcdf`). Le
deploy se posera automatiquement une fois la rafale de pushes calmée.

### Friction / à noter
- Gap pre-push : le hook ne relance pas `prisma generate` quand
  `node_modules` du bridge existe déjà mais que le schéma a changé
  (rebase). Rencontré post-rebase sur les modèles `TenantSettings`/
  `TenantCredential` de U8 — contourné par `npm run prisma:generate`
  manuel. La CI fait `npm ci` frais → pas affectée. À durcir côté INFRA.

---

## Update 2026-05-23 — UI-POLISH-CORE : tab → sous-route native

PR #4 mergée sur `staging` puis `main` (SHA `c3ec010`).

Le tab Calls du dashboard custom Veridian a été promu **sous-route native
staminads** à `/workspaces/$wsId/calls` :

- Fichier : `console/src/routes/_authenticated/workspaces/$workspaceId/calls.tsx`
- Réutilise `CallsTab` existant + `calls-hooks.ts` + `calls-tab-views.tsx`
  (toujours en place sous `console/src/veridian/pages/dashboard-tabs/`,
  importés par la nouvelle route)
- Header natif : titre « Appels », sous-titre site domain, scope
  `.veridian-scope` pour le thème dark
- CTA "Configurer la téléphonie" route vers
  `/workspaces/$wsId/settings?section=integrations`
- Tous les états (loading/error/not-connected/empty/data) hérités du
  composant existant
- Lien "Appels" ajouté dans la nav staminads (desktop + mobile)

Le dashboard custom Veridian (`/workspaces/$wsId/veridian`) reste
accessible pour l'instant — le **cleanup-veridian-scope** le retirera
quand prêt.

Audit Chrome MCP : OK, état not-connected affiché correctement sur
`https://demo-analytics.veridian.site/workspaces/demo-apple/calls`.
Pas d'erreur console (toutes les erreurs viennent de l'extension Chrome
MCP).

---

## ⚠️ Mise à jour 2026-05-24 — Section UI obsolète

Depuis `refactor/ui-native-pure` (SHA `43aa4d4`, 2026-05-23) :
- Les sous-routes dédiées `/workspaces/$wsId/calls` et `/workspaces/$wsId/search-console` ont été **supprimées**
- Les features VoIP et GSC vivent maintenant **dans Settings** (`?section=voip` et `?section=search-console`)
- Le lien nav "Appels" et "Search Console" a été retiré
- Les appels VoIP sont poussés comme events staminads natifs `phone_call` → apparaissent dans Live/Explore/Goals automatiquement

Donc toute la section "UI" de ce ticket décrit l'ancienne archi (page dédiée). La **partie bridge / endpoints** reste valable et est livrée. Voir aussi :
- `todo/2026-05-24-explore-event-name-phone-call.md`
- `todo/2026-05-24-gsc-disconnect-endpoints-bridge.md`
- `todo/2026-05-24-verify-voip-events-in-live-explore.md`
- `CLAUDE.md` section "Règle d'architecture UI (figée 2026-05-23)"

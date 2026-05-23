# [BUG-03] Page /goals affiche une page blanche (zéro contenu rendu)

> **Status** : ✅ FIXED (2026-05-23, SHA c54cd94 → merged main 703e99e)
> **Sévérité** : 🔴 P0 (feature complètement morte sur la démo publique)
> **Cible** : démo prod (probablement aussi staging et engine prod)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/goals
> **Détecté** : 2026-05-23

## Résolution

Cause racine : `TypeError: t.toFixed is not a function` dans GoalCard.tsx
ligne 273 (`data.current.toFixed(2)` pour conversion_rate). Goals.tsx
faisait `row.goals as number` — assertion TS mensongère, zéro coerce
runtime. ClickHouse sérialise les agrégats en STRING dans le JSON.
La string atteignait GoalCard et plantait.

Le bug-hunter a interprété la page comme "blanche" — en réalité l'errorComponent du root rendait un Result Ant Design minuscule
("Une erreur est survenue / t.toFixed is not a function / Retour au
dashboard") = bodyLen 124. Pas un blank, mais visuellement équivalent.

Même pattern que `cb02c61` (fix dashboard via toMetricNumber dans
`dimension-utils.ts`) mais oublié sur la route Goals.

### Fix

- `toMetricNumber()` **exporté** depuis `console/src/lib/dimension-utils.ts`
- `goals.tsx` : 16 sites de coerce via `toMetricNumber()` (summary, time-series,
  previous map, conversion rate, sessions)
- `GoalCard.tsx` : defensive `Number(data.current) || 0` avant `.toFixed`
- E2E `tests/e2e/11-demo-public/demo-workspace-pages-not-blank.spec.ts` :
  vérifie qu'au moins un heading rend sur chaque sous-page workspace de la
  démo (régression future)

### Vérification prod (Chrome MCP)

`demo-analytics.veridian.site/workspaces/demo-apple/goals` rend :
- H1 "Goals" + DateRangePicker + ComparisonPicker
- 3 goals (`add_to_cart`, `checkout_start`, `purchase`) avec Count,
  Conv. Rate, Value, Median + sparklines
- bodyLen 650 (vs 124 avant) ; 0 erreur toFixed console.
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Cliquer sur "Goals" dans la nav
> 3. La page est vide — pas de heading, pas de table de goals, juste le banner démo en haut et le footer en bas

## Symptôme observé

Inspection DOM via `document.body.innerText.length` → **124 caractères** (uniquement banner
+ footer). Aucun `<h1>`/`<h2>`/`<h3>`. Aucun message d'erreur visible. Page blanche complète
entre la nav et le footer.

```js
({ url: location.href, h: Array.from(document.querySelectorAll('h1,h2,h3')).map(el=>el.innerText), bodyLen: document.body.innerText.length, rootChildCount: document.querySelectorAll('#root *').length })
// → { url: "/workspaces/demo-apple/goals", h: [], bodyLen: 124, rootChildCount: 13 }
```

À comparer avec :
- `/dashboard` → bodyLen ~3000+, 1 h1, plein de h3
- `/explore` → bodyLen ~1400, 11 headings (Explore, Ask AI, Custom report, ...)
- `/live` → bodyLen 1128, 6 headings (Top Pages, Top Cities, ...)
- `/annotations` → bodyLen 539, 1 heading (Annotations)
- **`/goals` → bodyLen 124, 0 heading ← BUG**

## Comportement attendu

D'après le dashboard, le workspace demo-apple a des goals (`add_to_cart`, `checkout_start`,
`purchase`). La page `/goals` devrait donc lister ces goals avec leur compteur, leur valeur,
et permettre de naviguer dans le détail.

Au minimum : afficher un H1 "Goals" + état vide propre s'il n'y en a pas.

## Console JS

Pas d'erreur applicative (toutes les erreurs sont chrome-extension noise).

## Network

```
GET /api/workspaces.get?id=demo-apple             → 200
GET /api/filters.backfillSummary?workspace_id=...  → 200
POST /api/analytics.query (x10)                    → 200
```

Les API répondent OK. Le composant goals échoue silencieusement à rendre quelque chose
malgré les données disponibles.

## Hypothèse cause

3 pistes (à investiguer côté code) :
1. **Composant React qui throw silencieusement** mais sans error boundary visible → React
   monte un fragment vide. Vérifier que la route `/goals` a bien un composant exporté et
   importé dans le router.
2. **Route absente du routeur** → fallback affiche un fragment vide. Vérifier
   `apps/web/src/router/*` ou équivalent : la route `/workspaces/:wsId/goals` est-elle
   déclarée ?
3. **Composant porté du legacy mais non câblé** → dans le sprint mega, l'UI a été portée
   par morceaux ; `/goals` est peut-être en "à porter".

Même symptôme observé sur `/filters` (bodyLen 240, 0 heading) et `/settings` (bodyLen 240,
0 heading) → cf BUG-04, BUG-05. C'est peut-être un **pattern systémique** : toutes les
sous-pages workspace autres que dashboard/explore/live/annotations sont blanches.

## Suggestion fix

1. **Diagnostic** : inspecter `apps/web/src/routes` (ou équivalent), grep `goals` :
   ```bash
   rg -i 'goals|Goal' apps/web/src/router* apps/web/src/routes*
   ```
   Y a-t-il une route déclarée ? Le composant existe-t-il et est-il importé ?
2. **Si route absente** : la déclarer + importer le composant `<GoalsPage />`
3. **Si composant existe mais throw** : ajouter une `ErrorBoundary` autour des routes
   workspace + un fallback visible ("Une erreur est survenue, [Réessayer]")
4. **Test de régression** : `tests/e2e/workspace-pages-not-blank.spec.ts` qui visite
   /goals, /filters, /settings, /annotations, /explore, /live et assert
   `await expect(page.locator('h1, h2, h3')).toHaveCount({greaterThanOrEqual: 1})`

## Status

✅ FIXÉ 2026-05-23 par agent fix-blank-pages (PR #3 — commit `c54cd94` embarqué dans merge `703e99e`).

**Cause** : `TypeError: t.toFixed is not a function` — `row.goals as number` mensonger dans `goals.tsx`, ClickHouse renvoie en string, crash dans `GoalCard` ligne 273 → AppErrorPage (mini-rendu, pas un vrai blank).

**Fix** : `toMetricNumber()` exporté depuis `console/src/lib/dimension-utils.ts`, 16 sites coercés via `toMetricNumber()` dans `goals.tsx`, defensive `Number(data.current) || 0` dans `GoalCard`. Test E2E garde-fou ajouté `tests/e2e/11-demo-public/demo-workspace-pages-not-blank.spec.ts`.

**Vérif live démo prod 2026-05-23** : `/workspaces/demo-apple/goals` → H1 "Objectifs" + 3 goal cards rendus.

# [BUG-20] Cold load : page affiche "Loading..." puis flash "Staminads" puis enfin "Veridian Analytics" (FOUC + branding flash)

> **Sévérité** : 🟡 P1 (perçu cassé / non-pro pour quelqu'un qui découvre Veridian via la démo)
> **Cible** : démo prod + engine prod
> **URL exacte** : https://demo-analytics.veridian.site/
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Vider le cache navigateur ou ouvrir en incognito
> 2. Naviguer vers https://demo-analytics.veridian.site/
> 3. Observer pendant ~2 secondes :
>    - Onglet : "Staminads" (depuis HTML statique)
>    - Page : "Loading..."
>    - Puis JS s'exécute, onglet devient "Veridian Analytics — Démo publique", page devient
>      la landing démo

## Symptôme observé

Phase 1 (HTML cru) :
```html
<title>Staminads</title>
<div id="root"></div>
<!-- juste "Loading..." comme fallback -->
```
Onglet navigateur affiche : **"Staminads"**.

Phase 2 (après hydration React) :
- Title devient "Veridian Analytics — Démo publique"
- Contenu landing apparaît
- Banner FR apparaît

Délai entre phases : ~1-2 secondes selon réseau (testé sur fibre, prod CDN OK).

## Impact

1. **Branding flash** : pendant 1-2s, l'utilisateur voit "Staminads" → impression que c'est
   un produit OEM mal rebrandé
2. **FOUC** : "Loading..." cru en plein milieu, sans logo, sans branding → impression de bug
3. **SEO** : crawlers non-JS voient "Staminads" comme title

## Comportement attendu

Phase 1 (HTML cru) doit déjà être :
- Title "Veridian Analytics"
- Skeleton ou splash branded "Veridian" (logo SVG inline + couleur de fond cohérente)
- Pas de "Loading..." nu

Idéalement : SSR/SSG de la landing pour avoir un FCP < 1s avec contenu déjà visible.

## Suggestion fix

1. **Quick win** : éditer `apps/web/index.html` :
   ```html
   <title>Veridian Analytics</title>
   <body>
     <div id="root">
       <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0e7e5d">
         <img src="/veridian-logo.svg" alt="Veridian Analytics" width="120">
       </div>
     </div>
   </body>
   ```
   → splash branded pendant le bootstrap JS
2. **Mieux** : SSR la landing démo (Vite SSR ou prerender plugin) → HTML déjà rempli au
   premier paint, pas de "Loading...", pas de flash
3. **Test** : Lighthouse perf + FCP ; viser FCP < 1.5s sur mobile 4G

## Lié

- BUG-08 (title "Staminads" hard-coded)
- BUG-09 (alt="Staminads" sur les logos)
- BUG-10 (links staminads.com)
- BUG-13 (version v6.1.0)

Tous les 4 sont la même nature : fork upstream pas finalisé côté branding.


## Status

FIXED 2026-05-23 par PR #1 fix/upstream-branding-cleanup (commit 9e0d123, merge staging 23f6edf, main 703e99e).

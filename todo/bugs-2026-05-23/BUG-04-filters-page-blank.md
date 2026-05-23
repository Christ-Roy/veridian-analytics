# [BUG-04] Page /filters affiche une page blanche

> **Sévérité** : 🔴 P0 (feature morte)
> **Cible** : démo prod (à vérifier sur engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/filters
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Cliquer sur "Filters" dans la nav
> 3. Page vide — banner + footer uniquement, rien au milieu

## Symptôme observé

```js
({ url: location.href, h: [...querySelectorAll('h1,h2,h3')].map(el=>el.innerText), bodyLen: document.body.innerText.length })
// → { url: "/workspaces/demo-apple/filters", h: [], bodyLen: 240 }
```

`bodyLen: 240` = juste banner démo "Vous regardez la démo publique..." + footer "Hébergé en
France · Pas de cookies tiers · ...". Aucun heading. Composant Filters non rendu.

## Comportement attendu

Page liste les filtres custom + bouton "Créer un filtre". Sur la démo, soit lister quelques
filtres demo, soit afficher état vide "Aucun filtre configuré" + CTA.

## Hypothèse cause

Même cause probable que BUG-03 (Goals) et BUG-05 (Settings) — route absente du router ou
composant non importé/cassé. Pattern systémique sur les sous-pages workspace porteurs de
features moins triviales que dashboard/explore/live.

## Suggestion fix

Voir BUG-03. Même test de régression à ajouter, même investigation router/components.

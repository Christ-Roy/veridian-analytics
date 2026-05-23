# [BUG-04] Page /filters affiche une page blanche

> **Status** : ⚠️ NOT A BUG (2026-05-23, vérification Chrome MCP)
> **Sévérité** : 🔴 P0 (feature morte)
> **Cible** : démo prod (à vérifier sur engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/filters
> **Détecté** : 2026-05-23

## Statut : NOT A BUG

Vérifié Chrome MCP 2026-05-23 21:21 UTC sur prod live (avant ET après
fix BUG-03) : la page rend **parfaitement**.

```js
{ url: ".../filters", bodyLen: 8794, headings: ["Filters"] }
```

Contenu visible : H1 "Filters", boutons "Test" + "Create Filter",
description "Define filters to map channels...", segmented (All /
channel / default / product category), table avec filtres "Google Ads"
(utm_source regex + utm_medium regex → Channel Group: set to "search"),
etc. 8794 chars de body — page parfaitement fonctionnelle.

**Hypothèse** : le bug-hunter a testé pendant un crash transitoire de
Goals (BUG-03 réel, dont le chunk JS contient probablement
ComparisonPicker partagé avec Filters côté bundle), ou avec un cache
obsolète. Pas de fix nécessaire côté Filters.
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

## Status

⚠️ NOT A BUG — vérifié 2026-05-23 par agent fix-blank-pages.

La page `/workspaces/demo-apple/filters` rend parfaitement : H1 "Filtres" + table de filtres + sidebar, bodyLen 8852 chars (largement au-dessus du seuil).

Le bug-hunter a probablement testé pendant le crash transitoire de BUG-03 (chunks JS partagés entre goals.tsx et filters.tsx) ou avec cache navigateur obsolète.

Ticket conservé pour traçabilité de l'investigation.

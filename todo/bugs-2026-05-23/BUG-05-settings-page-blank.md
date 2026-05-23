# [BUG-05] Page /settings affiche une page blanche

> **Sévérité** : 🔴 P0 (impossibilité de configurer un workspace)
> **Cible** : démo prod (à vérifier sur engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/settings?section=workspace
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Cliquer sur "Settings" dans la nav
> 3. Page vide — banner + footer uniquement

## Symptôme observé

```js
// → { url: "/workspaces/demo-apple/settings?section=workspace", h: [], bodyLen: 240 }
```

Même symptôme que BUG-03 et BUG-04 : zéro contenu rendu, juste le chrome de la page.

Notable : l'URL contient bien `?section=workspace` (query string géré par le router) mais
le composant Settings ne monte rien. Hypothèse : la route existe mais le composant des
sections (Workspace / Members / Goals / Funnels / API Keys / Domains / etc.) n'est pas
porté/importé.

## Comportement attendu

Sur tenant client réel : afficher le formulaire de configuration du workspace (domaine,
timezone, exclusions, etc.) + sous-menu de sections.

Sur démo publique : afficher la même UI en mode lecture seule, avec inputs `disabled`.

## Hypothèse cause

Idem BUG-03/BUG-04 + spécificité : `/settings` est probablement la page la plus touchée
par le port staminads → Veridian car elle contient les onglets custom (credentials API,
tokens GSC, etc., cf ticket U8-settings-credentials.md). Le composant a peut-être été
porté à moitié.

## Suggestion fix

Voir BUG-03. Spécifiquement sur Settings :
- Vérifier que le composant `<SettingsPage />` est bien monté pour la route
  `/workspaces/:wsId/settings`
- Vérifier que les sub-routes (`?section=workspace`, `?section=members`, etc.) sont
  bien gérées côté composant
- Coordonner avec le ticket sprint `U8-settings-credentials.md`

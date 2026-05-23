# [BUG-09] Logo dans la nav a `alt="Staminads"` au lieu de Veridian

> **Sévérité** : 🔴 P0 (branding cassé, lu par les screen readers — accessibilité)
> **Cible** : démo prod + démo staging + engine prod + engine staging
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir le dashboard d'un workspace
> 2. Inspecter le logo en haut à gauche dans la nav
> 3. `<img alt="Staminads" ... />`

## Symptôme observé

Dans le DOM de la nav (via `read_page` tabId 1647156418) :
```
image "Staminads" [ref_8]
image "Staminads" [ref_10]
```

Les deux logos (probablement desktop + mobile burger) ont `alt="Staminads"`.

## Comportement attendu

`alt="Veridian Analytics"` (ou `alt="Veridian"`).

Important pour :
- **Screen readers** : un utilisateur aveugle entendra "Staminads" alors qu'il est sur
  "Veridian Analytics" → confusion
- **Image search engines** : Google Image Search indexerait "Staminads" pour ce logo
- **Branding** : juste de la cohérence

## Hypothèse cause

Le composant `<Logo />` (ou `<Brand />`) côté engine n'a pas été modifié au fork.

## Suggestion fix

Grep côté repo engine :
```bash
rg 'alt="Staminads"|alt=\{"Staminads"\}|alt={brand' apps/web/src/
```

Remplacer par `alt="Veridian Analytics"` (en dur, ou via i18n string).

Si le logo en lui-même est encore le SVG staminads, le swap aussi (cf BUG-10 / les
docs staminads links → c'est le même problème de fork pas nettoyé).

**Lié** : BUG-08 (title HTML), BUG-10 (docs/issues links), BUG-13 (version v6.1.0).

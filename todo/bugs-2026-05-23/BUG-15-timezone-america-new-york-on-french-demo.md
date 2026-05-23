# [BUG-15] Timezone "America/New_York" affichée sur la démo "Hébergée en France"

> **Sévérité** : 🟡 P1 (incohérence visible du pitch FR)
> **Cible** : démo prod + démo staging
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple (sidebar Settings dépliée)
> **Détecté** : 2026-05-23

## Symptôme observé

Dans le sidebar `read_page` :
```
generic "Timezone" [ref_44]
generic "America/New_York" [ref_45]
```

Le footer dit pourtant : "Hébergé en France · Pas de cookies tiers · Démo générée à partir
de 200 000 sessions".

Conséquence : si un visiteur français regarde les "Top hours" ou "Traffic by day", les
chiffres sont calés sur le fuseau de NY (-6h vs Paris en été, -5h en hiver) → le pic
d'audience apparaît à des heures qui n'ont pas de sens pour un visiteur FR.

## Comportement attendu

Par défaut sur le workspace `demo-apple` :
- Timezone : `Europe/Paris` (cohérent avec le pitch "Hébergé en France")
- Ou rendre l'option facilement changeable et la mettre dans une langue cohérente

## Hypothèse cause

Le seed du workspace demo-apple a mis `timezone: 'America/New_York'` par défaut (sans
doute parce que c'était le défaut staminads upstream développé aux US).

## Suggestion fix

1. **Court terme** : changer le seed du workspace demo-apple →
   `timezone: 'Europe/Paris'`
2. **Durable** : pour tous les nouveaux workspaces créés via le Hub Veridian, le timezone
   par défaut devrait être `Europe/Paris` (clients FR), avec auto-detection optionnelle
   via la timezone du browser de l'utilisateur lors du premier provisioning

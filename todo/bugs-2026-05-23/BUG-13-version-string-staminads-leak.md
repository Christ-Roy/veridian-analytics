# [BUG-13] Version "v6.1.0" affichée dans le menu — leak de la version upstream staminads

> **Sévérité** : 🟡 P1 (info disclosure mineure + branding upstream pas nettoyé)
> **Cible** : démo prod + engine prod + engine staging
> **URL exacte** : visible dans le menu utilisateur du dashboard
> **Détecté** : 2026-05-23

## Symptôme observé

Dans le menu utilisateur (visible via `read_page`) :
```
generic "v6.1.0" [ref_54]
link "Account" [ref_55] ...
button "Logout" [ref_57]
```

Le `v6.1.0` correspond à la version upstream staminads, affichée sans contexte.

## Risques

1. **Info disclosure** : un attaquant qui voit la version exacte peut chercher des CVE
   ciblées sur staminads v6.1.0
2. **Branding** : un client qui voit `v6.1.0` peut chercher ça sur Google et trouver
   le repo upstream staminads — cassure de l'illusion "Veridian propriétaire"
3. **Confusion produit** : la "version" du produit Veridian n'a pas de raison d'être
   alignée sur la version staminads — Veridian peut être à v0.x alors que l'upstream
   est à v6

## Comportement attendu

Soit :
- **Masquer** complètement le numéro de version dans le menu (le plus simple)
- **Afficher** "Veridian Analytics v$VERIDIAN_VERSION" où la version est celle du fork
  Veridian (ex: `2026.05.23`)

## Suggestion fix

Grep le repo engine sur `v6.1.0` ou `VERSION` :
```bash
rg -i 'v6\.1|version' apps/web/src/ apps/web/package.json
```

Remplacer par une constante dérivée du SHA git ou du package.json fork.

**Lié** : BUG-08, BUG-09, BUG-10 — branding upstream pas nettoyé.


## Status

FIXED 2026-05-23 par PR #1 fix/upstream-branding-cleanup (commit 9e0d123, merge staging 23f6edf, main 703e99e).

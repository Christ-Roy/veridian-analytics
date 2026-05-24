# [BUG-14] Logo Apple chargé depuis apple.com sur la démo publique — fuite IP visiteur + contamination de marque

> **Sévérité** : 🟡 P1 (privacy + branding ; le pitch de Veridian c'est "pas de cookies tiers")
> **Cible** : démo prod + démo staging
> **URL exacte** : https://demo-analytics.veridian.site/workspaces (page de liste) + dashboard demo-apple
> **Détecté** : 2026-05-23

## Symptôme observé

Network requests faites par le navigateur :
```
GET https://www.apple.com/ac/structured-data/images/knowledge_graph_logo.png → 200
```

Cette image est chargée sur :
- La page `/workspaces` (preview du workspace demo-apple)
- Le dashboard `/workspaces/demo-apple` (logo affiché 302x302)

L'image fait 302×302 pixels.

## Problèmes

1. **Privacy** : chaque visiteur de la démo envoie son IP + User-Agent + Referer
   `https://demo-analytics.veridian.site/...` à apple.com. Apple peut tracker qui visite
   la démo Veridian. Pour un produit qui se vante "Pas de cookies tiers · Hébergé en
   France", c'est une contradiction frontale du pitch
2. **Disponibilité** : Apple peut changer l'URL ou rate-limit → image cassée
3. **Branding/légal** : utiliser le logo Apple sans mention claire "Demo factice à but
   illustratif" peut être perçu comme un endorsement. Si Apple s'en rend compte (improbable
   mais possible), takedown trivial
4. **Performance** : DNS lookup + TCP + TLS handshake supplémentaires vers apple.com

## Comportement attendu

Le logo demo-apple doit être :
- **Self-hosté** sur `demo-analytics.veridian.site/assets/demo-apple-logo.png` (ou via le
  proxy favicon interne `/api/tools.favicon?url=...` qui semble exister, mais self-hostée
  serait mieux)
- **Stylisé "fictif"** : un visuel évocateur (genre 🍎 emoji ou un avatar stylisé) sans
  reproduire le logo Apple officiel, idéalement avec un watermark "Demo"
- **Documenté** : si on garde un visuel "Apple-like", ajouter dans le footer une mention
  "Apple est une marque déposée d'Apple Inc. — démo factice à but illustratif"

## Hypothèse cause

Le seed de la DB démo a mis `https://www.apple.com/ac/structured-data/images/knowledge_graph_logo.png`
comme `logo_url` du workspace `demo-apple`. Le frontend l'affiche directement via `<img src>`
sans proxy.

Cf cron `re-seed cron demo` mentionné dans la memory `project_demo_public_veridian.md`.

## Suggestion fix

1. **Court terme** : remplacer dans le seed le `logo_url` par une image self-hostée
   (`/assets/demo-apple-logo.svg` un visuel custom Veridian)
2. **Durable** : proxy via `/api/tools.favicon?url=...` (qui existe déjà), pour TOUS les
   logos workspace, pas que celui-là — empêche de leaker des IPs vers les domaines clients
3. **Validation** : pour les vrais clients, valider l'URL côté serveur (pas localhost, pas
   IP privée, etc.) et proxifier

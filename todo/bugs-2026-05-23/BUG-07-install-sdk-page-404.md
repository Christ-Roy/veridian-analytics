# [BUG-07] Page /install-sdk retourne "Page introuvable" alors qu'elle devrait afficher le snippet

> **Sévérité** : 🔴 P0 (flow d'onboarding cassé — client ne peut pas récupérer son snippet)
> **Cible** : démo prod (probablement engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/install-sdk
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Naviguer vers https://demo-analytics.veridian.site/install-sdk (ou cliquer le lien
>    depuis ailleurs si existant)
> 2. La page affiche "Page introuvable / Cette page n'existe pas ou a été déplacée."

## Symptôme observé

```
Page introuvable
Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse ou revenez à votre dashboard.
[Retour au dashboard]
```

Le router renvoie la page 404. La route `/install-sdk` n'est pas déclarée.

## Comportement attendu

D'après les conventions Veridian (cf `optimize-site` skill + tickets du sprint), la page
`/install-sdk` devrait afficher :
- Le snippet `<script>` à coller dans le `<head>` du site client
- Le bouton "Copier"
- Des instructions claires (où coller, comment tester l'install)
- Doc multi-framework (Next.js, Astro, Shopify, etc.)

C'est un point d'entrée critique pour onboarder un client (Robert envoie le lien après
le provisioning).

## Hypothèse cause

Soit :
1. La route n'a jamais été portée du legacy → manquante dans le router engine
2. La route a été renommée (ex: `/sdk/install` ou `/welcome` ou `/workspaces/:id/install`)
   sans redirect
3. La page existe sous un autre path (ex: la welcome page sur staging engine est
   `/workspaces/:id/welcome` cf tab existante)

Note : sur engine staging, j'ai vu une URL `/workspaces/ui_welcome_804196/welcome` qui
affiche "Démarrage" + "Copier le snippet" → c'est probablement LA page d'install actuelle,
mais elle est scoped workspace.

## Suggestion fix

Options :
1. **Redirect** : `/install-sdk` → `/workspaces/$current/welcome` (best UX, route nommée
   stable pour partage de lien)
2. **Page indépendante** : créer une route `/install-sdk` qui demande "Quel workspace ?"
   et redirige vers la welcome scoped
3. **Décision** : décider d'un chemin canonique et l'utiliser partout (skill
   `analytics-provision` + emails de onboarding + docs Veridian) — actuellement il y a
   confusion entre `/install-sdk`, `/welcome`, `/workspaces/:id/welcome`

## Bonus

Vérifier que la welcome page workspace n'est pas branlante non plus (cf l'onglet
"Démarrage" sur engine staging qui semble OK).

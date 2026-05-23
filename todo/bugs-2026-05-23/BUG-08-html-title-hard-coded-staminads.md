# [BUG-08] Title `<title>Staminads</title>` hard-coded dans index.html — leak de marque au cold load

> **Sévérité** : 🔴 P0 (branding cassé sur chaque cold load, et impacte aussi SEO + partage social + lien externe sur engine prod)
> **Cible** : démo prod + démo staging + engine prod + engine staging
> **URL exacte** : https://demo-analytics.veridian.site/ et toutes les URLs (servent toutes le même index.html SPA)
> **Détecté** : 2026-05-23
> **Reproduction** :
> ```bash
> curl -s https://analytics-engine.app.veridian.site/ | grep -i '<title>'
> # → <title>Staminads</title>
>
> curl -s https://demo-analytics.veridian.site/ | grep -i '<title>'
> # → <title>Staminads</title>
> ```
>
> Dans le navigateur : ouvrir en incognito → pendant les 1-2s de bootstrap JS, l'onglet
> affiche "Staminads". Une fois le JS chargé, le title change pour
> "Veridian Analytics — Démo publique".

## Symptôme observé

Le HTML statique servi à toutes les routes (SPA Vite) contient :
```html
<!doctype html>
<html lang="en">
  <head>
    ...
    <title>Staminads</title>
    ...
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

Conséquences :
1. **Cold load** : l'onglet du navigateur affiche "Staminads" pendant 1-2s
2. **Crawlers SEO non-JS** : Google, Bing voient le title "Staminads" sur toutes les pages
   (sauf si SSR/prerender, ce que je ne vois pas configuré)
3. **Aperçus de lien social** : si quelqu'un partage le lien analytics-engine sans que
   le JS s'exécute (Slack/Discord/Twitter unfurl), c'est "Staminads"
4. **Engine prod /setup** : le formulaire d'admin lit "Welcome to **Staminads**" — branding
   complètement à côté
5. **`<html lang="en">`** alors que le contenu est en français sur la démo → a11y/i18n

## Comportement attendu

```html
<title>Veridian Analytics</title>
<html lang="fr">
<meta name="description" content="...">
<meta property="og:title" content="Veridian Analytics">
<meta property="og:description" content="...">
<meta property="og:image" content="...">
<meta name="twitter:card" content="summary_large_image">
```

Le title runtime-set par React (via react-helmet ou équivalent) est OK pour les
navigateurs JS, mais le default HTML doit être brandé Veridian.

## Hypothèse cause

`apps/web/index.html` (ou équivalent) du fork engine n'a pas été modifié lors du fork
staminads → Veridian. Le title est resté `Staminads` (la valeur upstream).

## Suggestion fix

1. **Modif immédiate** : éditer `apps/web/index.html` (côté repo engine `analytics-engine`,
   pas ce repo legacy `veridian-analytics`) :
   ```html
   <title>Veridian Analytics</title>
   <html lang="fr">
   ```
   + ajouter description + og:* + twitter:card + canonical
2. **Au runtime** : conserver le `<title>` dynamique par page (react-helmet) pour adapter
   "Veridian Analytics — Dashboard demo-apple" vs "Veridian Analytics — Démo publique",
   mais le default HTML doit déjà être Veridian
3. **Tests** : ajouter au smoke E2E un check
   `expect(await page.title()).toContain('Veridian')` SANS attendre le JS (via
   `page.goto(url, {waitUntil: 'commit'})`)
4. **Lié à** : BUG-09 (logo alt), BUG-10 (docs links staminads.com), BUG-13 (version v6.1.0)
   — ces 4 bugs sont la même nature : branding upstream pas nettoyé

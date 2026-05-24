# [BUG-11] analytics-engine.app.veridian.site sert un robots.txt destiné à la démo (mauvais fichier déployé)

> **Sévérité** : 🔴 P0 (SEO + confusion / signe que le déploiement prod est mal aligné)
> **Cible** : engine prod
> **URL exacte** : https://analytics-engine.app.veridian.site/robots.txt
> **Détecté** : 2026-05-23
> **Reproduction** :
> ```bash
> curl -s https://analytics-engine.app.veridian.site/robots.txt
> ```

## Symptôme observé

Le robots.txt servi sur `analytics-engine.app.veridian.site` contient :

```
# Veridian Analytics — public demo (demo-analytics.veridian.site)
#
# The landing page is indexable so the demo is discoverable, but the
# workspace dashboards expose generated/fictional dates we don't want
# polluting search results. The internal/staging consoles are behind auth
# and Tailscale respectively, so this file is harmless there.

User-agent: *
Allow: /$
Disallow: /workspaces
Disallow: /api/
Disallow: /login
Disallow: /setup

Sitemap: https://demo-analytics.veridian.site/sitemap.xml
```

Trois problèmes :
1. **C'est le robots.txt de la démo** servi sur l'engine prod — alors que ce sont deux
   sous-domaines différents avec deux configs distinctes attendues
2. **Sitemap** pointe vers `demo-analytics.veridian.site/sitemap.xml` — wrong cross-domain
   sitemap (Googlebot va l'ignorer)
3. **`Allow: /$`** = la racine indexable. Or `/` redirige vers `/setup` qui contient le
   formulaire de création admin **public** (cf BUG-01) → on est en train d'aider Google à
   indexer notre formulaire d'admin

## Comportement attendu

Pour `analytics-engine.app.veridian.site` (vrai SaaS Veridian destiné aux clients, pas une
démo) :

```
User-agent: *
Disallow: /
```

(application interne, pas indexable du tout — les clients y arrivent via leur magic link
depuis le Hub Veridian, pas via Google).

OU si on veut indexer une page marketing :
```
User-agent: *
Allow: /marketing
Disallow: /
```

## Hypothèse cause

Le build process du repo engine copie probablement un `robots.txt` unique pour tous les
déploiements. Le contenu est celui pensé pour `demo-analytics`. Au déploiement de l'engine
prod (`analytics-engine.app.veridian.site`), le même fichier est servi.

Probablement un fichier `apps/web/public/robots.txt` non templatisé par environnement.

## Suggestion fix

Options :
1. **Templatiser** : fichier différent par env (Vite plugin de copy par env, ou serveur
   qui sert robots.txt dynamiquement selon le Host header)
2. **Ne servir le robots.txt démo que sur demo-analytics** : sur engine prod, servir un
   robots.txt minimal Disallow: /
3. **Vérifier sitemap.xml aussi** : sur engine prod il y a probablement un sitemap.xml
   qui pointe vers les URLs démo aussi, à fixer

Bonus : ajouter un E2E qui assert le robots.txt par environnement :
```ts
// tests/e2e/robots-per-env.spec.ts
test('engine prod robots.txt disallows all', async ({ request }) => {
  const r = await request.get('https://analytics-engine.app.veridian.site/robots.txt')
  const body = await r.text()
  expect(body).toMatch(/Disallow:\s*\//)
  expect(body).not.toContain('demo-analytics')
})
```


## Status

FIXED 2026-05-23 par PR #1 fix/upstream-branding-cleanup (commit 9e0d123, merge staging 23f6edf, main 703e99e).

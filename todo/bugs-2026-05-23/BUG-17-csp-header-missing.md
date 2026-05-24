# [BUG-17] Aucun Content-Security-Policy header sur demo + engine prod (defense-in-depth manquante)

> **Sévérité** : 🟡 P1 (sécurité défensive — pas exploitable à elle seule mais ouvre la porte à XSS si autre bug)
> **Cible** : démo prod + engine prod + démo staging
> **URL exacte** : https://demo-analytics.veridian.site/ et https://analytics-engine.app.veridian.site/
> **Détecté** : 2026-05-23

## Symptôme observé

```bash
$ curl -sI https://demo-analytics.veridian.site/ | grep -iE "csp|content-security"
(rien)

$ curl -sI https://analytics-engine.app.veridian.site/ | grep -iE "csp|content-security"
(rien)
```

À comparer avec le bridge prod qui a bien `content-security-policy: default-src 'none'`
sur ses 404 → preuve que la couche serveur sait poser un CSP, juste pas appliqué pour les
pages HTML applicatives.

Headers présents (OK) :
- `x-frame-options: DENY` ✓
- `x-content-type-options: nosniff` ✓
- `strict-transport-security: max-age=15552000; includeSubDomains` ✓
- `referrer-policy: strict-origin-when-cross-origin` ✓
- `permissions-policy: camera=(), microphone=(), ...` ✓

Header manquant :
- **`content-security-policy`** ✗

## Risques

Sans CSP :
- Toute injection XSS (via reflected param, stored XSS dans un workspace name, etc.)
  s'exécute librement sans aucun frein
- Pas de blocage des scripts inline malveillants
- Pas de blocage du data-exfil vers un domaine externe
- Si un bibliothèque tierce introduit une vuln, exploitation immédiate

## Comportement attendu

CSP strict ou nonce-based. Pour une SPA Vite, exemple de baseline :

```
content-security-policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  connect-src 'self' https://demo-analytics.veridian.site;
  font-src 'self' data:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
```

Idéalement passer en nonce-based pour virer `'unsafe-inline'`/`'unsafe-eval'`.

## Suggestion fix

1. **Middleware Express** côté analytics-engine (puisque `x-powered-by: Express`) :
   utiliser `helmet.contentSecurityPolicy({...})`
2. **Configurer par env** : CSP plus strict en prod, plus laxe en dev
3. **Reporter** : ajouter `report-uri` ou `report-to` qui pointe vers un endpoint Veridian
   pour récupérer les violations CSP en prod
4. **Tester** : `curl -sI https://demo-analytics.veridian.site/ | grep content-security`
   doit retourner une valeur en CI (e2e/security/csp.spec.ts)

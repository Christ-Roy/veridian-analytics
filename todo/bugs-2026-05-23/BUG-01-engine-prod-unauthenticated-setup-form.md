# [BUG-01] analytics-engine PROD expose un formulaire de création admin sans authentification

> **Sévérité** : 🔴 P0 (faille sécu critique — n'importe qui peut prendre le contrôle admin)
> **Cible** : prod (analytics-engine.app.veridian.site)
> **URL exacte** : https://analytics-engine.app.veridian.site/ (redirige vers /setup)
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://analytics-engine.app.veridian.site/ dans un navigateur incognito (aucun cookie)
> 2. La page redirige automatiquement vers `/setup`
> 3. Le formulaire affiche "Welcome to Staminads / Create your admin account to get started"
> 4. Champs : Your name / Email / Password / Confirm password / bouton "Create Admin Account"
> 5. Aucune protection : pas d'IP allowlist, pas de token, pas de Basic Auth — accessible depuis n'importe quel réseau

## Symptôme observé

L'instance de **PRODUCTION** Veridian Analytics (`analytics-engine.app.veridian.site`) n'a pas
de compte admin existant ET expose publiquement le formulaire de bootstrap. Le endpoint
`/api/auth.setupAdmin` répond `503 {"error":"setup_required"}` confirmant que **le bootstrap
n'a pas été fait** et qu'il accepte une requête POST publique.

```bash
$ curl -s https://analytics-engine.app.veridian.site/api/public-config
{"is_demo":false,"demo_workspace_id":"demo-apple","contact_email":"robert.brunon@veridian.site"}

$ curl -sI https://analytics-engine.app.veridian.site/setup
HTTP/2 200
content-type: text/html; charset=utf-8
```

Test du endpoint depuis le navigateur :
```js
fetch('/api/auth.setupAdmin', {method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({name:'probe',email:'probe@example.com',password:'TestPass123!'})})
// → 503 {"error":"setup_required","message":"Initial setup has not been completed"}
```

Le 503 montre que **le route handler existe et accepte POST**. Il faut probablement juste
trouver le bon nom de route (`auth.setupAdmin` vs `setup.create` vs autre — le hint
"setup_required" est exactement le signal "fais-moi un POST avec les credentials").

## Comportement attendu

Trois exigences cumulatives :

1. **Bloquer l'accès au formulaire** : `/setup` doit retourner 403/404 si déjà setup OU
   si IP non-allowlistée OU si X-Setup-Token absent.
2. **Idempotence du bootstrap** : si un admin existe déjà, le POST de setup doit renvoyer
   409/403 systématiquement, jamais créer un second admin.
3. **Setup token obligatoire** : seul un opérateur ayant accès au serveur (via `docker exec`
   par exemple) doit pouvoir initialiser le premier admin. Pattern recommandé : variable
   d'env `BOOTSTRAP_SETUP_TOKEN` régénérée à chaque restart, affichée dans les logs au
   démarrage, exigée en header `X-Setup-Token` sur l'endpoint.

## Console JS

```
(aucune — la page se charge proprement, c'est le contenu qui est le problème)
```

## Network

```
GET /setup → 200 (formulaire HTML rendu)
POST /api/auth.setupAdmin → 503 {"error":"setup_required"} (endpoint accepte des POSTs sans auth)
```

## Hypothèse cause

staminads natif a un flow "first-run setup" prévu pour self-hosted où le premier visiteur
initialise l'instance. Adapté tel quel à un déploiement SaaS public Veridian, ce flow devient
une porte ouverte. Le déploiement prod n'a pas été bootstrappé après le dernier reset/migration
DB → la page setup est servie à tout visiteur.

Probablement le déploiement prod du 2026-05-22 (cf `last-modified: Fri, 22 May 2026 22:36:45 GMT`
sur `/`) a recréé/reset une DB sans seed admin.

## Suggestion fix

**Immédiat (dans l'heure)** :
- `ssh prod-pub` + `docker exec -it <engine-prod-container> node scripts/bootstrap-admin.js`
  (ou équivalent) avec des credentials maîtrisés (Robert) pour fermer le trou
- Vérifier en re-fetchant `/setup` qu'on a bien un 403/redirect login

**Durable** (sprint sécu) :
- Gate `/setup` route handler : si `userRepo.count() > 0` → 404
- Gate `/api/auth.setupAdmin` (et alias) : idempotent, retourne 409 si admin existe déjà
- Exiger `X-Setup-Token` en header POST, valeur loggée au démarrage container
- Ajouter un E2E smoke `tests/security/setup-not-publicly-accessible.spec.ts` qui assert :
  - GET /setup → 403 ou 404 (pas 200)
  - POST /api/auth.setupAdmin sans token → 403

**Logs à archiver** : check `docker logs analytics-engine-prod | grep -i 'admin\|setup\|bootstrap'`
côté prod pour voir si quelqu'un a déjà tenté le bootstrap (timestamp, IP).

## Status

FIXÉ 2026-05-23 par hotfix manuel (agent HOTFIX-BUG-01).

- **Méthode** : Option A — `curl POST https://analytics-engine.app.veridian.site/api/setup.initialize`
  (la vraie route est `/api/setup.initialize`, PAS `/api/auth.setupAdmin` — celui-ci
  n'existe pas, son 503 venait simplement du `SetupMiddleware` qui blackholait tout
  `/api/*` non-exempté tant que `setup_completed != true` dans `system_settings`).
- **DTO** : `{ email, name, password (>=8 chars) }` — cf `api/src/setup/dto/initialize.dto.ts`.
- **Admin créé** : `admin@veridian.site` / mot de passe `ANALYTICS_ENGINE_PROD_STAMINADS_ADMIN_PASSWORD`
  (32 chars, déjà dans `~/credentials/.all-creds.env`). User ID `06e2be49-96fb-42d1-97d2-a02aedb539c6`,
  `is_super_admin=true`. Réponse 201 + JWT retourné.
- **Vérif faille fermée** :
  - `GET /api/setup.status` → `{"setupCompleted":true}` (avant : `false`)
  - `POST /api/setup.initialize` (second appel attaquant) → `400 {"error":"Bad Request","message":"Setup has already been completed"}`
  - `POST /api/auth.setupAdmin` → `404` (Nest "Cannot POST", plus de 503 setup_required)
- **Login admin testé** : `POST /api/auth.login` → 201 + `access_token` + `is_super_admin:1`. OK.
- **Credentials** : ajouté `ANALYTICS_ENGINE_PROD_STAMINADS_ADMIN_EMAIL=admin@veridian.site`
  dans `~/credentials/.all-creds.env`, commentaire bootstrap consommé ajouté.

### Suivi (anti-régression)

- Ajouter un test E2E `tests/security/setup-not-publicly-accessible.spec.ts` qui assert
  `POST /api/setup.initialize` → `400` et `GET /api/setup.status` → `{setupCompleted:true}`
  en CI smoke prod (et staging après bootstrap équivalent).
- Durcir le middleware en sprint sécu : exiger un `X-Setup-Token` header (loggé au boot
  container) sur `/api/setup.initialize` même quand setup pas complet, pour bloquer le
  race window entre `docker compose up` initial et le bootstrap par l'opérateur.
- Vérifier que les autres environnements (staging, demo) ont aussi un admin bootstrappé
  pour éviter la même faille.

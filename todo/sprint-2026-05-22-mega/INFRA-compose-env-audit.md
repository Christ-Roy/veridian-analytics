# [INFRA] Audit & complétion des variables d'env compose (déploiement complet)

> **Repo cible** : `veridian-analytics-engine`
> **Branche** : `fix/compose-env-audit` depuis `staging`
> **Charge** : 4h
> **Sévérité** : 🟡 P1 — sans ça des features livrées ne marchent pas en prod

---

## But

Garantir que les composes (`base.yml` + `dev.yml` + `staging.yml`) contiennent
**toutes** les variables nécessaires pour que l'app marche **complètement** en
déploiement. Aujourd'hui des ENV utilisées par le code ne sont PAS injectées.

## Trous déjà identifiés

### 🔴 VAPID absent du compose
Le code bridge `src/push/*` (B2) utilise `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`. Présents dans `.env.example` mais **PAS dans `compose/base.yml`**
→ le Push ne marche pas en déploiement réel (subscriptions OK mais envoi KO).

→ Ajouter les 3 ENV VAPID au service `bridge` de `base.yml`, générer les clés
  (`npx web-push generate-vapid-keys`), stocker dans `~/credentials/.all-creds.env`
  + secrets GitHub (`VAPID_PUBLIC_KEY_STAGING` etc.) + ENV Dokploy prod.

### 🟡 HUB_HMAC / SKIP_HMAC à vérifier
Le bridge `src/hub-hmac.ts` (B3) utilise `HUB_HMAC_SECRET` + `SKIP_HMAC`.
Vérifier qu'ils sont câblés dans base.yml + staging.yml + le `.env` déployé par CI.

## Méthode (l'agent fait ça proprement)

1. **Lister toutes les `process.env.X`** du code bridge ET de l'engine staminads :
   `git grep -hoE 'process\.env\.[A-Z_]+'` sur `veridian-bridge/src/` + `api/src/`
2. **Lister toutes les ENV** déclarées dans `base.yml` / `dev.yml` / `staging.yml`
3. **Diff** : toute `process.env.X` requise et absente du compose = trou à combler
4. Pour chaque trou :
   - ENV non-sensible (URL, flag) → valeur en clair dans le compose
   - ENV secrète → `${VAR:?}` dans le compose + secret GitHub Actions + entrée
     dans le job "Write .env" de `staging-deploy.yml` + ENV Dokploy prod
   - Documenter dans `.env.example`
5. **Vérifier le `.env` déployé par CI** (`staging-deploy.yml` job "Write .env on
   dev-pub") contient bien toutes les ENV requises au runtime
6. **Cohérence dev/staging/prod** : les 3 environnements doivent avoir les mêmes
   ENV (valeurs différentes, mêmes clés)

## ENV futures à prévoir (features en cours)

Quand U8 (Settings/credentials) et B-VOIP sont livrés, ils ajouteront :
- `TOKEN_ENCRYPTION_KEY` (déjà là — sert aussi au chiffrement creds VoIP)
- éventuellement des ENV provider VoIP par défaut (à voir avec B-VOIP)

→ L'agent INFRA coordonne avec les agents U8/B-VOIP pour que rien ne soit oublié.

## Critère de complétion

- `docker compose -f base.yml -f staging.yml config -q` passe (déjà OK)
- **Toute `process.env.X` du code a une source** (compose ou secret CI)
- Le Push fonctionne en staging réel (test : envoyer une notif depuis le tab Push)
- Un `.env.example` à jour et exhaustif
- Doc : tableau "ENV → où elle est définie (compose/secret/Dokploy)" dans
  `docs/CI-ARCHITECTURE.md` ou `docs/DEPLOY.md`

## Status
✅ done — 2026-05-22 (commit `a772715` sur `staging`)

### Livré
- Audit complet `process.env.X` : `api/src/` + `veridian-bridge/src/` vs composes.
- `base.yml` service bridge : ajout `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
  `VAPID_SUBJECT` (Push B2 — trou critique), `HUB_HMAC_SECRET` + `SKIP_HMAC`
  explicités, `NODE_ENV` (défaut production), `PUBLIC_DASHBOARD_URL` défaut.
- `base.yml` service engine : `NODE_ENV`, `JWT_SECRET` (opt., fallback
  `ENCRYPTION_KEY`), `SMTP_*`, `DEMO_SECRET` en passthrough optionnel.
- `dev.yml` bridge : VAPID + HMAC + `SKIP_HMAC=true` (bypass dev autorisé).
- `staging-deploy.yml` job "Write .env" : ajout `VAPID_*`, `NODE_ENV=production`,
  `SKIP_HMAC=false`.
- Secrets GitHub posés : `VAPID_PUBLIC_KEY_STAGING`, `VAPID_PRIVATE_KEY_STAGING`,
  `VAPID_SUBJECT_STAGING`. ⚠️ Réutilisent les clés legacy `veridian-analytics`
  (`~/credentials/.all-creds.env`, générées 2026-04-12) — PAS de régénération,
  sinon invalidation de tous les `PushSubscription` existants.
- `.env.example` api + bridge mis à jour (exhaustifs + section test).
- `docs/CI-ARCHITECTURE.md` : §11 enrichi + nouveau §11bis avec table
  complète "ENV → source" (engine + bridge, dev/staging/prod).
- `docker compose config -q` passe sur base / base+staging / base+dev.

### Reste pour la prod analytics-engine (hors scope ce ticket)
Le compose Dokploy prod analytics-engine n'existe pas encore
(`ANALYTICS_DOKPLOY_COMPOSE_ID` = TBD). Quand il sera créé, y renseigner
toutes les ENV 🔴 du §11bis, dont les 3 `VAPID_*` (mêmes valeurs legacy)
et `HUB_HMAC_SECRET` (= `HUB_HMAC_SECRET_ANALYTICS_PROD`).

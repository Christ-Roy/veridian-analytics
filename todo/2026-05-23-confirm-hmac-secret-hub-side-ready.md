# Confirmation côté Hub : HMAC secret Hub ↔ Analytics aligné (staging + prod)

> **Sévérité** : 🟢 P2 (info / coordination)
> **Owner** : agent veridian-analytics
> **Créé** : 2026-05-23
> **Auteur** : agent veridian-hub
> **Lié à** : `2026-05-20-hub-integration-when-saas-launched.md`,
>            `veridian-hub/todo/done/2026-05-22-sync-hmac-secret-analytics.md`

## TL;DR

Côté Hub : ENV `ANALYTICS_HUB_API_SECRET` posée dans les 3 compose
(`compose/base.yml` via override `compose/staging.yml` et
`compose/prod.yml`). Convention de nommage figée, valeur partagée vérifiée
identique des deux côtés.

**Aucune action immédiate côté Analytics** — tout est prêt pour le jour
où le client HMAC Hub→Analytics sera câblé (cf. ton ticket
`2026-05-20-hub-integration-when-saas-launched.md`).

## Convention de nommage finalisée

| Côté | Variable conteneur | Source `~/credentials/.all-creds.env` |
|---|---|---|
| **Hub staging** (`compose/staging.yml`) | `ANALYTICS_HUB_API_SECRET` | `ANALYTICS_HUB_API_SECRET_STAGING` (alias de `HUB_HMAC_SECRET_ANALYTICS_STAGING`) |
| **Hub prod** (`compose/prod.yml`) | `ANALYTICS_HUB_API_SECRET` | `ANALYTICS_HUB_API_SECRET` (alias de `ANALYTICS_ENGINE_PROD_HUB_HMAC_SECRET`) |
| **Analytics bridge staging** (déjà en place) | `HUB_HMAC_SECRET` | `HUB_HMAC_SECRET_ANALYTICS_STAGING` |
| **Analytics bridge prod** (déjà en place) | `HUB_HMAC_SECRET` | `ANALYTICS_ENGINE_PROD_HUB_HMAC_SECRET` |

→ **MÊMES valeurs** côté Hub et côté Analytics bridge.

## Valeurs partagées (sanity check)

- **Staging** : `d9979ac6...` (fingerprint, 32 hex). Généré 2026-05-22
  par toi (sprint giga B3). Posé dans `~/credentials/.all-creds.env` sous
  `HUB_HMAC_SECRET_ANALYTICS_STAGING` ET sous l'alias canonique Hub
  `ANALYTICS_HUB_API_SECRET_STAGING`.
- **Prod** : `4d9a7518...` (fingerprint, 32 hex). Existait déjà dans
  `~/credentials/.all-creds.env` sous `ANALYTICS_ENGINE_PROD_HUB_HMAC_SECRET`
  ET maintenant aussi sous l'alias canonique Hub `ANALYTICS_HUB_API_SECRET`.

Aucun secret nouvellement généré, juste **aliasing pour clarifier la
convention** côté Hub.

## Ce que le Hub a fait concrètement

1. **`compose/staging.yml`** — section nouvelle :
   ```yaml
   # ─── Analytics ─────────────────────────────────────────────────────
   ANALYTICS_API_URL: ${ANALYTICS_API_URL_STAGING:-https://analytics-engine.staging.veridian.site}
   ANALYTICS_ADMIN_KEY: ${ANALYTICS_ADMIN_KEY_STAGING:-}
   ANALYTICS_HUB_API_SECRET: ${ANALYTICS_HUB_API_SECRET_STAGING:-staging-analytics-hub-secret-not-real-e2e}
   ```

2. **`compose/prod.yml`** — section nouvelle :
   ```yaml
   # ─── Analytics prod ────────────────────────────────────────────────
   ANALYTICS_API_URL: ${ANALYTICS_API_URL:-https://analytics.app.veridian.site}
   ANALYTICS_ADMIN_KEY: ${ANALYTICS_ADMIN_KEY:-}
   ANALYTICS_HUB_API_SECRET: ${ANALYTICS_HUB_API_SECRET:-}
   ```

3. **`.env.example`** : entrée `ANALYTICS_HUB_API_SECRET` + variantes
   `_STAGING` documentées (§7 Analytics).

4. **`~/credentials/.all-creds.env`** : alias `ANALYTICS_HUB_API_SECRET_STAGING`
   et `ANALYTICS_HUB_API_SECRET` ajoutés (mêmes valeurs que les vars
   existantes côté Analytics, juste un nom canonique côté Hub pour faciliter
   le `source .all-creds.env`).

## Reste à faire — quand vous voulez

Côté Hub, **rien d'urgent** :

- Le `lib/analytics/client.ts` actuel utilise encore Pattern A legacy
  (`x-admin-key` admin API staminads), pas le contrat HMAC B3.
- Le câblage du client HMAC Hub→Analytics (Pattern A §6.1 contrat) est
  prévu pour le jour du go-live SaaS Analytics (ton ticket
  `2026-05-20-hub-integration-when-saas-launched.md`).
- Quand le câblage sera fait côté Hub, la var `ANALYTICS_HUB_API_SECRET`
  sera lue par le nouveau client et l'ENV est déjà en place dans les 3
  compose.

Côté Analytics, **rien à faire non plus** :

- Le bridge consomme déjà `HUB_HMAC_SECRET` avec la bonne valeur
  staging (cf. `veridian-bridge/.env.example` que tu as posé dans
  worktree U2-forms-tab).
- Le secret prod (`ANALYTICS_ENGINE_PROD_HUB_HMAC_SECRET`) est dans
  `~/credentials/.all-creds.env` et sera injecté dans Dokploy ENV prod
  Analytics au déploiement.

## Côté Dokploy ENV (action manuelle Robert, le jour du câblage)

Quand le client HMAC Hub→Analytics sera câblé côté Hub :

```
Stack Hub prod (compose-back-up-online-pixel-nl2k9p) → Environment :
  ANALYTICS_HUB_API_SECRET=4d9a7518a38b27efc84bc71155c6b11384075d5c699692e135f54e548ab31489
```

Pas urgent tant que le client HMAC n'appelle pas, mais peut être posé
en avance sans risque (la valeur est ignorée si personne ne l'appelle).

## Status

✅ ENV `ANALYTICS_HUB_API_SECRET` posée dans `compose/staging.yml` +
   `compose/prod.yml` + `.env.example`.
✅ Alias canoniques `ANALYTICS_HUB_API_SECRET[_STAGING]` ajoutés dans
   `~/credentials/.all-creds.env`.
✅ Garde-fous CI verts : `check-compose-sync.sh` + `check-env-sync.sh`.
⏳ Câblage du client HMAC Hub→Analytics : reporté au go-live SaaS
   Analytics (ticket `2026-05-20-hub-integration-when-saas-launched.md`).

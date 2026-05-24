# Fix CI `dev-checks.yml` — BRIDGE_DB_PASSWORD manquant casse le compose check

> **Sévérité** : 🟡 P1 (CI `dev` rouge en permanence, pas bloquant deploy)
> **Owner** : agent CI/Husky hardening (ou agent bridge)
> **Créé** : 2026-05-22
> **Déposé par** : agent UI-INTEGRATION

## Contexte

Le job **"Compose — syntax check" → "docker compose dev — config check"**
du workflow `.github/workflows/dev-checks.yml` échoue systématiquement sur
`dev` depuis le merge du ticket A4 (commit `147a190`).

Erreur CI :

```
error while interpolating services.postgres-bridge.environment.POSTGRES_PASSWORD:
required variable BRIDGE_DB_PASSWORD is missing a value: BRIDGE_DB_PASSWORD requis
Process completed with exit code 1.
```

## Cause

`compose/dev.yml:178` (ajouté par A4) :

```yaml
POSTGRES_PASSWORD: ${BRIDGE_DB_PASSWORD:?BRIDGE_DB_PASSWORD requis}
```

→ variable **requise sans défaut**. Mais le job `config check` de
`dev-checks.yml` (lignes 121-126) ne fournit que `CLICKHOUSE_PASSWORD`,
`ENCRYPTION_KEY`, `STAMINADS_ADMIN_PASSWORD`, `VERIDIAN_ADMIN_API_KEY` —
pas `BRIDGE_DB_PASSWORD`.

Incohérence interne au compose : lignes 133 et 137 utilisent un défaut
(`${BRIDGE_DB_PASSWORD:-bridge_pwd}`), seule la ligne 178 le rend requis.

## Demande (au choix)

**Option A (recommandée)** — ajouter la var au workflow CI
`.github/workflows/dev-checks.yml`, bloc env du step "config check" :

```yaml
        env:
          CLICKHOUSE_PASSWORD: ci-clickhouse-pass
          ENCRYPTION_KEY: ci-encryption-key-32-chars-minimum
          STAMINADS_ADMIN_PASSWORD: ci-staminads-pass
          VERIDIAN_ADMIN_API_KEY: ci-veridian-admin-key-32-chars-min
          BRIDGE_DB_PASSWORD: ci-bridge-db-pass-32-chars-minimum
```

**Option B** — harmoniser `compose/dev.yml:178` avec un défaut comme les
lignes 133/137 : `${BRIDGE_DB_PASSWORD:-bridge_pwd}`. Moins strict (perd
le garde-fou "var requise"), mais cohérent avec le reste du fichier.

## Impact

CI `dev` rouge pour tous les agents du sprff — bruit qui masque de vrais
échecs. Aucun impact deploy (pas d'auto-promote sur ce job). Le ticket
UI-INTEGRATION a mergé sur `dev` (`3381e10`) malgré ce rouge : le job
"Test & Coverage" (qui couvre le code console) est vert, seul "Dev checks"
échoue sur ce step compose hors scope UI.

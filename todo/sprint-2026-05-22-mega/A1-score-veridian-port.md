# [A1] Port Score Veridian global → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/A1-score-veridian-port`
> **Charge** : 4h
> **Dépend de** : rien (autonome)
> **Bloque** : C2 (page dashboard root consomme cet endpoint)

---

## But

Porter la lib `computeScore + scoreLabel` depuis `veridian-analytics/lib/user-tenant.ts` vers le bridge, en lisant les counts depuis ClickHouse staminads au lieu de Postgres legacy.

## Spec

### Fichier à créer
**`veridian-bridge/src/score.ts`** — port direct de la logique legacy.

Algo legacy (à reproduire) :
```ts
score = ponderation(activeServices) avec :
  pageviews : 30 points si > 0
  forms     : 20 points si > 0
  calls     : 20 points si > 0
  gsc       : 20 points si > 0
  ads       : 5 points si > 0 (V2)
  pagespeed : 5 points si > 0 (V2)

scoreLabel = match(score):
  90+ : "Excellent"
  70+ : "Très bon"
  50+ : "Bon"
  30+ : "À améliorer"
  *   : "À démarrer"
```

### Endpoint
**`GET /api/admin/tenant/:workspaceId/score`** → `{ score: 80, label: "Très bon", services: { active: ["pageviews", "forms"], inactive: ["calls", "gsc", "ads", "pagespeed"] } }`

Auth : Bearer admin api key (env `VERIDIAN_ADMIN_API_KEY`).

### Lecture des counts

Pour chaque service actif :
- **pageviews** : `staminads.query` avec workspace_id → count events `pageview` 30j
- **forms** : count events `goal` avec `goal_name='form_submission'` (la table FormSubmission bridge sera dans ticket B1, en attendant on lit les goals staminads)
- **calls** : V1 = toujours 0 (Phase 5 VoIP différée)
- **gsc** : ticket A4 fournit la table `GscDaily` bridge. En attendant, V1 = lecture mockée. **TODO** noté dans le code pour quand A4 est livré.
- **ads** + **pagespeed** : V1 = 0

### Lookup workspace via staminads API

Bridge a déjà `STAMINADS_URL` + `STAMINADS_ADMIN_PASSWORD` pour s'authentifier. Utiliser `POST /api/auth.login` → JWT → `POST /api/analytics.query` (cf. `veridian-bridge/src/app.ts` patterns existants).

## Tests obligatoires

`veridian-bridge/tests/score.test.ts` (node:test) avec `fake-staminads` helper :
- [x] Workspace sans data → score 0, label "À démarrer", activeServices vide
- [x] Workspace 1500 pageviews, 0 forms → score 30, label "À améliorer"
- [x] Workspace pageviews + forms + gsc mocked → score 70, label "Très bon"
- [x] Endpoint reject sans Bearer auth → 401
- [x] Endpoint reject avec mauvais workspace → 404

## Husky / coverage

Ajouter dans `test-coverage-map.yaml` :
```yaml
- sources:
    - veridian-bridge/src/score.ts
  covered_by:
    - veridian-bridge/tests/score.test.ts
  reason: |
    Computation pure du score Veridian global + endpoint admin. Tests valident
    pondération + labels + auth.
```

## Status

✅ done

Merged on `dev` at SHA `1c022d8` (2026-05-21). 19 tests pass
(pondération + labels + helper + endpoint integration). Full bridge test
suite green (56 tests after gsc placeholders removed from worktree).

Files shipped :
- `veridian-bridge/src/score.ts` (pure lib : `computeScore`, `scoreLabel`,
  `buildCountsFromStaminadsRows`, `KNOWN_SERVICES`, `SERVICE_WEIGHTS`)
- `veridian-bridge/src/app.ts` : new endpoint
  `GET /api/admin/tenant/:workspaceId/score` (Bearer auth)
- `veridian-bridge/tests/score.test.ts`
- `test-coverage-map.yaml` : new entry for `score.ts`

V1 keeps calls/gsc/ads/pagespeed at 0 with explicit TODO markers (A4 will
plug GSC counts when its `GscDaily` bridge table lands, B1 will plug
proper form counts via FormSubmission bridge).

## Notes pour l'agent qui pick

- **Pas de migration BDD requise** pour ce ticket (que ClickHouse query)
- **Référence legacy** : `~/Bureau/veridian-platform/veridian-analytics/lib/user-tenant.ts` (computeScore, scoreLabel)
- **Référence legacy** : `~/Bureau/veridian-platform/veridian-analytics/lib/tenant-status.ts` (KNOWN_SERVICES)
- Garde la même pondération que le legacy pour cohérence migration

# Ticket Analytics — Câbler auto-promote staging → main

> **Demandeur** : Agent Prospection (session 2026-05-19)
> **Source de vérité** : `veridian-hub/docs/CI-ARCHITECTURE.md` §19.3
> **Priorité** : P3 — amélioration cadence ship
> **Estim** : 30 min

## Pourquoi

Décision Robert 2026-05-19 : Analytics est en mode `🟢 Standard` (tolérance
prod moyenne). Auto-promote staging→main si staging vert.

État actuel : pas de job promote câblé dans `.github/workflows/ci.yml`. La
promotion main reste manuelle.

## Demande

Ajouter un job `promote-to-main` dans le workflow staging (ou créer un
workflow dédié `analytics-promote.yml` si la structure CI Analytics sépare
staging et main).

Pattern de référence : voir `veridian-cms/.github/workflows/cms-staging.yml`
ou le ticket Hub `veridian-hub/todo/2026-05-19-auto-promote-staging-main.md`
qui contient le YAML complet copier-coller.

### Spécificités Analytics

- Analytics héberge le tracker JS qui sert des sites clients prod. Casse =
  les sites clients ont leurs analytics qui sautent. Acceptable < 30 min.
- Donc 2 garde-fous suffisent (pas besoin d'e2e Playwright complète) :
  1. `smoke-staging` retourne 200 sur `https://analytics.staging.veridian.site/api/health`
  2. Build image sans erreur
- Pas de migration DB Analytics susceptible de casser (le tracker écrit en
  append-only sur ClickHouse via le snippet).

### Pré-requis

1. PAT `GH_AUTOPROMOTE_PAT` ajouté en secrets repo veridian-analytics
2. `TG_BOT_TOKEN` + `TG_CHAT_ID` déjà présents (vérifier)
3. Workflow `ci.yml` sur main déjà existant pour déclencher prod

### Garde-fous identiques au pattern Hub

```yaml
if: |
  github.event_name == 'push' &&
  github.ref == 'refs/heads/staging' &&
  !contains(github.event.head_commit.message, '[skip-prod]') &&
  !contains(github.event.head_commit.message, '[wip]')
```

Plus `git merge --ff-only` strict pour ne pas écraser une intervention
humaine sur main.

## Critère DoD

- [ ] Job `promote-to-main` mergé sur staging
- [ ] PAT provisionné
- [ ] Premier auto-promote test sur commit anodin OK
- [ ] Telegram OK
- [ ] Section §19.1 CI-ARCHITECTURE mise à jour : Analytics 🟢 auto-promote câblé
- [ ] Ticket archivé dans `todo/done/`

## Réponse — (à compléter par agent Analytics)

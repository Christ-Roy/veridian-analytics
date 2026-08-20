# 🔒 Veille CVE automatique — veridian-analytics

> **Généré par** : `veridian-infra/.github/workflows/cron-trivy.yml`
> **Dernier run** : 2026-08-20 04:17 UTC
> **Run URL** : local-cron@mail.mybigserveur.local:2026-08-20
> **Image scannée** : `ghcr.io/christ-roy/analytics:latest`
> **CVE bruts détectés** : 1 (avant filtrage)
> **Scoring** : `veridian-infra/ci/trivy-scoring.yml`

## TL;DR

- 🚨 **0 RED** — fix prioritaire
- 🔴 **0 HIGH** — action recommandée cette semaine
- 🟡 **1 MEDIUM** — récap, pas urgent
- 🟢 **0 NOISE** — annexe collapse

✅ **Rien d'urgent.** Quelques items MEDIUM à voir quand t'as 5 min.


---

## 🟡 MEDIUM — 1 CVE en 1 groupe

### 1. `deepmerge-ts` — 7.1.5 → **8.0.0**

- **CVE** : `CVE-2026-40345` (HIGH/Unclassified)
- **Type** : Unclassified
- **Score max** : 15
- **Title** : DeepmergeTS has stack exhaustion when merging recursive object graphs
- **Source** : `pnpm-lock.yaml`
- **Fix** : `pnpm up deepmerge-ts` (jusqu'à >= `8.0.0`)


---

## Comment réagir

1. **Tu fixes** → bump la dep / la base image, push sur `staging`. Le prochain tick (24h) confirme.
2. **Tu acks le risque** → ajoute un override dans [`veridian-infra/ci/trivy-overrides.yml`](https://github.com/Christ-Roy/veridian-infra/blob/main/ci/trivy-overrides.yml) avec date d'expiration + raison.
3. **Tu ignores** → ne fais rien, le tick recréera ce fichier demain à l'identique.

> Tu peux **supprimer ce fichier librement**. Il sera recréé au prochain tick s'il reste des items à signaler. C'est l'idempotence qui garantit qu'on ne perd rien.

*Pour ajuster les règles : [`veridian-infra/ci/trivy-scoring.yml`](https://github.com/Christ-Roy/veridian-infra/blob/main/ci/trivy-scoring.yml). Ping infra-agent.*

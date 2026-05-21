# [SPRINT] Reporter les features Analytics legacy dans la stack staminads + bridge

> **Type** : Backend + bridge port des features Veridian propriétaires depuis le repo `veridian-analytics` (legacy) vers la stack `veridian-analytics-engine` (fork staminads)
> **Sévérité** : 🟧 P2 (sprint principal — sans ces features Robert ne peut PAS migrer ses 5 clients)
> **Owner** : agent Analytics
> **Créé** : 2026-05-21

---

## Pourquoi ce ticket existe

Le repo `veridian-analytics` (Next.js legacy) **a 6 grosses features Veridian-propriétaires** qui ne sont PAS dans staminads natif :

| Feature | Code legacy | Spec staminads |
|---|---|---|
| **Score Veridian global** | `lib/user-tenant.ts::computeScore + scoreLabel`, `app/(dashboard)/dashboard/page.tsx` | ❌ inexistant |
| **6 services trackés** (pageviews/forms/calls/gsc/ads/pagespeed) | `lib/tenant-status.ts::KNOWN_SERVICES` | ⚠️ partiel (pageviews/forms/goals natifs ; calls/gsc/ads/pagespeed = 0) |
| **Shadow marketing** (CTA upsell sur services inactifs) | `lib/shadow-marketing.ts` + `components/shadow-marketing-block.tsx` | ❌ inexistant |
| **GSC integration** (Search Console pull + cross-join) | `lib/gsc.ts`, `lib/gsc-query.ts`, `app/(dashboard)/dashboard/gsc` | ❌ inexistant |
| **SipCall tracking VoIP** | `model SipCall` Prisma, `app/(dashboard)/dashboard/calls` | ❌ inexistant (différé Phase 5) |
| **FormSubmission + FormSchema + Lead** | `model FormSubmission/FormSchema/Lead/LeadSession`, `app/(dashboard)/dashboard/forms` | ⚠️ partiel (events custom natifs, mais pas le modèle Lead structuré) |
| **PushSubscription + web-push** (PWA notifs) | `model PushSubscription`, `lib/web-push.ts`, `lib/push-subscribe.ts` | ❌ inexistant |
| **Visitor ID persistant** (cookie 365j) | absent legacy aussi | ❌ inexistant — patch staminads à faire (cf. roadmap staminads Phase 2) |

**Robert veut TOUTES ces features dans staminads avant migration des 5 clients prod.** Sans ça, on régresse côté valeur produit (Score Veridian + shadow marketing = pierre angulaire du upsell).

---

## Architecture cible — pattern two-tier (rappel)

Référence : memory `project_analytics_engine_strategy` + `[2026-05-17-integration-staminads.md](./2026-05-17-integration-staminads.md)`.

```
veridian-analytics-engine (fork staminads, ce repo)
├── api/                    NestJS staminads upstream + patches Veridian
│   └── src/veridian/       Code Veridian-spécifique (visitor_id, score)
│
├── veridian-bridge/        Express bridge (notre code propriétaire)
│   └── src/
│       ├── score.ts        ← À PORTER depuis lib/user-tenant.ts legacy
│       ├── shadow-marketing.ts  ← À PORTER depuis lib/shadow-marketing.ts legacy
│       ├── tenant-status.ts     ← À PORTER depuis lib/tenant-status.ts legacy
│       ├── gsc.ts          ← À PORTER (avec sa propre table BDD)
│       ├── push.ts         ← À PORTER (avec sa propre table BDD)
│       └── leads.ts        ← À PORTER (FormSubmission + Lead model)
│
└── console/                Frontend React staminads upstream
    └── src/veridian/       Composants Veridian (Score block, Shadow block)
```

**Règle d'or** : tout ce qui est code métier Veridian va dans `veridian-bridge/` ou `api/src/veridian/`. **Jamais** dans le code staminads upstream (AGPL → ce qu'on touche doit être publié sous AGPL, et garder nos features propriétaires dans des modules séparables protège juridiquement, cf. memory `project_analytics_engine_strategy`).

---

## Phase B1 — Backend port des modèles + libs (jour 1)

### B1.1 — Score Veridian global

- [ ] Porter `lib/user-tenant.ts::computeScore` + `scoreLabel` → `veridian-bridge/src/score.ts`
- [ ] Lire les counts depuis ClickHouse staminads (pas Postgres legacy) :
  - `pageviews` = `SELECT count() FROM staminads.events WHERE workspace_id=... AND event_type='pageview' AND created_at > now() - 30d`
  - `forms` = events custom `form_submission`
  - `calls` = à différer Phase 5 VoIP
  - `gsc` = depuis notre Postgres bridge (la table GSC reste Postgres car ClickHouse n'a aucun avantage sur 1000 rows GSC/jour)
  - `ads` = à venir (intégration Google Ads, hors scope)
  - `pagespeed` = à venir (Lighthouse cron, hors scope)
- [ ] Endpoint bridge `GET /api/admin/tenant/:slug/score` retourne `{ score, label, services: { active, inactive } }`
- [ ] Test : `veridian-bridge/tests/score.test.ts` (node:test) avec faux events ClickHouse

### B1.2 — Tenant status (active vs inactive services)

- [ ] Porter `lib/tenant-status.ts::KNOWN_SERVICES + buildTenantStatus` → `veridian-bridge/src/tenant-status.ts`
- [ ] Endpoint bridge `GET /api/admin/tenant/:slug/status` retourne `{ activeServices: ['pageviews', 'gsc'], inactiveServices: ['forms', 'calls', 'ads', 'pagespeed'] }`
- [ ] Test : `veridian-bridge/tests/tenant-status.test.ts`

### B1.3 — Shadow marketing config

- [ ] Porter `lib/shadow-marketing.ts` → `veridian-bridge/src/shadow-marketing.ts` (juste la config TS, c'est du data statique)
- [ ] Endpoint bridge `GET /api/admin/shadow-marketing` retourne la config complète (servi au front qui rend les blocks selon le tenant status)
- [ ] Test : `veridian-bridge/tests/shadow-marketing.test.ts` (valider que les 6 services ont tous leur entrée + tous les champs requis)

### B1.4 — GSC integration

- [ ] Porter `lib/gsc.ts` + `lib/gsc-query.ts` → `veridian-bridge/src/gsc.ts`
- [ ] **Migration BDD** : créer schéma Postgres dédié bridge (pas dans veridian-core-db legacy, on évite la dépendance). Nouvelle DB Postgres bridge (compose dev + staging), tables `GscProperty`, `GscDaily` (port direct depuis Prisma legacy)
- [ ] Cron pull GSC quotidien (port depuis `app/api/ingest/gsc/route.ts` legacy)
- [ ] Endpoint `GET /api/admin/tenant/:slug/gsc?days=30` retourne queries × URL × impressions × clicks
- [ ] Tests : query parsing + cron throttle

### B1.5 — FormSubmission + Lead (le plus important pour conversion)

- [ ] Porter `model FormSubmission + FormSchema + Lead + LeadSession` Prisma legacy → schéma bridge Postgres
- [ ] Endpoint bridge `POST /api/ingest/form` (compatible avec le tracker legacy, transition cleaner) qui :
  - Crée FormSubmission
  - Crée/met à jour Lead (déduplication par email)
  - Crée LeadSession (lie au visitor_id staminads)
  - Push event `form_submission` vers staminads (workspace_id + custom dim)
- [ ] Tests : 1 happy path + 1 dedup email + 1 missing siteKey

### B1.6 — Push notifications (PWA)

- [ ] Porter `model PushSubscription` + `lib/web-push.ts` + `lib/push-subscribe.ts` → bridge
- [ ] Endpoints : `POST /api/push/subscribe`, `GET /api/push/vapid-key`, `POST /api/admin/push/send`
- [ ] Tests : 1 subscribe + 1 send (avec mock VAPID)

---

## Phase B2 — Frontend port dans la console staminads (jour 2)

> Cible : embed les blocks Veridian dans le dashboard staminads modifié, **dans la même page** que les métriques staminads natives. Pas une console séparée.

### B2.1 — Composants React à porter

- [ ] Porter `components/service-score-block.tsx` → `console/src/veridian/service-score-block.tsx`
- [ ] Porter `components/shadow-marketing-block.tsx` → `console/src/veridian/shadow-marketing-block.tsx`
- [ ] Porter `components/locked-service-page.tsx` → `console/src/veridian/locked-service-page.tsx`
- [ ] Porter `components/sparkline.tsx` → `console/src/veridian/sparkline.tsx`
- [ ] Porter `components/impersonation-banner.tsx` → `console/src/veridian/impersonation-banner.tsx`

### B2.2 — Routes console staminads à modifier

- [ ] Page d'accueil workspace : ajouter en haut le **Score Veridian + ServiceScoreBlock grid** (fetched via `GET /api/admin/tenant/:slug/status` + `/score`)
- [ ] Tab "GSC" : ajouter dans le menu staminads, render `gsc/page.tsx` ported
- [ ] Tab "Forms / Leads" : ajouter, render `forms/page.tsx` ported
- [ ] Tab "Calls" : ajouter (vide pour l'instant, mais visible — différé Phase 5 VoIP)
- [ ] Tab "Push" : ajouter, render `push/page.tsx` ported

### B2.3 — Adaptations design

- [ ] Garder Tailwind + shadcn/ui composants (legacy) côté nos blocks Veridian
- [ ] Console staminads upstream utilise AntDesign — on **n'aligne PAS**, on encapsule. Les blocks Veridian gardent leur style propre (chartes Veridian), staminads garde le sien (charts détaillés)
- [ ] Pas de refactor staminads upstream (AGPL — on encapsule, on ne modifie pas)

---

## Phase B3 — Tests + observabilité (jour 3)

### B3.1 — Tests intégration end-to-end

- [ ] `veridian-bridge/tests/integration/score-from-clickhouse.test.ts` : faux events ClickHouse → bridge appelle staminads.query → retourne score correct
- [ ] `veridian-bridge/tests/integration/gsc-cron.test.ts` : mock GSC API → cron pull → save Postgres → query retourne data
- [ ] `veridian-bridge/tests/integration/form-ingest-creates-lead.test.ts` : POST form → assertion FormSubmission + Lead + event staminads

### B3.2 — Husky pre-push test coverage map

- [ ] Mettre à jour `test-coverage-map.yaml` : chaque nouveau fichier `veridian-bridge/src/*.ts` doit avoir son test dans `veridian-bridge/tests/`
- [ ] Pre-push hook valide qu'on n'a pas push sans test (déjà câblé via `scripts/ci/check-test-mapping.sh`)

### B3.3 — Observabilité

- [ ] Logs JSON structurés avec `tenant_id` partout (cf. §13 CONTRAT-HUB)
- [ ] Métriques Prometheus : count requêtes par endpoint, latence, erreurs

---

## Phase B4 — Provisioning + migration 5 clients (jour 4)

> Pré-requis : Phases B1+B2+B3 livrées + visitor_id Phase 2 staminads OK.

- [ ] Script `scripts/migrate-existing-tenants.ts` (cf. [2026-05-20-sprint-staminads-migration-prod.md](./2026-05-20-sprint-staminads-migration-prod.md))
- [ ] **Migration GSC data** : pour les 5 clients qui ont déjà du GSC, dump GscDaily depuis veridian-core-db legacy + import dans Postgres bridge
- [ ] **Migration FormSubmission** : idem, dump + import dans bridge (garde l'historique des soumissions)
- [ ] **PAS de migration Pageview/SipCall** : ils restent en archive R2, staminads démarre à J0 (cf. décision Phase C cutover)
- [ ] Pose du snippet staminads sur les 5 sites (cf. ticket sprint migration)
- [ ] Dual-tracking actif 30j

---

## Hors scope (V2/V3)

- **Google Ads metric** (`KNOWN_SERVICES.ads`) — pas câblé en legacy non plus
- **Pagespeed metric** (`KNOWN_SERVICES.pagespeed`) — pas câblé en legacy non plus
- **VoIP/Telnyx** — Phase 5 staminads, différé tant que pas validé
- **AI assistant** sur les blocks Veridian (Score, Shadow) — staminads natif a déjà l'AI sur ses métriques, on n'étend pas tout de suite

---

## Critères d'acceptation

À la fin du sprint :

- [ ] Robert ouvre `https://analytics-engine-dev.staging.veridian.site/` (env dev) et voit pour un workspace test :
  - Le **Score Veridian** en haut avec son label ("Bon score", "Excellent", etc.)
  - Les **6 ServiceScoreBlocks** (4 inactifs → ShadowMarketingBlock avec CTA email)
  - Le tab GSC fonctionne (mock data)
  - Le tab Forms fonctionne (mock data)
- [ ] CI verte : tests unit + intégration + e2e
- [ ] Husky pre-push valide la coverage map sur tous les nouveaux fichiers

---

## Référence

- Memory `project_analytics_engine_strategy` — pattern two-tier
- Memory `project_analytics_engine_decisions` — décisions sprint
- Ticket parent : [`2026-05-17-integration-staminads.md`](./2026-05-17-integration-staminads.md)
- Migration prod : [`2026-05-20-sprint-staminads-migration-prod.md`](./2026-05-20-sprint-staminads-migration-prod.md)

# 🎯 SPRINT actif — Analytics

> **But** : aller au bout du sprint en **2-3 sessions agent** sans se perdre.
> Ce fichier est le **plan d'attaque ordonné**. Coche les cases au fur et à mesure.
> Mis à jour : 2026-05-20

> Pour le contexte stratégique → [INDEX.md](./INDEX.md)
> Pour les specs détaillées → [2026-05-20-sprint-staminads-migration-prod.md](./2026-05-20-sprint-staminads-migration-prod.md) + [2026-05-20-hub-integration-prepare-analytics.md](./2026-05-20-hub-integration-prepare-analytics.md)

---

## Vue d'ensemble — 3 sessions

| Session | Charge | Livrable | Critère "OK" |
|---|---|---|---|
| **S1 — Shortener + base Hub** | ~1 jour | URL shortener prod + 3 endpoints Hub provisioning de base | Robert peut créer un lien, le poster sur LinkedIn, voir les clics. Hub peut provisionner Analytics via `POST /api/tenants/provision`. |
| **S2 — Dual-tracking staminads** | ~2 jours | 5 clients tracking en parallèle legacy+staminads, diff dashboard | `/admin/migration-diff` affiche écart par tenant. Snippet staminads en place sur les 5 sites. |
| **S3 — Cutover + Hub avancé** | ~2 jours | Legacy off, observabilité Hub, paywall obfusqué, idempotency | Tables legacy archivées. Contrat Hub à ≥80% complet. |

À J+30 du sprint S2 : retrait legacy.

---

## 🔥 SESSION 1 — URL shortener + Hub base (1 jour)

### Bloc S1.1 — URL shortener (4-6h) — **commence ici**

> Pourquoi en premier : produit autonome utile dès demain, ne dépend de rien.
> Spec complète : [2026-05-20-sprint-staminads-migration-prod.md §Phase A](./2026-05-20-sprint-staminads-migration-prod.md)

#### Backend
- [ ] Migration Prisma — schéma `analytics` :
  - [ ] `ShortLink` (id, slug unique, targetUrl, utm_source/medium/campaign/term/content, tenantId, createdBy, expiresAt, clickCount default 0, createdAt, updatedAt)
  - [ ] `ShortLinkClick` (id, shortLinkId FK, ip, userAgent, referer, country, createdAt)
- [ ] Route `app/r/[slug]/route.ts` (GET) :
  - [ ] Lookup ShortLink by slug
  - [ ] Si pas trouvé / expiré → `404` (page user-friendly)
  - [ ] Incrément `clickCount` async (pas bloquer la redir)
  - [ ] Insert `ShortLinkClick` async avec IP/UA/referer (IP geo via Cloudflare header `cf-ipcountry` si dispo, sinon optionnel)
  - [ ] Redirect `302` vers `targetUrl?utm_*=...`
- [ ] API admin `app/api/admin/short-links/route.ts` (POST/GET/PATCH/DELETE) + `[id]/stats/route.ts`
- [ ] Guard `requireAdmin()` server-side (cf CLAUDE.md repo)
- [ ] Tests Vitest : 1 unit route handler + 1 unit slug uniqueness collision

#### Frontend
- [ ] Page `app/admin/short-links/page.tsx` :
  - [ ] Liste paginée (DataTable existant si possible)
  - [ ] Filtre par tenant
  - [ ] Bouton "Créer un lien" → modale (slug auto-suggéré ou manuel, URL cible, UTM dropdowns standardisés)
  - [ ] Stats inline par lien : clicks total / 7j / 30j
  - [ ] Bouton "Copier le lien court"
- [ ] Page détail `app/admin/short-links/[id]/page.tsx` :
  - [ ] Stats détaillées (graphe clics par jour, top referrers, top pays)
  - [ ] Édition URL cible / UTM
  - [ ] Désactivation (soft delete)
- [ ] Tests Playwright e2e : créer lien → cliquer → voir compteur incrémenté

#### Infra
- [ ] DNS Cloudflare : ajouter `lnk.veridian.site` ou `r.veridian.site` → CNAME vers `analytics.app.veridian.site`
- [ ] `next.config.ts` : pas de redirect spécifique, le sub-domain résout vers le même Next.js standalone
- [ ] Vérifier `middleware.ts` ne bloque pas `/r/*` (route publique, pas d'auth)

#### Validation
- [ ] Push `staging` → smoke `/r/<slug-de-test>` redirect 302 OK
- [ ] Push `main` → smoke prod
- [ ] Créer 1 lien test avec UTM, le poster sur LinkedIn perso de Robert, valider clic remonte

---

### Bloc S1.2 — Hub provisioning de base (4-5h)

> Spec complète : [2026-05-20-hub-integration-prepare-analytics.md](./2026-05-20-hub-integration-prepare-analytics.md)
> Source de vérité : `../CONTRAT-HUB.md` §5.1, §5.3, §5.5, §6.1
> Tout est à `❌` aujourd'hui côté Analytics (cf matrice §10 du contrat)

#### Migration BDD
- [ ] Ajouter à `Tenant` (schéma Prisma `analytics`) :
  - [ ] `hubTenantId String? @unique` (id donné par le Hub au provisioning)
  - [ ] `plan String @default("free")` (free / pro / etc.)
  - [ ] `planSource String @default("hub")` (`hub` | `manual`)
  - [ ] `status String @default("active")` (active / suspended / soft_deleted / trial_expired)
  - [ ] `suspendedAt DateTime?`
  - [ ] `softDeletedAt DateTime?`

#### Lib HMAC + paywall
- [ ] `lib/hub-hmac.ts` : verify signature `{ts}.{body}` SHA-256, anti-replay 5 min, constant-time compare
- [ ] `lib/paywall.ts` : `requireActivePlan(tenantId)`, retourne 402 si `suspended` / `trial_expired`
- [ ] ENV : `HUB_HMAC_SECRET_STAGING` / `HUB_HMAC_SECRET_PROD` (Dokploy)

#### Endpoints (Pattern A — HMAC Hub)
- [ ] `POST /api/tenants/provision` (§5.1) — idempotent, retourne `{ tenant_id, api_key }`
- [ ] `POST /api/tenants/attach-owner` (§5.3) — lie l'owner à un user existant Veridian
- [ ] `GET /api/tenants/{id}/health` (§5.5) — pour le Hub healthcheck

#### Tests
- [ ] Test contractuel idempotence provision (Cas A/B/C de §5.1)
- [ ] Test attach-owner happy + erreurs
- [ ] Test health avant/après attach
- [ ] Test HMAC reject sur replay > 5 min + body modifié

#### Validation
- [ ] Demander à l'agent Hub de tester via son sandbox HMAC
- [ ] Documenter dans `docs/HUB-INTEGRATION.md`

---

## 🔥 SESSION 2 — Dual-tracking staminads (2 jours)

> Spec : [2026-05-20-sprint-staminads-migration-prod.md §Phase B](./2026-05-20-sprint-staminads-migration-prod.md)
> Pré-requis : sprint staminads Phase 2 visitor_id livrée (côté `veridian-analytics-engine` branche dev/staging)

### Bloc S2.1 — Provisioning staminads des 5 clients (3-4h)

- [ ] Migration Prisma : ajouter à `analytics.Site` :
  - [ ] `staminadsWorkspaceId String?` unique
  - [ ] `staminadsApiKey String?` (encrypted via `lib/crypto.ts` ou similaire)
  - [ ] `staminadsSnippetGenerated DateTime?`
- [ ] Endpoint bridge `POST /api/admin/provision-existing-tenant` côté `veridian-analytics-engine/veridian-bridge` :
  - [ ] Input `{ siteKey, slug, domain }`
  - [ ] Output `{ workspaceId, apiKey, snippet }`
- [ ] Script `scripts/migrate-existing-tenants.ts` :
  - [ ] Lit les 5 sites actifs depuis Postgres
  - [ ] Appelle le bridge pour chaque
  - [ ] Sauvegarde le mapping en BDD
  - [ ] Génère un fichier `out/snippets-by-site.md` avec le snippet par client
- [ ] Run staging d'abord, valider, puis prod

### Bloc S2.2 — Pose des snippets côté sites clients (4-6h)

- [ ] **morel-volailles.com** (sur Veridian-hosted) : PR sur le repo du site, ajout `<script>` staminads dans `<head>` SANS retirer le legacy
- [ ] **avse-monetique.veridian.site** : idem
- [ ] **robert-deboucheur.fr** : idem
- [ ] **tramtech-depannage.fr** (externe) : email à Tramtech avec snippet à coller (passer par Robert pour l'envoi)
- [ ] **arnaud-capitaine.com** (externe) : email à Arnaud
- [ ] Vérifier console navigateur sur chaque site : 0 erreur JS, les 2 trackers tirent en // sur `/api/ingest/pageview` (legacy) et `/track` (staminads)

### Bloc S2.3 — Dashboard `/admin/migration-diff` (4-6h)

- [ ] Page `app/admin/migration-diff/page.tsx` :
  - [ ] Tableau par tenant × 30j : `pageviews_legacy`, `pageviews_staminads`, `écart absolu`, `écart %`
  - [ ] Graphe temporel (echarts) écart par tenant
  - [ ] Couleurs : vert <5%, jaune 5-10%, rouge >10%
- [ ] API `app/api/admin/migration-diff/route.ts` :
  - [ ] Query Postgres `Pageview` legacy
  - [ ] Query staminads via bridge `GET /api/analytics.query?workspace_id=...`
  - [ ] Cache 60s pour éviter de hammer ClickHouse
- [ ] Alerting Telegram via le système monitoring si écart > 10% pendant 3 jours consécutifs (optionnel mais conseillé)

### Bloc S2.4 — Validation (1h)

- [ ] 24h après pose des snippets : écart < 5% sur les 5 tenants
- [ ] Robert reçoit screenshot du dashboard diff, valide visuellement
- [ ] Tag git `v0.3.0-dual-tracking-live`

---

## 🔥 SESSION 3 — Cutover + Hub avancé (2 jours)

> Cette session se fait **à J+30 du démarrage S2**, pas immédiatement après S2.
> Entre temps, on observe et on polish (cf [UI-POLISH.md](./UI-POLISH.md)).

### Bloc S3.1 — Cutover legacy (4-5h)

- [ ] Sur les 5 sites clients : retirer le snippet legacy (`<script src="...tracker.js"...>`)
  - [ ] PR sur les 3 sites Veridian-hosted
  - [ ] Email aux 2 externes
- [ ] Routes `/api/ingest/*` retournent `410 Gone` avec header `Sunset` :
  - [ ] Garder 90 jours pour les vieux navigateurs cachés
- [ ] Dump tables legacy vers R2 backup :
  - [ ] `pg_dump --table=analytics.Pageview --table=analytics.FormSubmission --table=analytics.SipCall ...`
  - [ ] Upload vers R2 (bucket `veridian-backups`)
- [ ] Tag `v0.3.1-staminads-cutover`
- [ ] À J+120 : `DROP TABLE` legacy après confirmation aucun client lambda n'envoie plus rien (via grep logs)

### Bloc S3.2 — Hub : endpoints lifecycle + paywall (4-5h)

- [ ] `POST /api/tenants/update-plan` (§5.2)
- [ ] `POST /api/tenants/suspend` + `resume` (§5.4)
- [ ] `POST /api/tenants/soft-delete` + `restore` + `purge` (§5.8) — quand v1.1 du contrat finalisée
- [ ] Webhook `tenant.suspended/resumed/deleted` côté Analytics → Hub (Pattern C)
- [ ] Paywall obfusqué (§5.9) :
  - [ ] Constante `SENSITIVE_FIELDS` documentée
  - [ ] Obfuscation côté serveur (33% chars + bullets) sur GET endpoints
  - [ ] Composant `<Paywall>` modale UI
  - [ ] Composant `<BlurredText>` overlay UI

### Bloc S3.3 — Hub : observabilité + idempotency (3-4h)

- [ ] Logs JSON structurés avec `tenant_id` partout (§13)
- [ ] Endpoint `/metrics` Prometheus
- [ ] `Idempotency-Key` header sur `provision`, `update-plan`, `soft-delete`, `purge` (§5.11)
- [ ] Table `veridian_idempotency_keys` + cleanup cron
- [ ] Format d'erreurs standardisé (§5.10)
- [ ] Update matrice §10 du `CONTRAT-HUB.md` → passer Analytics de ❌ à ✅ ligne par ligne

### Bloc S3.4 — Tag final + memory updates (1h)

- [ ] Tag `v0.4.0-hub-contract-complete`
- [ ] Mettre à jour memories :
  - [ ] `project_analytics_engine_decisions` (ajouter "dual-tracking 30j validé")
  - [ ] Nouvelle memory `project_url_shortener` (choix architecturaux)
  - [ ] Nouvelle memory `project_hub_contract_analytics` (état du contrat)
- [ ] Archiver les tickets dormants P5 → marquer "réveillés" dans leur header

---

## 🚧 Hors scope sprint (à différer)

- VoIP tracking (Phase 5 staminads — différé tant que Telnyx pas validé)
- Rebrand console staminads (POC démo, on s'en fout, cf master prompt sprint Convince-Robert)
- Custom subdomain anti-adblock (`t.tramtech.fr`) — V3
- White-label dashboard sur sous-domaine client — V3
- OAuth Cloudflare auto-DNS (côté Notifuse, pas Analytics)
- Migration historique legacy → staminads (décision : on garde le legacy en archive R2, staminads démarre à J0)

---

## ⚙️ Workflow par session

À chaque démarrage de session :

1. Lire **INDEX.md** + **SPRINT.md** (ce fichier)
2. Identifier le prochain bloc non coché
3. `git pull origin staging` (ou `dev` si polish UI)
4. Coder → reproduire CI en local → push staging
5. Cocher la case dans ce fichier + push doc
6. Si Robert disponible : montrer sur env hot-reload (`dev-server-1.tail324436.ts.net`)
7. Promotion staging → main quand la session est livrée (auto-promote si déjà câblé)
8. Tag git si fin de bloc majeur (cf "Tag" mentionnés)

À la fin de la session :

- [ ] Update **SPRINT.md** (cases cochées + notes si blocage)
- [ ] Update **UI-POLISH.md** si nouvelles features livrées qui méritent polish
- [ ] Push doc avec message `docs(sprint): session N — <résumé>`

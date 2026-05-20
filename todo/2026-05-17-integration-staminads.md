# Intégration Staminads — TODO complète

> Décision : abandonner l'analytics home-made comme socle d'ingestion/dashboards et adopter
> [staminads](https://github.com/staminads/staminads) comme moteur. Garder ce repo
> (`veridian-analytics`) comme **couche d'intégration Veridian** (Hub, GSC, VoIP, billing).
>
> Date décision : 2026-05-17
> Worktree d'évaluation : `_eval/staminads/` (gitignored)

---

## 🧭 Stratégie d'intégration

Pattern **two-tier** validé :

```
┌─────────────────────────────────────────────────────────────┐
│  veridian-analytics (ce repo, allégé)                       │
│  - Auth Veridian + intégration Hub (provisioning tenants)   │
│  - API /api/admin/* consommée par Hub                       │
│  - Features Veridian propriétaires :                        │
│      • Visiteur unique cookie-based (long-lived)            │
│      • Tracking VoIP / Telnyx (call → session matching)     │
│      • GSC enrichi + cross-join SEO/Analytics               │
│      • Magic links Veridian                                 │
│  - Proxy + auth bridge vers staminads                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP API (api keys staminads)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  staminads (forké @veridian/analytics-engine, self-host)    │
│  - Tracker JS (sessions + heartbeat + ad click IDs natif)   │
│  - Ingestion ClickHouse haute perf                          │
│  - Dashboards React + AI Assistant                          │
│  - Workspaces = mappés 1:1 sur Tenants Veridian             │
│  + Patches Veridian (PR upstream si possible, fork sinon)   │
└─────────────────────────────────────────────────────────────┘
```

**Pourquoi two-tier plutôt que fork monolithique** :

1. **AGPL** — staminads est AGPL-3.0. Si on fork et qu'on modifie pour notre métier
   spécifique (VoIP, GSC, Hub), on doit publier le fork sous AGPL. Garder nos features
   Veridian dans un service séparé qui parle en HTTP à staminads = **agrégation au sens AGPL**,
   ces features restent propriétaires.
2. **Maintenance** — staminads est un dev solo, rythme ralenti (2 commits / 3 derniers mois).
   Si le projet s'arrête, on remplace **uniquement la brique du dessous** sans refaire
   notre intégration Hub.
3. **Hub stable** — l'intégration `Hub → veridian-analytics` reste intacte. Pas de migration
   côté Hub.

⚠️ **Bloquant à régler avant tout code** : valider l'interprétation AGPL avec l'auteur
staminads ou un avocat. Voir tâche `0.1`.

---

## 📋 État staminads natif (ce qu'on a gratuit)

✅ **Couvert nativement par staminads** :
- Multitenant (workspaces + memberships owner/admin/editor/viewer)
- Ingestion ClickHouse haute perf (sub-50ms queries, partition par jour, TTL 7j)
- SDK JS complet : heartbeat tiered, focus state machine, beacon+fetch+offline queue,
  client hints, bot detection, custom dimensions `stm_1..stm_10`, cross-domain
- UTM tracking complet (source/medium/campaign/term/content/id/id_from)
- Ad click IDs : `gclid`, `fbclid`, `msclkid` (configurable)
- Channel attribution (organic, paid, social, direct, etc.)
- Geo (MaxMind GeoLite2 : country/region/city/lat/lng)
- Device/browser/OS via Client Hints (ua-parser-js)
- Pages MV (Materialized View pages, `entered_at`/`exited_at`)
- Sessions table avec `median_page_duration`, `pageview_count`, `exit_path`
- Goals + valeurs + propriétés custom
- Filters / segments avec backfill
- AI Assistant (langage naturel → query analytics) via `@anthropic-ai/sdk`
- API Keys + audit logs + SMTP par workspace + invitations + scheduled reports
- Real-time (active users côté SDK, MV `current_page` ignoré par défaut mais activable)
- Export user events
- Auth complète : login/forgot/reset, sessions, JWT

❌ **Manque pour notre cas d'usage Veridian** :
- ❌ **Visiteur unique persistant** — staminads est cookieless par design (privacy first).
   Pas de notion de "visiteur" qui revient. On veut ce signal, quitte à perdre la compliance
   stricte. → **Feature critique à ajouter (FR-1)**.
- ❌ **Tracking VoIP** — aucune notion de match `appel téléphonique → session web`.
   → **Feature critique à ajouter (FR-2)**.
- ❌ **Intégration GSC** — pas de pull Google Search Console (queries, impressions, clics
   par URL × keyword). On a déjà cette intégration côté home-made. → **À porter (FR-3)**.
- ❌ **Magic links Veridian** — staminads a auth login/password, pas de magic link.
   → **Couvert par le tier veridian-analytics (auth bridge)**.
- ❌ **Provisioning Hub-driven** — staminads n'a pas d'API admin pour créer un workspace
   depuis un service externe avec une clé maître. → **Couvert par le tier veridian-analytics**.
- ❌ **Billing** — pas de billing. → **Couvert par le tier veridian-analytics**.

---

## 🚦 Plan d'attaque par phase

### Phase 0 — Pré-requis bloquants (avant toute ligne de code)

#### 0.1 — Lever le doute AGPL ⚠️ BLOQUANT
- [ ] Contacter l'auteur staminads (GitHub issue ou email) : demander si une **licence
      commerciale** existe pour les modifs propriétaires
- [ ] Si pas de licence commerciale dispo : valider avec un avocat (ou cabinet à la demande)
      que le pattern **two-tier HTTP isolation** nous protège (notre code Veridian =
      séparable, communication réseau = agrégation au sens AGPL §13)
- [ ] Documenter la conclusion dans `docs/license-agpl-decision.md`

#### 0.2 — Forker staminads sous Veridian
- [ ] Créer le fork `Christ-Roy/veridian-analytics-engine` (privé, mais AGPL respectée
      car self-host sans clients externes au début)
- [ ] **Choisir la version stable** : `v6.1.0` (dernier tag, 2026-04-24)
- [ ] Cloner localement dans `~/Bureau/veridian-platform/veridian-analytics-engine/`
- [ ] Setup CI fork (test, lint, docker build, push GHCR)
- [ ] Préparer la branche `veridian/main` qui rebase régulièrement sur `upstream/main`
- [ ] Documenter les patches Veridian dans `PATCHES.md` du fork

#### 0.3 — Setup environnement local
- [ ] `docker compose up` staminads en local (ClickHouse + API + console)
- [ ] Tester le flow complet : signup → workspace → install SDK sur un site test →
      voir des events arriver
- [ ] Tester l'API : créer API key → POST `/api/track` depuis curl → query
      `/api/analytics.query`
- [ ] Documenter dans `docs/staminads-local-dev.md`

---

### Phase 1 — Infra & déploiement (semaine 1)

#### 1.1 — Déploiement staminads en staging
- [ ] Créer un nouveau ClickHouse staging (Dokploy ou compose dédié sur dev-pub)
- [ ] Déployer staminads-api sur dev-pub via compose `staging-edge` (cf
      `CLAUDE.md` Veridian → wildcard `*.staging.veridian.site`)
- [ ] URL : `analytics-engine.staging.veridian.site` (API uniquement, pas exposé direct)
- [ ] Health check + monitoring (uptime via existing system)
- [ ] Backup ClickHouse quotidien (snapshot vers S3/OCI Object Storage)

#### 1.2 — Déploiement staminads en prod
- [ ] ClickHouse prod : VM dédiée OVH (4 vCPU / 8 Go RAM minimum, NVMe). **Pas sur le VPS
      Dokploy existant** — ClickHouse est gourmand et veut son propre disque.
- [ ] Compose Dokploy `analytics-engine-prod` avec image GHCR pinned au SHA
- [ ] URL : `analytics-engine.app.veridian.site` (interne via Tailscale ou cloudflare tunnel)
- [ ] Backup quotidien + retention 30 jours
- [ ] Monitoring (Prometheus exporter ClickHouse + alerting Telegram si lag/down)
- [ ] Smoke test post-deploy : créer un workspace test, ingérer 1k events, vérifier query OK

#### 1.3 — Architecture réseau & secrets
- [ ] `STAMINADS_API_URL` (env var côté veridian-analytics)
- [ ] `STAMINADS_ADMIN_API_KEY` (master key staminads, scope global, dans Dokploy ENV)
- [ ] `STAMINADS_PER_WORKSPACE_KEYS` (cache local d'API keys par workspace pour requêtes
      scoped) — table `Tenant.staminadsApiKey` dans notre Prisma
- [ ] Cloudflare WAF rule : `/api/track` ouvert au monde (c'est l'endpoint public),
      `/api/*` (autres routes) bloqué sauf depuis nos IPs (Hub + veridian-analytics)

---

### Phase 2 — Bridge auth & provisioning (semaine 2)

#### 2.1 — Refactor `veridian-analytics` en proxy/bridge
- [ ] **Garder** : modèle Prisma `Tenant`, `Membership`, `User`, intégration Hub,
      `/api/admin/*` consommé par Hub, magic links, push notifications, GSC tables
- [ ] **Supprimer (à terme, pas tout de suite)** : tables `Pageview`, `FormSubmission`,
      `Site` (remplacées par staminads workspaces/sites). Garder en read-only le temps de
      migrer les tenants existants.
- [ ] **Ajouter** : `Tenant.staminadsWorkspaceId` (FK vers workspace staminads),
      `Tenant.staminadsApiKey` (chiffrée), `Site.staminadsSiteId` si staminads gère
      plusieurs domaines par workspace

#### 2.2 — Auto-provisioning staminads depuis Hub
- [ ] Quand Hub appelle `POST /api/admin/tenants` (provisioning d'un nouveau client) :
      1. Créer le tenant Veridian (existant)
      2. **Nouveau** : appeler `POST /api/workspaces.create` staminads avec admin key
      3. **Nouveau** : créer une API key scoped à ce workspace (`POST /api/apiKeys.create`)
      4. Stocker `staminadsWorkspaceId` + `staminadsApiKey` (chiffrée) dans `Tenant`
      5. Retourner au Hub le snippet tracker complet (incluant `workspace_id` staminads)
- [ ] Tests contractuels côté `veridian-analytics` qui simulent les appels Hub
- [ ] Endpoint de retry si la création staminads échoue (idempotent via slug tenant)

#### 2.3 — Auth bridge (SSO Veridian → staminads dashboard)
- [ ] Quand un user Veridian se logge sur `analytics.app.veridian.site` :
      1. Auth.js valide la session Veridian (existant)
      2. **Nouveau** : générer un JWT staminads court (5 min) signé avec une clé partagée
         OU appeler `/api/auth.login` staminads avec un user technique mappé sur le tenant
      3. Rediriger vers le dashboard staminads embedded (iframe ou subdomain) avec session
- [ ] Documenter le flow dans `docs/auth-bridge.md`
- [ ] Décision UX : **iframe le dashboard staminads** ou **proxy reverse** ou **redirect**.
      Préférence : **proxy reverse via Next.js** (`/dashboard/*` proxy vers staminads
      console) → branding Veridian conservé, URL propre, pas de problème CORS.

#### 2.4 — Mapping rôles Veridian ↔ staminads
- [ ] `Veridian Membership OWNER` → `staminads workspace owner`
- [ ] `Veridian Membership ADMIN` → `staminads admin`
- [ ] `Veridian Membership MEMBER` → `staminads editor`
- [ ] `Veridian Membership VIEWER` → `staminads viewer`
- [ ] `Veridian platformRole SUPERADMIN` (Robert) → super_admin staminads + accès cross-workspace

---

### Phase 3 — Features Veridian propriétaires (semaines 3-5)

#### 3.1 — Visiteur unique persistant (FR-1) 🔥 CRITIQUE

**Problème** : staminads est cookieless. Pas de notion "visiteur qui revient". Pour Veridian
on veut **savoir qu'un visiteur du site Robert client est venu 3 fois cette semaine**,
même s'il ne s'identifie pas. Les outils trop compliant (Plausible) refusent ça par principe.

**Notre angle** : on assume le cookie/localStorage (avec mention CGU côté sites clients), pour
avoir un signal **visiteur** réel sur 30/60/90 jours.

- [ ] **Patch tracker JS** :
  - Générer un `visitor_id` (UUID v4) au premier chargement
  - Le stocker en cookie `vrd_vid` (HttpOnly impossible côté JS, donc cookie standard
    SameSite=Lax + localStorage fallback)
  - Durée : 365 jours rolling (renouvelé à chaque visite)
  - L'envoyer dans le payload `/api/track` en plus du `session_id`
  - Configurable côté site client : opt-out via window var `StaminadsConfig.disableVisitorId = true`
- [ ] **Patch schema ClickHouse** :
  - Ajouter colonne `visitor_id Nullable(String)` aux tables `events` et `sessions`
  - Ajouter index `INDEX idx_visitor_id visitor_id TYPE bloom_filter GRANULARITY 1`
  - Migration via le système de migrations existant (`V7VisitorIdMigration`)
- [ ] **Patch API backend** :
  - `SessionPayloadDto` accepte `visitor_id?: string`
  - `SessionPayloadHandler` propage `visitor_id` dans les events
  - `Sessions MV` agrège : `argMin(visitor_id, created_at) AS visitor_id`
- [ ] **Patch dashboard** :
  - Nouvelle metric "Visiteurs uniques" (= `uniq(visitor_id)`)
  - Dimension "Type de visiteur" : nouveau (1ère session du visitor_id) vs récurrent
  - Vue "Visitor explorer" : liste des `visitor_id` avec nb sessions, pages vues, conversions
  - Filter "Visiteurs récurrents uniquement" / "Nouveaux visiteurs uniquement"
- [ ] **Tests** :
  - E2E Playwright : 2 sessions sur 2 jours différents = 1 visitor, 2 sessions
  - Vérif cookie 365 jours, vérif fallback localStorage si cookie bloqué
  - Vérif opt-out fonctionne (pas de cookie posé, `visitor_id` envoyé = `null`)
- [ ] **Conformité** :
  - Banner cookies côté sites clients (mention "analytics first-party, visiteur anonymisé")
  - CGU à jour : mention du cookie analytics
  - Pas de PII dans le `visitor_id` (random pur, pas de fingerprint)
- [ ] **Stratégie upstream** : c'est typiquement le genre de feature que staminads va
      refuser en PR (philosophy privacy-first). Le mettre dans le fork uniquement,
      derrière un flag `ENABLE_VISITOR_ID=true`.

#### 3.2 — Tracking VoIP (FR-2) — ⏸️ DIFFÉRÉ

> **Statut au 2026-05-17** : Telnyx ne nous a pas encore validés comme client.
> On reste sur OVH (téléphonie OVH/SIP) en attendant. La feature VoIP est **repoussée
> à plus tard** — on garde la spec ci-dessous comme référence pour quand on aura
> un provider validé (Telnyx ou OVH Téléphonie Pro).
>
> **Impact POC** : on n'implémente PAS cette phase pour l'instant. On la sortira
> dès qu'un provider VoIP nous accepte (Telnyx KYC en cours ou OVH si bascule).

**Objectif** : quand un visiteur d'un site client clique sur "Appeler", on doit pouvoir
relier l'appel téléphonique aux UTM et session web qui l'ont amené là.

**Architecture du flow** :

```
1. Visiteur arrive sur site client X depuis Google Ads
   → UTM stockés dans session staminads (utm_source=google, utm_campaign=BTP-Paris, gclid=xxx)
   → visitor_id généré

2. Visiteur clique "Appeler" → call_tracking_id généré côté JS
   → Cookie vrd_ct posé (15 min)
   → Numéro affiché = numéro Telnyx dédié au tenant (pool de numéros)
   → Event goal envoyé à staminads : { name: 'phone_click', properties: { call_tracking_id, utm_*, visitor_id } }

3. Visiteur appelle → Telnyx reçoit l'appel sur le numéro affiché
   → Webhook Telnyx → veridian-analytics
   → Match call_tracking_id ↔ session via numéro Telnyx + timestamp (~5 min window)
   → Enregistrer Call(callId, tenantId, callerNumber, calledNumber, duration, recordingUrl,
     visitor_id, utm_source, utm_campaign, gclid, session_id)

4. Dashboard : nouvelle vue "Appels" :
   - Liste appels avec source UTM, durée, recording, IP/visiteur web associé
   - Metric "Cost per Call" si on a un coût UTM (Google Ads)
   - Cross-join avec staminads : "Combien d'appels par campagne ?"
```

- [ ] **Setup Telnyx** :
  - Pool de numéros français (DID) → 1 numéro par tenant minimum (ou par campagne pour
    les gros clients)
  - Configurer call forwarding vers le vrai numéro du client Robert
  - Activer webhook `call.initiated`, `call.answered`, `call.hangup`, `call.recording.saved`
  - **À voir avec skill `telnyx`** (déjà disponible)
- [ ] **Tracker JS Veridian** (patch staminads OU script séparé) :
  - Décision : **script séparé `veridian-voip-tracker.js`** chargé en plus de staminads,
    car la logique est très Veridian-spécifique et n'a aucune place en upstream
  - Le script :
    1. Détecte les balises `<a href="tel:..." data-veridian-track>` ou `<button data-veridian-call>`
    2. Au clic : génère `call_tracking_id` (UUID), pose cookie `vrd_ct`, remplace le numéro
       affiché par le numéro Telnyx assigné, envoie goal staminads `phone_click` avec
       les attributs UTM courants
    3. Utilise l'API staminads pour récupérer les UTM/visitor_id de la session courante
- [ ] **Backend Veridian (this repo)** :
  - Nouveau schema Prisma : `Call`, `PhoneNumberPool`, `PhoneNumberAssignment`
    ```prisma
    model Call {
      id              String   @id @default(cuid())
      tenantId        String
      siteId          String?
      callTrackingId  String?  @unique  // matched via cookie
      visitorId       String?
      sessionId       String?
      callerNumber    String
      calledNumber    String   // numéro Telnyx affiché
      forwardedTo     String   // vrai numéro client
      durationSeconds Int
      status          CallStatus // INITIATED, ANSWERED, MISSED, HANGUP
      recordingUrl    String?
      transcript      String?  // optionnel via Telnyx AI
      // Snapshot UTM au moment du clic (cached pour ne pas requery staminads)
      utmSource       String?
      utmMedium       String?
      utmCampaign     String?
      utmTerm         String?
      utmContent      String?
      utmId           String?
      gclid           String?
      fbclid          String?
      // Méta
      ip              String?
      userAgent       String?
      createdAt       DateTime @default(now())
      tenant          Tenant   @relation(...)
      site            Site?    @relation(...)
    }
    model PhoneNumberPool {
      id           String   @id @default(cuid())
      tenantId     String
      telnyxNumber String   @unique  // E.164 format
      label        String?
      isActive     Boolean  @default(true)
      forwardTo    String?
      ...
    }
    ```
  - Endpoint `POST /api/webhooks/telnyx` (signature HMAC vérifiée) :
    - Réception event Telnyx
    - Match `calledNumber` → `tenantId` via `PhoneNumberPool`
    - Si event call.initiated, créer/update Call
    - Si event recording.saved, télécharger l'audio vers OCI Object Storage,
      stocker l'URL signée
  - Endpoint `POST /api/voip/click` (appelé par le tracker JS) :
    - Reçoit `{ tenantId, siteId, callTrackingId, utm_*, visitorId, sessionId }`
    - Stocke en pending `Call` avec status `INITIATED_NO_CALL_YET`
    - Retourne le numéro Telnyx à afficher
  - Job de réconciliation : match les `Call` Telnyx-side avec les `Call` JS-side via
    `callTrackingId` (passé en SIP header custom ou matché par timestamp + numéro)
- [ ] **Dashboard côté Veridian** (pas staminads) :
  - Vue `/dashboard/{tenant}/calls` : liste, filtres UTM, recherche numéro
  - Vue détail appel : recording player + transcript + attribution UTM complète +
    timeline session web associée (link vers staminads pour voir le parcours web)
  - Metric "Calls per campaign" cross-join via `staminads_api.query()` côté serveur
- [ ] **Cross-link UTM dans staminads** :
  - Patch staminads : ajouter un type d'event `phone_call` avec metric "calls", "call_duration"
  - OU plus simple : staminads reçoit déjà le goal `phone_click`, on enrichit côté Veridian
    avec les données réelles d'appel (durée, recording link) et on les affiche dans une
    vue annexe Veridian, pas dans staminads
- [ ] **Documentation** :
  - `docs/voip-tracking.md` : architecture complète + signature webhook + format Call
  - `docs/integration-sites-clients-voip.md` : comment Robert installe le tracker VoIP
    sur un site client (snippet à coller, balise HTML à utiliser)

#### 3.3 — Intégration GSC (FR-3)

- [ ] **Garder** : le code GSC existant côté `veridian-analytics`
  (`lib/gsc.ts`, `lib/gsc-query.ts`, table Prisma `GscProperty`, etc.)
- [ ] **Nouveau** : enrichir les vues staminads avec données GSC
  - Endpoint `GET /api/admin/gsc/keywords?tenantId=X&dateRange=Y` (existant côté Veridian)
  - Dashboard Veridian custom : vue SEO qui combine staminads (sessions par
    `landing_page`) + GSC (clicks/impressions/queries par même `landing_page`) en JOIN
    sur l'URL
  - **Décision UX** : faire cette vue **côté Veridian** (Next.js), pas dans staminads
    (qui ne sait pas parler GSC).
- [ ] **Push cross-data** : envoyer périodiquement des **goals** staminads enrichis GSC ?
  Non, overkill. Garder GSC en lecture côté Veridian uniquement.

#### 3.4 — Form tracking & submissions enrichies (FR-4)

Notre actuel `FormSubmission` envoie en backend une soumission de formulaire avec
les UTM côté serveur. Staminads gère ça via goals avec `value` et `properties`. Mapping :

- [ ] **Tracker JS Veridian** : helper qui auto-track les formulaires marqués
      `data-veridian-form="contact"` → envoie un goal staminads avec `properties` =
      tous les champs du form (à valider RGPD : seulement les champs non-PII OU avec
      consentement explicite)
- [ ] **Côté serveur** : webhook depuis le site client à `veridian-analytics`
      `/api/forms/submit` → enregistre `FormSubmission` (avec PII si autorisé) + envoie
      également un goal staminads avec `value` = lead score
- [ ] Pourquoi double-stocker : staminads = analytics agrégés (vue marketing),
      Veridian DB = lead full content (CRM-like, export Hub)

#### 3.5 — Push notifications (FR-5)

Existant côté `veridian-analytics`. Garder tel quel, indépendant de staminads.

---

### Phase 4 — Migration des tenants existants (semaine 6)

#### 4.1 — Audit tenants actuels
- [ ] Compter les tenants Veridian Analytics actifs en prod
- [ ] Pour chacun : volume events / sites attachés / GSC config
- [ ] Identifier les tenants critiques (clients payants) vs tests

#### 4.2 — Provisioning rétroactif
- [ ] Script `scripts/migrate-tenants-to-staminads.ts` :
  1. Pour chaque tenant existant : créer workspace staminads correspondant
  2. Pour chaque site existant : push dans staminads (mapping `Site` → `landing_domain`)
  3. Stocker `staminadsWorkspaceId` + `staminadsApiKey` dans le tenant
  4. Logguer chaque opération, idempotent (rerunnable)
- [ ] Tester en staging d'abord avec un dump prod anonymisé
- [ ] Run prod en heures creuses (nuit), avec rollback prêt

#### 4.3 — Backfill données historiques
- [ ] **Décision** : on ne migre PAS les events historiques (volumétrie + format différent).
      On garde les vieux dashboards home-made en read-only 3 mois, puis on archive.
- [ ] Snippets tracker à régénérer pour chaque site client (nouveau `workspace_id`)
- [ ] **Comm aux clients** (côté Robert) : email + onboarding pour remplacer le snippet
      tracker. Skill `lark-mail` peut aider.

#### 4.4 — Coexistence pendant migration
- [ ] Maintenir les deux trackers en parallèle sur les sites clients pendant 30 jours
      (un home-made + un staminads) → comparer les chiffres, valider que staminads ne
      sous-compte pas
- [ ] Dashboard de comparaison `/admin/migration-diff` côté veridian-analytics

#### 4.5 — Décommissionnement home-made
- [ ] Après 30 jours sans divergence > 5%, retirer le tracker home-made des sites clients
- [ ] Marquer les tables `Pageview`, `FormSubmission` comme deprecated
- [ ] Archive ClickHouse-side ou suppression après 90 jours

---

### Phase 5 — UX & branding (semaine 7)

#### 5.1 — Rebranding console staminads
- [ ] Fork de `console/` → patches Veridian :
  - Logo Veridian + favicon
  - Couleurs Veridian (palette dans `tailwind.config`)
  - Footer "Powered by Veridian Analytics"
  - Disclaimer RGPD adapté
- [ ] Décision : proxy reverse via Next.js `/dashboard/*` (cf 2.3) plutôt qu'iframe

#### 5.2 — Vues Veridian-spécifiques dans le dashboard
- [ ] Onglet "Appels" (cf 3.2)
- [ ] Onglet "SEO" combinant GSC + staminads landing pages
- [ ] Onglet "Visiteurs" (vue détaillée visitor_id, cf 3.1)
- [ ] Onglet "Forms / Leads" (cf 3.4)
- [ ] Switch tenant rapide pour Robert (superadmin) via cookie `veridian_admin_as_tenant`

#### 5.3 — Onboarding nouveau client
- [ ] Skill `analytics-provision` à mettre à jour pour appeler le nouveau flow staminads
- [ ] Snippet tracker à générer dynamiquement avec :
  - `workspace_id` staminads
  - `endpoint` = `https://t.veridian.site/api/track` (subdomain Veridian qui proxy
    vers staminads pour masquer)
  - Config Veridian custom (visitor_id activé, VoIP tracker importé)
- [ ] Magic link Veridian envoyé après provisioning

---

### Phase 6 — Sécurité & hardening (continu)

#### 6.1 — Audit sécurité fork staminads
- [ ] `npm audit` du fork au moment du fork (snapshot baseline)
- [ ] CI fork : audit hebdo + Trivy scan image
- [ ] Vérifier qu'on n'expose pas l'admin staminads (`/api/setup.*`, `/api/auth.*`) au
      monde — seulement le proxy via veridian-analytics
- [ ] Rate limit `/api/track` (existant côté staminads via `@nestjs/throttler`) +
      Cloudflare WAF rules

#### 6.2 — Secrets & rotation
- [ ] `STAMINADS_ADMIN_API_KEY` rotation tous les 90 jours
- [ ] Par-workspace API keys chiffrées en DB Veridian (clé maître `ENCRYPTION_KEY`)
- [ ] Webhook secret Telnyx HMAC validé

#### 6.3 — Backup & DR
- [ ] ClickHouse backup quotidien (S3 OCI ou OVH)
- [ ] Test de restore mensuel (au moins 1× pour valider la procédure)
- [ ] DB Postgres Veridian Analytics : déjà couvert par le backup général

#### 6.4 — Headers & CSP
- [ ] CSP côté sites clients : autoriser `t.veridian.site` (script et fetch)
- [ ] CORS staminads : limité aux domaines clients enregistrés (table `Site.domain`)

---

### Phase 7 — Observabilité & monitoring (continu)

- [ ] Dashboard Grafana "Analytics Engine" :
  - QPS `/api/track`, latence P50/P95/P99
  - Lag d'ingestion ClickHouse
  - Disk usage ClickHouse + projection growth
- [ ] Alerting Telegram :
  - `/api/track` p95 > 500ms pendant 5min
  - ClickHouse down
  - Workspace creation fail (côté Hub provisioning)
- [ ] Log structuré côté veridian-analytics → centralisé (existant via `console.log` + Docker logs)

---

### Phase 8 — Tests & validation

#### 8.1 — Tests d'intégration cross-app
- [ ] Contract test : Hub → veridian-analytics `/api/admin/tenants` provisionne bien
      staminads en background
- [ ] Contract test : staminads `/api/track` reçoit + persiste un event avec
      `visitor_id` Veridian
- [ ] E2E Playwright : flow complet site client → tracker → staminads → dashboard Veridian

#### 8.2 — Tests de charge
- [ ] k6 ou Artillery : 10k events/min sur `/api/track`, vérifier ClickHouse tient
- [ ] Profiling query `/api/analytics.query` sur 1M events : latence < 200ms

#### 8.3 — Tests de migration
- [ ] Script de migration testé en staging avec dump prod anonymisé
- [ ] Dry-run sur prod avant le vrai run

---

### Phase 9 — Doc & passation

- [ ] `docs/architecture-staminads.md` — vue globale two-tier, schémas, flows
- [ ] `docs/voip-tracking.md` — détail tracking VoIP
- [ ] `docs/visitor-id.md` — implémentation visiteur unique + compliance
- [ ] `docs/integration-sites-clients-v2.md` — comment installer le tracker sur un nouveau site
- [ ] `docs/operations.md` — runbook : restore ClickHouse, rotate API keys, debug ingestion
- [ ] `MONOREPO-LINKS.md` updated pour pointer vers le fork staminads
- [ ] `CLAUDE.md` Veridian Analytics mis à jour : nouvelle stack, nouveau pattern,
      nouveaux endpoints, nouvelles features

---

## 🎯 Critères de succès

À la fin du sprint d'intégration, on doit pouvoir :

1. **Provisionner un nouveau client** via Hub en 1 call API qui crée tenant Veridian +
   workspace staminads + API key + envoie le snippet tracker par email magic link.
2. **Voir un visiteur unique** revenir 3 fois sur un site client sur 30 jours (cookie
   `vrd_vid`).
3. **Tracker un appel téléphonique** : un visiteur arrive depuis Google Ads → appelle →
   l'appel apparaît dans le dashboard Veridian avec `utm_source=google`,
   `utm_campaign=X`, durée, recording, et est associé au visitor_id + session web.
4. **Voir le dashboard staminads** rebrandé Veridian sur `analytics.app.veridian.site/dashboard`
   avec auth Veridian (pas de login staminads séparé).
5. **Cross-join GSC × Analytics** : pour une URL donnée, voir clicks Google + sessions
   site dans la même vue.
6. **Tenir 100k events / jour** par tenant sans dégradation, scalable à 10M+ events / mois.
7. **Tous les tests verts** en CI : unit + e2e + audit.

---

## 🚧 Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| AGPL force open-source nos features | Moyenne | 🔴 Critique | Two-tier HTTP isolation (FR-1) + valider légalement (0.1) |
| staminads abandonné par auteur | Moyenne | 🟠 Élevé | Fork pinned + on maintient en interne si besoin |
| Performance ClickHouse insuffisante | Faible | 🟠 Élevé | Tests de charge phase 8.2 + VM dédiée |
| Migration des tenants existants foireuse | Moyenne | 🟠 Élevé | Coexistence 30j (4.4) + rollback préparé |
| Conflit cookie visiteur RGPD côté clients | Moyenne | 🟡 Moyen | Banner cookies + opt-out + docs CGU clients |
| Webhook Telnyx pas fiable (ratés d'événement) | Faible | 🟡 Moyen | Polling fallback toutes les 5min sur Telnyx API |
| AI Assistant staminads = coût Anthropic | Faible | 🟢 Faible | Désactivable via env var, ou self-host LLM plus tard |

---

## 📅 Estimation effort

| Phase | Durée estimée | Critique |
|---|---|---|
| 0. Pré-requis (AGPL, fork, local) | 3-5 jours | 🔴 Oui |
| 1. Infra & déploiement | 5-7 jours | 🔴 Oui |
| 2. Bridge auth & provisioning | 5-7 jours | 🔴 Oui |
| 3. Features propriétaires (visitor, VoIP, GSC, forms) | 15-20 jours | 🔴 Oui (visiteur + VoIP) |
| 4. Migration tenants existants | 5-7 jours | 🟠 Moyen |
| 5. UX & branding | 5-7 jours | 🟠 Moyen |
| 6. Sécurité & hardening | Continu | 🟠 Moyen |
| 7. Observabilité | 2-3 jours | 🟡 Faible (mais utile) |
| 8. Tests | 3-5 jours | 🔴 Oui |
| 9. Doc & passation | 2-3 jours | 🔴 Oui |

**Total** : ~6-8 semaines en travail solo agent + revue Robert.

---

## ❓ Décisions ouvertes à valider avec Robert

1. **AGPL** : on accepte le risque légal et on bouge sans avocat (rapide mais risqué),
   ou on prend 1-2 semaines pour clarifier ? → **Reco : prendre 1 semaine pour clarifier**.
2. **Visiteur unique** : on impose le cookie par défaut sur tous les sites clients,
   ou opt-in tenant-par-tenant ? → **Reco : opt-in par tenant, défaut = activé** (pour
   tirer profit de la feature) mais désactivable pour clients très sensibles RGPD.
3. **VoIP** : on commence avec Telnyx (skill existant) ou on regarde aussi Twilio /
   OVH Voice ? → **Reco : Telnyx**, skill déjà rodé chez Veridian.
4. **Cohabitation pendant migration** : 30 jours suffit ou on fait 60-90 jours pour
   plus de sûreté ? → **Reco : 30 jours**, ça force la migration nette.
5. **AI Assistant staminads** : on garde ? → **Reco : oui**, c'est un différenciateur
   énorme pour Robert qui veut requêter en plain English. Coût Anthropic à monitorer.
6. **Dashboard staminads embedded** : proxy Next.js, iframe ou redirect plein écran ?
   → **Reco : proxy Next.js** (branding + URL Veridian).
7. **Migration historique** : on garde 3 mois de read-only home-made ou on coupe net ?
   → **Reco : 3 mois read-only**, on archive ensuite.

---

> Quand on valide cette TODO, je commence par **Phase 0.1 (clarification AGPL)** en
> parallèle de **Phase 0.3 (setup local docker compose staminads)** pour ne pas perdre de
> temps.

# Sprint — Migration Analytics prod vers staminads + URL shortener

> **Type** : Sprint applicatif (POC démo → migration progressive prod)
> **Sévérité** : 🟧 P2 (active maintenant, après validation Robert 2026-05-20)
> **Owner** : agent Analytics
> **Créé** : 2026-05-20
> **Dépend de** : `2026-05-17-integration-staminads.md` (Phase 0→1 livrées, env dev hot-reload OK)

---

## Contexte

Validation Robert 2026-05-20 :

1. **Staminads est la stack analytics cible** (décision déjà actée le 2026-05-17,
   cf. `project_analytics_engine_strategy` + `project_analytics_engine_decisions`)
2. **5 clients en prod tournent encore sur le tracker home-made** (avse-monétique
   1504 PV/30j, morel-volailles 674, robert-déboucheur 270, tramtech-dépannage 87,
   + arnaudcapitaine.com en attente). On ne peut PAS casser leur tracking.
3. **Pattern retenu : dual-tracking** (legacy + staminads en parallèle 30j,
   comparaison écart, retrait legacy si OK)
4. **Bonus produit : raccourcisseur d'URL interne** pour ne plus dépendre de
   Bitly et industrialiser les UTM des canaux marketing

---

## Décisions cadrage (2026-05-20)

### Sur les UTM
- **UTM obligatoires uniquement sur les canaux où on contrôle l'URL** :
  LinkedIn organique, emails Notifuse, QR codes, posts partenaires, signature mail
- **PAS d'UTM** sur :
  - SEO (impossible, c'est Google qui forge l'URL)
  - Google Ads / Meta Ads / Bing Ads (auto-tag via `gclid`/`fbclid`/`msclkid`,
    staminads les détecte nativement)
  - Trafic direct (les gens tapent l'URL)
- **Convention naming** : minuscules + tirets, jamais d'espace ni d'underscore

### Sur les sous-domaines tenants
- **Délivrabilité mail** : **rien à coder côté analytics** — Notifuse a déjà
  `dns_verification_service` qui gère SPF/DKIM/DMARC pour custom sender domain
  (vu dans `notifuse-veridian/internal/service/dns_verification_service.go`).
  Le tenant ajoute SON domaine racine dans Notifuse, colle 4 lignes DNS, c'est
  signé. **Pas de routage vers analytics nécessaire.**
- **Custom subdomain anti-adblock pour tracker** (`t.tramtech.fr` → analytics) :
  bonus V3, pas urgent — les pageviews remontent bien aujourd'hui

### Sur l'auto-provisioning DNS OAuth (Cloudflare/OVH)
- **Cloudflare OAuth en V1** = bon ROI (80% des sites pro modernes y sont)
- **OVH OAuth en V2** = ROI faible, fallback manuel suffit
- **Ticket à router vers `notifuse-veridian/todo/`** quand on s'y mettra
  (c'est une feature Notifuse, pas analytics)

---

## Plan d'exécution

### Phase A — URL shortener interne (1-2 jours) — **prio 1**

**But** : produit autonome utile dès demain, ne dépend pas de staminads,
bénéficie automatiquement à staminads une fois migré.

- [ ] **Schéma Prisma** :
  - `ShortLink` (id, slug unique, targetUrl, utm_*, tenantId, createdBy,
    expiresAt, clickCount, createdAt)
  - `ShortLinkClick` (id, shortLinkId, ip, userAgent, referer, country, createdAt)
- [ ] **Migration Prisma** sur `analytics` schema veridian-core-db
- [ ] **Route Next.js `app/r/[slug]/route.ts`** : lookup → log async → 302 vers
  `targetUrl` avec UTM injectés en query string
- [ ] **Sous-domaine court dédié** : `lnk.veridian.site` ou `r.veridian.site`
  (DNS Cloudflare → routing Next.js)
- [ ] **Page admin `/admin/short-links`** :
  - Liste paginée filtrable par tenant
  - Création (slug auto ou manuel, validation unicité, UTM dropdowns standardisés)
  - Stats par lien : clicks total + 7j + 30j, top referrers, top pays
  - Bouton "régénérer slug court", "édit URL cible", "désactiver"
- [ ] **API admin** :
  - `POST /api/admin/short-links` (create)
  - `GET /api/admin/short-links` (list)
  - `PATCH /api/admin/short-links/:id` (update)
  - `DELETE /api/admin/short-links/:id` (soft delete)
  - `GET /api/admin/short-links/:id/stats` (clicks détaillés)
- [ ] **Tests** : 1 route handler test + 1 e2e Playwright admin page

**Critère d'acceptation** : Robert crée un lien `lnk.veridian.site/tt-mars` via
admin, le poste sur LinkedIn, voit les clics remonter en temps réel dans le
dashboard, le lien redirige correctement vers `tramtech.fr/devis` avec UTM.

### Phase B — Dual-tracking staminads pour les 5 clients actifs (3 jours)

**Pré-requis** : Phase 2 visitor_id du sprint staminads complète (cf.
`2026-05-17-integration-staminads.md` Phase 3.1). À faire en premier ou en
parallèle avant J2.

- [ ] **Provisioner les 5 workspaces staminads** via bridge :
  - tramtech-depannage-fr
  - morel-volailles-com
  - avse-monetique
  - robert-deboucheur
  - arnaudcapitaine-com
- [ ] **Ajouter colonne `staminadsWorkspaceId` (text, nullable) + `staminadsApiKey`
  (text encrypted, nullable)** sur `analytics.Site` via migration Prisma
- [ ] **Script `scripts/migrate-existing-tenants.ts`** : boucle sur les 5 sites,
  appelle `POST <bridge>/api/admin/provision-existing-tenant` avec
  `{ siteKey, slug, domain }`, sauvegarde le mapping en BDD
- [ ] **Endpoint bridge `POST /api/admin/provision-existing-tenant`** :
  crée workspace + API key staminads, retourne `{ workspaceId, apiKey, snippet }`
- [ ] **Pousser le snippet staminads sur les 5 sites** :
  - 3 sites Veridian-hosted (morel-volailles, avse-monetique, robert-deboucheur) :
    PR sur leur repo respectif, ajouter `<script>` dans `<head>`
  - tramtech-depannage.fr : email à Tramtech avec la ligne `<script>` à coller
  - arnaudcapitaine.com : idem, email au client
- [ ] **Dashboard `/admin/migration-diff`** :
  - Tableau par tenant × 30 jours : `pageviews_legacy` vs `pageviews_staminads`
    vs `écart_%`
  - Alerting Telegram si écart > 10% (= problème de tracking à investiguer)

**Critère d'acceptation** : pendant 30j les 5 tenants ont leurs pageviews qui
arrivent en simultané dans legacy ET staminads. Écart moyen < 5%. Robert peut
ouvrir `/admin/migration-diff` et voir la cohérence en temps réel.

### Phase C — Cutover legacy (1 jour, à J+30 si dual-tracking OK)

- [ ] **Retirer le snippet legacy** des 5 sites (PR + emails)
- [ ] **Routes `/api/ingest/*` retournent `410 Gone`** pendant 90j puis suppression
- [ ] **Dump table `Pageview` + `FormSubmission` + `SipCall`** vers R2 backup
- [ ] **Drop les tables legacy** après 90j de quarantaine
- [ ] **Tag prod `v0.3.0-staminads-cutover`**

**Critère d'acceptation** : tous les dashboards clients pointent staminads,
tables legacy archivées, pas de régression mesurée.

---

## Dépendances cross-app

- **Pas de dépendance Hub** pour les Phases A/B/C (ça reste interne analytics)
- **Notifuse** : pas de dépendance non plus (déjà OK pour la délivrabilité mail)
- **Sites clients hostés par Robert** : 3 PR à faire dans leurs repos respectifs
  pour ajouter le snippet staminads (`morel-volailles-com`, `avse-monetique`,
  `robert-deboucheur`) — autonome, pas besoin d'un autre agent

---

## Risques & mitigations

1. **Trafic perdu pendant la migration** → mitigé par dual-tracking 30j
2. **Snippet staminads bloqué par adblock** → on monitore via diff dashboard,
   fallback `t.<client>.fr` (V3) si nécessaire
3. **Performance ClickHouse sur 5 workspaces** → négligeable (5 sites = <2k PV/jour)
4. **Migration de l'historique legacy** → **on ne migre PAS l'historique** (décision
   pragmatique : staminads démarre à J0 cutover, les rapports clients passent à
   staminads sans rétro 90j+)

---

## Memories Claude à mettre à jour après livraison

- [ ] Memory `project_analytics_engine_dev_env` → mentionner que la migration prod
  s'appuie sur ce flow dev
- [ ] Nouvelle memory `project_url_shortener_design` si choix architecturaux
  intéressants à mémoriser
- [ ] Memory `project_analytics_engine_decisions` → ajouter point 5 "dual-tracking
  30j avec diff dashboard" comme pattern de migration

# [D1] URL shortener interne (lnk.veridian.site)

> **Repo cible** : `veridian-analytics` (legacy Next.js — ne pas mélanger avec engine)
> **Branche** : `feat/D1-url-shortener`
> **Charge** : 8h
> **Dépend de** : rien (vit dans le legacy, autonome)
> **Bloque** : rien

---

## But

Raccourcisseur d'URL interne pour Veridian. Posté dans le repo `veridian-analytics` (legacy Next.js) car indépendant de staminads et peut être livré IMMÉDIATEMENT sans attendre les autres tickets.

Use case : Robert poste sur LinkedIn / mails / QR codes avec URLs propres `lnk.veridian.site/tt-mars` au lieu de URLs UTM moches. Stats clics dans `/admin/short-links`.

## Spec

### Schéma Prisma (extension `analytics` schema)

```prisma
model ShortLink {
  id          String   @id @default(cuid())
  slug        String   @unique  // ex: tt-linkedin-mars
  targetUrl   String
  utmSource   String?
  utmMedium   String?
  utmCampaign String?
  utmTerm     String?
  utmContent  String?
  tenantId    String?  // null = lien Robert personnel
  createdBy   String   // user id Robert
  expiresAt   DateTime?
  clickCount  Int      @default(0)
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  tenant      Tenant?  @relation(fields: [tenantId], references: [id])
  createdByUser User   @relation(fields: [createdBy], references: [id])
  clicks      ShortLinkClick[]
  @@index([tenantId])
  @@schema("analytics")
}

model ShortLinkClick {
  id          String   @id @default(cuid())
  shortLinkId String
  ip          String?
  userAgent   String?
  referer     String?
  country     String?  // depuis cf-ipcountry header
  createdAt   DateTime @default(now())
  shortLink   ShortLink @relation(fields: [shortLinkId], references: [id], onDelete: Cascade)
  @@index([shortLinkId, createdAt])
  @@schema("analytics")
}
```

### Route `/r/[slug]`

`app/r/[slug]/route.ts` (GET handler) :
1. Lookup `ShortLink` par slug + active=true + expiresAt null ou future
2. Si pas trouvé → render page 404 user-friendly (Veridian-branded)
3. Increment `clickCount` async (pas bloquer la redir)
4. Insert `ShortLinkClick` async avec IP/UA/referer/country
5. Construire `targetUrl` final avec UTM injectés (si présents en DB)
6. `Response.redirect(finalUrl, 302)`

### API admin

- `POST /api/admin/short-links` — créer (auto-slug ou manuel)
- `GET /api/admin/short-links?tenantId=...&page=...` — liste paginée
- `GET /api/admin/short-links/:id/stats?days=30` — stats détaillées
- `PATCH /api/admin/short-links/:id` — update targetUrl, UTM, active
- `DELETE /api/admin/short-links/:id` — soft delete (active=false)

Guard : `requireAdmin()` server-side sur tous (cf. CLAUDE.md repo : CVE-2025-29927).

### Page admin `/admin/short-links`

- [ ] Tableau paginé : slug, targetUrl, UTM, clickCount, lastClickAt, status
- [ ] Filtre par tenant
- [ ] Modal "Créer un lien" :
  - Champ URL cible (validation URL)
  - Champ slug (auto-suggéré depuis URL ou manuel, validation unicité live)
  - Dropdowns UTM (utm_source standardisé : linkedin, newsletter, qrcode, email, partner, etc.)
  - Bouton "Créer + copier"
- [ ] Page détail `/admin/short-links/[id]` :
  - Stats : graphe clics par jour (echarts), top referers, top pays
  - Édition inline UTM / targetUrl
  - Bouton "Désactiver"
- [ ] Action "Copier le lien" inline sur chaque row avec feedback toast

### Sous-domaine `lnk.veridian.site`

- [ ] DNS Cloudflare : CNAME `lnk.veridian.site` → `analytics.app.veridian.site` (proxied via CF)
- [ ] Next.js `middleware.ts` : si Host = `lnk.veridian.site` → rewrite `/r/[slug]` (la route est déjà sur le même Next.js standalone, mais le sub-domain doit servir uniquement /r/* — pas d'admin accessible publiquement)
- [ ] CSP headers : autoriser les redirects 302 cross-domain

### Page 404 user-friendly

`app/r/[slug]/not-found.tsx` :
- Illustration sympa (réutiliser une SVG existante Veridian)
- "Ce lien a expiré ou n'existe pas"
- CTA "Visiter veridian.site"
- Tone Veridian (pas trop corporate)

## Tests obligatoires

- [ ] `tests/admin/short-links/api.test.ts` (vitest) : CRUD endpoints + auth + validation
- [ ] `tests/admin/short-links/page.test.tsx` (vitest + RTL) : rendu liste + modal create
- [ ] `tests/r-redirect.test.ts` : slug exist → 302 + UTM injectés ; slug missing → 404 ; slug expired → 404
- [ ] `tests/r-click-tracking.test.ts` : 1 GET = 1 ShortLinkClick + clickCount++
- [ ] Playwright e2e `tests/e2e/url-shortener.spec.ts` : créer un lien via admin → ouvrir le lien → voir le compteur incrémenté

## Husky / coverage

```yaml
- sources:
    - app/r/[slug]/route.ts
    - app/admin/short-links/page.tsx
    - app/api/admin/short-links/route.ts
    - app/api/admin/short-links/[id]/route.ts
    - app/api/admin/short-links/[id]/stats/route.ts
    - lib/short-links.ts
  covered_by:
    - tests/r-redirect.test.ts
    - tests/r-click-tracking.test.ts
    - tests/admin/short-links/api.test.ts
    - tests/admin/short-links/page.test.tsx
    - tests/e2e/url-shortener.spec.ts
```

## Status

✅ **done** — 2026-05-21

Livraison :
- PR : https://github.com/Christ-Roy/veridian-analytics/pull/17 (branche `feat/D1-url-shortener`)
- Commit principal : `feat: D1 URL shortener interne (lnk.veridian.site)`
- CI locale verte : tsc + 302 tests vitest (dont 38 nouveaux) + audit prod + build
- DNS Cloudflare : CNAME `lnk.veridian.site -> analytics.app.veridian.site` créé (proxied) via API CF
- test-coverage-map.yaml mis à jour pour couverture des 4 sources critiques

Fichiers livrés :
- `prisma/schema.prisma` (+ `ShortLink` + `ShortLinkClick`, relations User/Tenant)
- `lib/short-links.ts` (helpers purs + cache `unstable_cache` 60s)
- `app/r/[slug]/route.ts` + `app/r/[slug]/not-found/page.tsx`
- `app/api/admin/short-links/{,*}` (list/create, [id] CRUD, [id]/stats)
- `app/admin/short-links/{,*}` (page liste avec tableau/filtre tenant/modal create, page [id] avec Sparkline + top referers/pays + editor inline)
- `middleware.ts` (rewrite `Host=lnk.veridian.site/<slug> -> /r/<slug>` ; racine -> redirect `veridian.site`)
- `tests/unit/short-links{,-admin-api,-redirect}.test.ts` + `tests/e2e/12-url-shortener.spec.ts`

Reste à faire post-merge :
- `prisma db push` en prod (déclenché auto par la CI sur main)
- Smoke test : créer un lien dans `/admin/short-links` -> hit `lnk.veridian.site/<slug>` -> vérifier 302 + click compté

## Notes pour l'agent qui pick

- **Repo legacy** : `~/Bureau/veridian-platform/veridian-analytics` (Next.js 15 App Router)
- Pas d'attente sur les autres tickets — peut être livré JOUR 1 et déjà utilisé par Robert
- **Sécurité** : rate limit sur `/r/[slug]` (anti-scraping abusif) — 60 req/min/IP suffisant
- **Performance** : la route `/r/[slug]` est hit en boucle (potentiellement 1000 req/min en cas de viralité). Mettre un cache Redis OU `unstable_cache` Next.js sur le lookup slug → targetUrl (60s TTL, invalidé sur PATCH)
- **Migration future** : quand staminads sera la stack analytics principale, le shortener peut aussi y migrer (table ClickHouse pour les clicks, table Postgres bridge pour les ShortLinks). V2.

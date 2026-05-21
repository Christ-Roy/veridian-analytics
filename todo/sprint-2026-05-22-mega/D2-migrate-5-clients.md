# [D2] Migration des 5 clients prod vers staminads + dual-tracking

> **Repo cible** : `veridian-analytics-engine` (script + opération) + sites clients (PR snippet)
> **Branche** : `feat/D2-migrate-5-clients`
> **Charge** : 6h
> **Dépend de** : A1 + A2 + A3 + B1 livrés + visitor_id patch staminads Phase 2 livré
> **Bloque** : J+30 → cutover legacy (ticket session S3 du SPRINT.md)

---

## But

Provisionner les workspaces staminads pour les 5 clients prod, poser le snippet staminads sur leurs sites EN PARALLÈLE du tracker legacy, observer la cohérence pendant 30j via dashboard `/admin/migration-diff`.

## Spec

### Les 5 clients à migrer

| Slug | Domain | PV 30j legacy | Hosting |
|---|---|---|---|
| avse-monetique | avse-monetique.veridian.site | 1504 | Veridian-hosted |
| morel-volailles-com | morel-volailles.com | 674 | Veridian-hosted |
| robert-deboucheur | robert-deboucheur.fr | 270 | Veridian-hosted |
| tramtech-depannage-fr | tramtech-depannage.fr | 87 | Externe (Tramtech client) |
| arnaudcapitaine-com | arnaudcapitaine.com | 0 | Externe (Arnaud client) |

### Étapes

#### 1. Provisionning workspaces staminads (1h)

Script **`scripts/migrate-existing-tenants.ts`** côté `veridian-analytics-engine` :
- Lit les 5 sites depuis `veridian-core-db.analytics.Site` (read-only legacy)
- Pour chaque site :
  - Appelle `POST <bridge>/api/admin/provision-existing-tenant` (endpoint à créer dans ce ticket)
  - Sauvegarde le mapping `siteKey → staminadsWorkspaceId + staminadsApiKey` dans BDD bridge
  - Génère le snippet à coller (avec workspaceId + visitor_id activé)
- Output : fichier `out/snippets-by-site.md` avec snippet par client

#### 2. Endpoint bridge `POST /api/admin/provision-existing-tenant`

À ajouter dans `veridian-bridge/src/app.ts` :
- Input : `{ siteKey, slug, domain, visitorIdEnabled: true }`
- Output : `{ workspaceId, apiKey, snippet, dashboardUrl }`
- Idempotent : si workspace existe déjà pour ce siteKey → retourne le mapping existant

#### 3. Pose des snippets côté sites (3-4h)

**Sites Veridian-hosted (3)** :
- [ ] `morel-volailles.com` : PR sur le repo du site (à identifier — probablement `Christ-Roy/morel-volailles-com` ou similaire). Ajouter `<script>` staminads dans `<head>` du layout, garder le legacy
- [ ] `avse-monetique.veridian.site` : idem
- [ ] `robert-deboucheur.fr` : idem

**Sites externes (2)** :
- [ ] `tramtech-depannage.fr` : email à Tramtech (via Robert) avec snippet à coller dans le `<head>` de leur thème WordPress (à confirmer le CMS)
- [ ] `arnaudcapitaine.com` : idem, email à Arnaud

#### 4. Validation immédiate

Pour chaque site, après la pose :
- [ ] Ouvrir le site dans Chrome MCP (mode incognito pour pas de cache)
- [ ] Vérifier console navigateur : 0 erreur JS, les 2 trackers tirent en // (`/api/ingest/pageview` legacy + `/track` staminads)
- [ ] Vérifier en BDD staminads que le pageview arrive bien sur le bon workspace

#### 5. Dashboard `/admin/migration-diff`

(Probablement à câbler dans le ticket C2 ou comme sous-ticket de D2)

`app/admin/migration-diff/page.tsx` côté legacy `veridian-analytics` :
- Tableau par tenant × N jours :
  - Colonne pageviews_legacy (depuis Postgres legacy)
  - Colonne pageviews_staminads (depuis ClickHouse via bridge)
  - Colonne écart absolu
  - Colonne écart % (couleurs feu : vert <5%, jaune 5-10%, rouge >10%)
- Graphe temporel (echarts) par tenant avec ces 2 lignes
- Refresh automatique toutes les 60s
- Bouton "Investiguer" → page détail qui pointe les écarts spécifiques

#### 6. Migration data historique (optionnel V1)

Si on veut garder l'historique GSC/Forms côté staminads :
- [ ] Script `scripts/migrate-gsc-history.ts` : dump `analytics.GscDaily` legacy → import bridge `gsc_daily` Postgres
- [ ] Script `scripts/migrate-forms-history.ts` : dump FormSubmission + Lead legacy → import bridge tables
- [ ] **PAS de migration Pageview/SipCall** : staminads démarre à J0 (décision Robert)

### Alerting

Configurer alerte Telegram si écart > 10% pendant 3 jours consécutifs sur n'importe quel tenant :
- Cron quotidien lit le diff
- Si seuil dépassé → message via le système monitoring Veridian existant (cf. `dokploy-traefik` monitoring)

## Tests obligatoires

- [ ] `veridian-bridge/tests/provision-existing-tenant.test.ts` : idempotence, payload correct
- [ ] `tests/migrate-script.test.ts` (côté engine) : script `migrate-existing-tenants.ts` parsé OK + dry-run OK
- [ ] Validation manuelle Chrome MCP pour chaque site (pas de test automatique e2e — c'est sur des sites externes)

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/admin/provision-existing-tenant.ts
    - scripts/migrate-existing-tenants.ts
    - scripts/migrate-gsc-history.ts
    - scripts/migrate-forms-history.ts
  covered_by:
    - veridian-bridge/tests/provision-existing-tenant.test.ts
    - tests/migrate-script.test.ts
```

## Status

⏳ pending

## Notes pour l'agent qui pick

- **Bloqué tant que A1+A2+A3+B1 pas livrés ET visitor_id patch staminads Phase 2 pas livré**
- En attendant, l'agent peut commencer par **préparer les scripts** et lister les contacts clients externes (tramtech, arnaud)
- **Communication clients externes** : Robert valide les emails AVANT envoi (sensibilité)
- **PR sites Veridian-hosted** : à coordonner avec leur agent ou Robert si pas d'agent dédié
- **30 jours d'observation** avant cutover legacy (ticket session S3)
- Tag git `v0.3.0-dual-tracking-live` à la fin de ce ticket

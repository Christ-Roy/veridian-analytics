# Dépose du repo legacy `veridian-analytics`

> **Sévérité** : 🟢 P2 — pas urgent, planifié quand conditions remplies
> **Owner** : Robert tranche, agent ops exécute
> **Créé** : 2026-05-23
> **Décision** : Robert le 2026-05-23 : *"on va dégager le repo legacy à terme sois pas timide"*

## Vision

Le repo `veridian-analytics` (Next.js / Auth.js / Prisma / Postgres) est **condamné**.
La stack analytics commercialisée vit désormais dans `veridian-analytics-engine`
(fork staminads + bridge Express + ClickHouse + Postgres).

Pas de plan de maintien parallèle long terme. À terme : **dépose complète**.

## Conditions de dépose (gates)

Avant de pouvoir archiver le legacy, vérifier :

- [ ] **D2 — Migration 5 clients exécutée** : scripts dans `veridian-analytics-engine/scripts/migration/` testés en dry-run, puis `--apply` avec validation Robert. Les 5 clients tournent sur engine, leurs sites pointent sur le nouveau tracker, dual-tracking pendant 30j minimum avant cutover.
- [ ] **DNS** : `analytics.app.veridian.site` retiré OU bascule vers engine
- [ ] **Hub provisioning** : `Christ-Roy/veridian-hub/lib/analytics/*` ne pointe plus sur le bridge legacy. Tous les appels Hub → bridge passent par `analytics-engine-bridge.app.veridian.site`.
- [ ] **URL shortener `lnk.veridian.site` (D1)** : décision Robert :
  - Option A : porter vers engine
  - Option B : externaliser (Cloudflare Workers / autre service)
  - Option C : dégager (Robert décide qu'on n'en a plus besoin)
- [ ] **Aucun client critique ne dépend du legacy** (vérif via logs Traefik prod : trafic résiduel sur `analytics.app.veridian.site` ?)
- [ ] **Backup R2 final** : dernier dump Postgres + ClickHouse legacy poussé sur R2 avec rétention 90j minimum

## Procédure de dépose (quand conditions OK)

1. **Tag final** : `git tag legacy-final-snapshot && git push origin legacy-final-snapshot`
2. **Stack Dokploy** : `compose-synthesize-virtual-transmitter-i9bv43` → `compose.delete` via API Dokploy + cleanup volumes + cleanup réseau
3. **Container** : suppression `compose-synthesize-virtual-transmitter-i9bv43-analytics-prod-1`
4. **DB legacy** : dump final sauvegardé sur R2, puis drop Postgres
5. **DNS** : retirer `analytics.app.veridian.site` du Cloudflare (ou rediriger 301 vers engine si SEO important)
6. **GHCR** : conserver les images `ghcr.io/christ-roy/analytics:*` un temps (rétention 90j) puis prune
7. **Repo GitHub** :
   - PR finale qui ajoute un README "ARCHIVED — see veridian-analytics-engine"
   - Repo passé en **archive** (Settings → Archive this repository) — read-only, plus aucun push possible
8. **Worktree local** : `rm -rf ~/Bureau/veridian-platform/veridian-analytics`
9. **MONOREPO-LINKS.md** racine : retirer la ligne `veridian-analytics`
10. **CLAUDE.md racine `veridian-platform/`** : retirer `veridian-analytics` du tableau "Les apps"
11. **Memory clean** : marquer dans MEMORY.md que les memories legacy sont obsolètes

## Risques

- **Trafic résiduel** : un client oublié qui pointe encore son tracker sur l'ancien endpoint → erreur silencieuse. Mitigation : monitor logs Traefik pendant 30j minimum après bascule DNS.
- **Hub qui consomme encore l'API legacy** : grep `analytics.app.veridian.site` dans le repo Hub pour confirmer 0 occurrence avant dépose.
- **Données historiques perdues** : R2 backup final OBLIGATOIRE avant drop DB.

## Ce qui ne sera PAS porté

- Page admin Robert (`app/admin/page.tsx`) — Robert : pas besoin en V1
- Forms / Leads / LeadSession (ingestion personnalisée) — remplacé par les goals staminads natifs
- PWA / Push notifications — archivé sous `_archive/` côté engine, peut-être pas réactivé jamais

## Tickets liés

- `D2-migrate-5-clients.md` (gate principal)
- `D1-url-shortener.md` (PR #17 du legacy — à trancher)
- Side : voir si `lnk.veridian.site` doit déménager

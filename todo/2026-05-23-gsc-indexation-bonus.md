# A4-V2 — Bonus GSC : indexation des pages

> **Sévérité** : 🟢 P2 — bonus business demandé par Robert mais pas bloquant V1
> **Owner** : agent bridge analytics-engine
> **Créé** : 2026-05-23 (issu du rapport ui-polish-core)

## Contexte

Robert le 2026-05-23 : *"avoir ce que gsc peux nous apprendre en plus du dashboard, genre les mots clé de recher le ranking des pages **l'indexation des pages** et c'est tout"*.

Les 2 premiers sont livrés (mots-clés + ranking via le port des composants GSC legacy). **L'indexation des pages n'est pas exposée** par le bridge actuel.

## Spec

Étendre `veridian-bridge/src/gsc/query.ts` (ou créer `indexation.ts`) qui consomme l'API Google Search Console **URL Inspection** :

- Endpoint Google : `POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect`
- Body : `{ inspectionUrl, siteUrl, languageCode }`
- Réponse contient `indexStatusResult` avec :
  - `verdict` : `PASS | PARTIAL | FAIL | NEUTRAL`
  - `coverageState` : "Submitted and indexed" / "Crawled - currently not indexed" / "Discovered - currently not indexed" / etc.
  - `robotsTxtState` : `ALLOWED | DISALLOWED | DISALLOWED_OR_INDEXED`
  - `indexingState` : `INDEXING_ALLOWED | BLOCKED_BY_META_TAG | BLOCKED_BY_HTTP_HEADER`
  - `lastCrawlTime`
  - `pageFetchState`

## Endpoint bridge à créer

`GET /api/admin/tenant/:wsId/gsc/indexation?urls=...` → batch inspection (max 50 URLs par call pour respecter les quotas Google).

OU plus simple : `GET /api/admin/tenant/:wsId/gsc/indexation?days=30` qui regarde les pages top du site (extraites des analytics staminads) et inspecte leur indexation, retourne un tableau récap par état.

## UI à câbler

Dans `console/src/veridian/gsc/performance-dashboard.tsx` (déjà porté) :
- Ajouter un onglet "Indexation" à côté de "Mots-clés" et "Pages"
- Tableau : URL / Statut indexation (badge couleur) / Dernière crawl / Action ("Forcer la réindexation" → call API Google Indexing API)

## Quotas Google

Attention : URL Inspection API limite à **2000 requêtes/jour par projet OAuth**. Donc on cache côté bridge (1 cache 7j minimum par URL), et on ne re-inspecte que les top pages (pas tout le site).

## Tests E2E à ajouter

`tests/e2e/05-gsc-oauth/indexation-mock.spec.ts` — mock l'API Google, vérifier que le bridge expose correctement, que l'UI affiche les badges.

## Tickets liés

- `A4-gsc-integration-port.md` (parent, déjà ✅ pour mots-clés + ranking)

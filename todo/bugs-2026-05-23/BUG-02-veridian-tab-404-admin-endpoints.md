# [BUG-02] Onglet "Veridian" du dashboard démo affiche "ERREUR 404 · NOT FOUND" — endpoints admin manquants

> **Sévérité** : 🔴 P0 (la feature "Veridian" est la VALEUR AJOUTÉE de Veridian Analytics vs staminads natif — cassée en démo publique = aucune démo possible)
> **Cible** : démo prod + démo staging
> **URL exacte** : https://demo-analytics.veridian.site/veridian/dashboard/demo-apple
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/ → cliquer "Ouvrir la démo"
> 2. Dans la nav, cliquer sur l'onglet "Veridian"
> 3. La page affiche en gros : "Données indisponibles / Ce workspace n'a pas encore été provisionné côté analytics / Lancez l'installation du tracker pour démarrer / ERREUR 404 · NOT FOUND / [Réessayer]"

## Symptôme observé

La page `/veridian/dashboard/demo-apple` qui doit afficher le Score Veridian, le Status
tenant, le Shadow Marketing, Forms, GSC, Push, Calls (la valeur ajoutée Veridian par-dessus
staminads natif) **ne montre QUE le message d'erreur** :

> Données indisponibles
>
> Ce workspace n'a pas encore été provisionné côté analytics. Lancez l'installation du
> tracker pour démarrer.
>
> ERREUR 404 · NOT FOUND
> [Réessayer]

Le bouton "Réessayer" refait la même requête, même 404 → boucle.

## Network (échec sur 3 endpoints)

```
GET https://demo-analytics.veridian.site/api/admin/tenant/demo-apple/score        → 404
GET https://demo-analytics.veridian.site/api/admin/tenant/demo-apple/status       → 404
GET https://demo-analytics.veridian.site/api/admin/shadow-marketing               → 404
```

Aucun de ces endpoints n'existe côté backend. Le frontend (route `/veridian/dashboard/:wsId`)
les appelle, n'importe lequel échoue → le composant affiche le fallback "ERREUR 404 / NOT FOUND".

## Comportement attendu

Sur la démo publique :
- L'onglet "Veridian" devrait afficher des **données générées** (comme le reste du dashboard
  démo) pour montrer la valeur Veridian — score, status, shadow marketing, forms leads, GSC,
  push, calls, le tout avec données fake mais cohérentes
- Au pire (si les endpoints n'existent pas encore), afficher un **état "Bientôt disponible"**
  propre, pas un "ERREUR 404 NOT FOUND" qui crie "site cassé"

Sur les vrais tenants client (prod) :
- Les endpoints doivent exister et retourner les vraies données

## Hypothèse cause

Les tickets du sprint mega 2026-05-22 (A1-score-veridian-port, A2-tenant-status-port,
A3-shadow-marketing-port, A4-gsc-integration-port, B1-forms-leads-port, B2-push-pwa-port,
U9-calls-tab-auth-misc) sont en cours mais **les endpoints `/api/admin/tenant/*` n'ont pas
encore été câblés côté analytics-engine** (ils existent peut-être dans le repo legacy
veridian-analytics mais pas dans le repo engine forké).

Le composant React qui consomme ces endpoints a probablement été porté avant que les
endpoints soient livrés → 404 systématique.

## Suggestion fix

**Court terme (démo)** :
- Soit afficher un état "Coming soon" propre sur l'onglet Veridian quand `is_demo: true`
- Soit servir des données fake hardcodées pour `demo-apple` côté backend, exposées sans auth

**Durable** :
- Implémenter les endpoints côté analytics-engine :
  - `GET /api/admin/tenant/:wsId/score` → score Veridian (cf ticket A1)
  - `GET /api/admin/tenant/:wsId/status` → status d'install (cf ticket A2)
  - `GET /api/admin/shadow-marketing` → shadow marketing global (cf ticket A3)
- Ajouter un E2E smoke `tests/e2e/veridian-tab-demo.spec.ts` qui :
  - Visite la démo
  - Click sur onglet Veridian
  - Assert que `[data-error]` ou "ERREUR 404" n'est PAS présent
  - Assert qu'au moins un H1/H2 attendu est présent (ex: "Score", "Status")

## Voir aussi

- `todo/sprint-2026-05-22-mega/A1-score-veridian-port.md`
- `todo/sprint-2026-05-22-mega/A2-tenant-status-port.md`
- `todo/sprint-2026-05-22-mega/A3-shadow-marketing-port.md`

## Status

✅ FIXÉ 2026-05-23 par `fix/demo-veridian-bugs` (engine SHA `0ef2754`, PR
[#2](https://github.com/Christ-Roy/veridian-analytics-engine/pull/2)).

Méthode retenue : court-terme « Coming soon » côté console plutôt que
cabling bridge.

Raison : tenter d'ajouter le service `bridge` au compose démo se heurte
à 2 blocages architecturaux que l'agent a découverts en faisant le
terrain :

1. `auth.login` bridge → engine échoue sur la démo. `setupCompleted=true`
   est atteint via le seed du `demo@veridian.site` mais aucun super-admin
   classique n'existe avec un mot de passe utilisable. Le bridge boucle
   au boot.
2. Drift d'API : le bridge appelle `analytics.query` avec
   `dateRange: { type: 'last_30_days' }` mais l'engine n'accepte que
   `dateRange: { preset: 'previous_30_days' }`. Réponse 400 systématique
   même avec un token valide.

Les deux sont solvables (patch bridge + nouvelle image + bootstrap
admin), mais c'est ~½ journée de boulot pour une démo. Le ticket
autorise explicitement l'option « court terme = état Coming soon
propre » — c'est ce qu'on ship.

Changements :

- `console/src/veridian/demo-coming-soon.tsx` : nouveau composant
  preview brandé (Score / Services / Shadow Marketing) + CTA mailto.
- `console/src/veridian/pages/dashboard.tsx` : gate `isDemo`
  short-circuite tout fetch bridge.
- `compose/demo.yml` : doc inline du choix.
- Test vitest `console/src/veridian/__tests__/demo-coming-soon.test.tsx`
  pour verrouiller le gate (aucun fetch ne part en démo).

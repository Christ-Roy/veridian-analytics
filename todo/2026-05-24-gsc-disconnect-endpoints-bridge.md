# Bridge — endpoints DELETE GSC + expose gscPropertyId

> **Sévérité** : 🟡 P1 — boutons Resync/Déconnecter du panel Search Console
> sont best-effort (404 silencieux possibles)
> **Détecté** : 2026-05-23 par agent ui-native-pure
> **Owner** : agent bridge analytics-engine

## Problème

Le panel `console/src/veridian/settings-panels/search-console-panel.tsx`
(SHA `43aa4d4`) affiche 2 boutons :
- "Resynchroniser maintenant"
- "Déconnecter"

Mais le bridge n'expose PAS :
1. Un endpoint `DELETE /api/admin/tenant/:wsId/gsc` ou
   `DELETE /api/admin/gsc/property/:propertyId` pour déconnecter
2. Le `gscPropertyId` dans la réponse `GET /api/admin/tenant/:wsId/settings`
   ou `GET /api/admin/tenant/:wsId/gsc`

Conséquence : les boutons sont best-effort (un appel HTTP qui peut 404
silencieusement). UX dégradée si le user clique "Déconnecter" et rien
ne se passe.

## Action attendue

Côté bridge (`veridian-bridge/src/gsc/`) :
1. Étendre la réponse de l'endpoint `/api/admin/tenant/:wsId/gsc` pour
   inclure `propertyId` (et stat de la dernière sync)
2. Créer `DELETE /api/admin/tenant/:wsId/gsc/property/:propertyId` qui :
   - Supprime la `GscProperty` row (cascade `GscDaily`)
   - Optionnel : révoque le token OAuth Google côté Google
   - Retourne `{ deleted: true }`
3. Documenter dans le contrat API et `CONTRAT-HUB.md` si pertinent

Côté UI : adapter le panel pour utiliser ces endpoints et donner du
feedback utilisateur (toast "Search Console déconnectée").

Tests E2E à ajouter : `tests/e2e/05-gsc-oauth/property-disconnect.spec.ts`

# Enrichir Explore staminads avec dimension event_name=phone_call

> **Sévérité** : 🟡 P1 — UX
> **Détecté** : 2026-05-23 par agent ui-native-pure (reco post-livraison)
> **Owner** : agent bridge / staminads upstream

## Problème

Depuis la refonte UI native pure (SHA `43aa4d4`), les appels VoIP sont
poussés comme **events staminads custom** (`goal: phone_call`) via
`pushStaminadsEvents()` dans `veridian-bridge/src/voip/sync.ts`.

Ces events apparaissent automatiquement dans Live + Goals, MAIS dans
**Explore** ils sont accessibles uniquement via un filtre URL hack
(query param manuel). Un utilisateur normal ne va pas savoir filtrer.

## Action attendue

Enrichir le composant `console/src/components/explore/ExploreFilterBuilder.tsx`
(ou équivalent staminads) pour exposer `event_name=phone_call` comme :
- Une dimension first-class dans le sélecteur de dimensions
- Un filtre suggéré avec un label "Appels téléphoniques" (FR)
- Possiblement une preset breakdown `direction` + `status` + `duration_sec`
  pour analyse rapide

## Lien

Le panel VoIP dans Settings affiche déjà un lien "Voir dans Explore" qui
pré-filtre avec ce query param. C'est un hack que cet enrichissement
remplacerait proprement.

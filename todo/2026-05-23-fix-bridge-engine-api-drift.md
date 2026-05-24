# Drift API bridge ↔ engine staminads (dateRange + bootstrap admin)

> **Sévérité** : 🟡 P1 — fonctionnel en prod par hasard, fragile à révéler
> **Détecté** : 2026-05-23 par agent fix-demo-veridian (BUG-02)
> **Cause racine** : nos endpoints bridge envoient un payload au format ancien staminads

## Symptômes

1. **Drift dateRange** : le bridge envoie `dateRange:{type:'last_30_days'}` à `/api/analytics.query`. L'engine staminads accepte uniquement `dateRange:{preset:'previous_30_days'}`. Résultat : 400 systématique quand le bridge query l'engine.

2. **Bootstrap admin** : `setup.status` répond `setupCompleted:true` car un user `demo@veridian.site` existe en seed. Mais aucun super-admin avec un password utilisable → le bridge ne peut pas faire `auth.login` au boot → crashloop si forcé.

## Pourquoi ça marche en staging/prod ?

Probablement : l'admin `admin@veridian.site` créé par hotfix-bug-01 a un password valide, donc le bridge peut s'authentifier. Mais le drift `dateRange` casse silencieusement certaines queries — les endpoints `/api/admin/tenant/:wsId/score` etc. peuvent renvoyer des 0 ou des données vides au lieu d'une erreur, masquant le bug.

## À investiguer

- [ ] Lire `veridian-bridge/src/staminads-client.ts` (ou équivalent) pour voir ce qui est envoyé
- [ ] Comparer avec ce qu'accepte l'engine staminads upstream (cf code `api/src/analytics/`)
- [ ] Bumper le bridge pour utiliser le format `preset:` correctement
- [ ] Vérifier que le bootstrap admin se fait via une méthode unique cross-env (prod + staging + démo)

## Ticket lié

- BUG-02 (résolu par placeholder `VeridianDemoComingSoon`, mais la vraie feature reste indisponible en démo tant que ce drift n'est pas fixé)

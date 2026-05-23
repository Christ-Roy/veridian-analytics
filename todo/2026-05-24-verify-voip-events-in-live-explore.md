# Vérifier que les events phone_call apparaissent dans Live/Explore après cron VoIP

> **Sévérité** : 🟢 P2 — vérification post-livraison
> **Détecté** : 2026-05-23 par agent ui-native-pure
> **Owner** : Robert (vérif manuelle) ou agent ops

## Contexte

Depuis le SHA `43aa4d4`, `pushStaminadsEvents()` dans
`veridian-bridge/src/voip/sync.ts` pousse un goal staminads `phone_call`
pour chaque `SipCall` synchronisé. Tests d'intégration ajoutés (push
réussi + fail-soft staminads down).

**MAIS** : aucun tenant prod n'a encore connecté de provider VoIP réel.
Le cron `voip-sync-cron.yml` tourne mais ne trouve aucun tenant à syncer.

## Action attendue (V1)

Quand un premier client connecte OVH/Telnyx :

1. Vérifier que `SipCall` rows apparaissent en bridge Postgres
2. Vérifier dans staminads ClickHouse :
   ```sql
   SELECT * FROM staminads.events
   WHERE event_name='phone_call' AND workspace_id='<wsId>'
   ORDER BY timestamp DESC LIMIT 10;
   ```
3. Ouvrir `https://analytics-engine.app.veridian.site/workspaces/<wsId>/live`
   pendant un appel test → l'event doit apparaître quasi-temps réel
4. Ouvrir `/explore?filters=event_name=phone_call` → table avec breakdown

## Si problème

Si les events n'apparaissent pas :
- Vérifier les logs bridge `docker logs analytics-engine-prod-gkggyk-bridge-1` au passage du cron
- Tester `pushStaminadsEvents()` à la main avec un payload custom
- Vérifier que l'event format respecte le schéma staminads (track endpoint `POST /api/track`)

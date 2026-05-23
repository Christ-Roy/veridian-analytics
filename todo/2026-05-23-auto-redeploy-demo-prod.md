# Auto-redeploy démo prod sur push main

> **Sévérité** : 🟢 P2 — drift silencieux possible entre prod console et démo
> **Détecté** : 2026-05-23 par agents fix-demo-veridian + fix-blank-pages
> **Cible** : `compose-veridian-analytics-demo` (`composeId=EJStDafXYQoLtiAqrjsvZ`)

## Problème

Le `Prod CI/CD` sur push main rebuild les images mais redéploie uniquement la stack engine prod (`compose-synthesize-virtual-transmitter-i9bv43` ou `RH8yiQGFLxTzVXtrvlNmB`). **La démo prod n'est PAS redéployée** automatiquement.

Conséquence : chaque fix UI doit être propagé manuellement en démo via :
```bash
DKEY=$(grep DOKPLOY_API_KEY ~/credentials/.all-creds.env | cut -d= -f2)
curl -sf -H "x-api-key: $DKEY" -X POST -d '{"composeId":"EJStDafXYQoLtiAqrjsvZ"}' \
  https://dokploy.veridian.site/api/compose.deploy
# + ssh prod-pub 'docker compose pull && docker compose up -d engine' si tag string inchangé
```

## Cause

Le compose démo est pinné sur `ENGINE_IMAGE_TAG=staging-latest`. Quand on push staging → image GHCR `staging-latest` mise à jour, mais Dokploy n'a pas de webhook qui trigger la démo.

## Fix attendu

Ajouter dans `.github/workflows/staging-deploy.yml` (post étage 3 deploy staging) :

```yaml
trigger-demo-redeploy:
  needs: deploy-staging
  runs-on: ubuntu-latest
  steps:
    - name: Trigger demo prod redeploy
      env:
        SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
        DEMO_COMPOSE_ID: EJStDafXYQoLtiAqrjsvZ
      run: |
        ssh -i ... prod-pub <<DEPLOY
          DKEY=\$(grep DOKPLOY_API_KEY ~/credentials/.all-creds.env | cut -d= -f2)
          # Pull nouvelle image
          docker pull ghcr.io/christ-roy/veridian-analytics-engine:staging-latest
          # Recreate engine container (force le pull effectif vu que le tag string ne change pas)
          cd /etc/dokploy/compose/compose-generate-digital-application-lwui4c/code/
          docker compose pull engine && docker compose up -d engine
        DEPLOY
```

## Anti-régression

Test E2E qui compare le SHA de l'image engine entre prod et démo après chaque push main → si différent > 24h, alerter.

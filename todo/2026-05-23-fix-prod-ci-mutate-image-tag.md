# Prod CI/CD doit muter ENGINE_IMAGE_TAG / BRIDGE_IMAGE_TAG avant deploy

> **Sévérité** : 🔴 P1 — chaque deploy prod nécessite intervention manuelle, drift silencieux possible
> **Détecté** : 2026-05-23 par agent fix-upstream-branding
> **Cible** : `.github/workflows/prod-ci.yml` step `deploy-prod`

## Problème

Le workflow build une image `ghcr.io/christ-roy/veridian-analytics-engine:prod-{SHA}` à chaque push main. **Mais** dans le compose Dokploy `RH8yiQGFLxTzVXtrvlNmB` (analytics-engine-prod), l'env est figé sur `ENGINE_IMAGE_TAG=prod-981bc93` (le SHA du premier deploy).

Conséquence : `compose.deploy` API → Dokploy pull `ghcr.io/...:prod-981bc93` (l'ancien), pas la nouvelle image. **Le deploy ne fait rien.**

Reproduction observée :
- Push `703e99e` sur main → image `prod-703e99e` buildée + poussée GHCR ✓
- `Prod CI/CD` deploy-prod → `compose.deploy` lancé
- Container `analytics-engine-prod-gkggyk-engine-1` reste sur l'ancien build
- L'agent a dû `curl POST /api/compose.update` à la main pour passer `ENGINE_IMAGE_TAG=prod-703e99e`

## Fix attendu

Dans `.github/workflows/prod-ci.yml`, job `deploy-prod`, AVANT le `compose.deploy` :

```yaml
- name: Update Dokploy env ENGINE_IMAGE_TAG + BRIDGE_IMAGE_TAG
  env:
    SSH_KEY: ${{ secrets.DEPLOY_SSH_KEY }}
    VPS_HOST: ${{ vars.PROD_VPS_HOST }}
    VPS_USER: ${{ vars.PROD_VPS_USER }}
    DOKPLOY_COMPOSE_ID: ${{ vars.ANALYTICS_DOKPLOY_COMPOSE_ID }}
    SHA: ${{ github.sha }}
  run: |
    SHORT_SHA="${SHA:0:7}"
    ssh -i ~/.ssh/deploy_key "$VPS_USER@$VPS_HOST" bash <<DEPLOY
      DKEY=\$(grep '^DOKPLOY_API_KEY=' ~/credentials/.all-creds.env | cut -d= -f2)
      # Récup env actuel, patch les 2 lignes IMAGE_TAG, repush
      CURRENT_ENV=\$(curl -sf -H "x-api-key: \$DKEY" \
        "http://localhost:3000/api/compose.one?composeId=$DOKPLOY_COMPOSE_ID" | jq -r .env)
      NEW_ENV=\$(echo "\$CURRENT_ENV" \
        | sed "s/^ENGINE_IMAGE_TAG=.*/ENGINE_IMAGE_TAG=prod-\$SHORT_SHA/" \
        | sed "s/^BRIDGE_IMAGE_TAG=.*/BRIDGE_IMAGE_TAG=prod-\$SHORT_SHA/")
      curl -sf -X POST -H "x-api-key: \$DKEY" -H "Content-Type: application/json" \
        -d "{\"composeId\":\"$DOKPLOY_COMPOSE_ID\", \"env\":\"\$NEW_ENV\"}" \
        http://localhost:3000/api/compose.update
    DEPLOY

- name: Trigger Dokploy redeploy
  # ... existant ...
```

## Anti-régression

Test E2E qui vérifie que le SHA de l'image active dans prod = SHA du dernier commit main, avec une tolérance de 5 minutes après le run `Prod CI/CD`.

## Lié

- Ticket `2026-05-23-auto-redeploy-demo-prod.md` (même pattern pour la démo)

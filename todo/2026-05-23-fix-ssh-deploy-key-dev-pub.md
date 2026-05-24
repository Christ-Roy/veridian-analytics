# Fix : clé SSH `staging-deploy@37.187.199.185` rejetée par dev-pub

> **Sévérité** : 🔴 P0 — bloque tout deploy staging analytics-engine
> **Owner** : agent infra ou Robert
> **Créé** : 2026-05-23

## Contexte

Sur la CI Staging CI/CD du repo `veridian-analytics-engine`, l'étage 3
`deploy-staging` échoue systématiquement sur l'étape "Sync compose to
dev-pub" avec :

```
staging-deploy@37.187.199.185: Permission denied (publickey).
Process completed with exit code 255.
```

Run référence (2026-05-23 09:53) :
https://github.com/Christ-Roy/veridian-analytics-engine/actions/runs/26329624646

L'étage 5 rollback échoue avec exactement la même erreur SSH (même user,
même IP) — confirmation que c'est bien un problème côté clé/user.

## Diagnostic à faire

1. La GH Secret `DEPLOY_SSH_KEY` est-elle encore valide (pas de rotation
   sauvage récente) ?
2. Le user `staging-deploy` existe-t-il toujours sur dev-pub ?
3. La clé publique correspondante est-elle bien dans
   `~staging-deploy/.ssh/authorized_keys` sur dev-pub ?
4. Le `AllowUsers` sshd_config inclut-il `staging-deploy` ?

À investiguer :

```bash
ssh dev-pub 'cat ~staging-deploy/.ssh/authorized_keys 2>&1 | wc -l'
ssh dev-pub 'sudo grep AllowUsers /etc/ssh/sshd_config'
ssh dev-pub 'sudo tail -50 /var/log/auth.log | grep staging-deploy'
```

## Impact

- Tout push sur `staging` du repo `veridian-analytics-engine` bloque sur
  l'étage 3 deploy-staging
- Mes workflows E2E (`e2e-smoke-staging.yml`) qui dépendent du
  `workflow_run` success de Staging CI/CD ne se déclenchent JAMAIS tant
  que cette CI fail
- Échec connu depuis au moins le commit `feat(prod): compose/prod.yml`
  (run 26316630455 du 2026-05-22 23:20) — soit ~12h avant ma livraison

## Lien avec ce qu'on a livré aujourd'hui

L'agent E2E-BATTERY a livré la phase 1+2 de la batterie de tests (ticket
`sprint-2026-05-22-mega/E2E-TEST-BATTERY.md`), tout est mergé sur staging
(SHA b2c9e2f). Tant que cette clé SSH n'est pas réparée, on ne peut pas
**valider la suite E2E end-to-end** sur staging via la CI : les tests
écrits compilent en local (typecheck OK), pre-push 406 tests verts, build
images OK, mais le smoke staging et donc nos E2E smoke ne tournent pas.

## Workaround temporaire

Triggerer manuellement les workflows E2E via `gh workflow run` une fois
mergés sur main :

```bash
gh workflow run e2e-smoke-staging.yml --repo Christ-Roy/veridian-analytics-engine
gh workflow run e2e-full-staging.yml --repo Christ-Roy/veridian-analytics-engine
```

Mais c'est dégradé — la chaîne post-deploy reste cassée tant que le SSH
fonctionne.

## Action immédiate

Régénérer la GH Secret `DEPLOY_SSH_KEY` (nouvelle paire de clés ed25519),
push la nouvelle pub key dans `~staging-deploy/.ssh/authorized_keys` sur
dev-pub. Re-run le workflow `Staging CI/CD` du SHA actuel pour valider.

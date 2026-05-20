# [ANALYTICS] Ajouter boutons "Continuer avec Google + Microsoft" sur page login fallback

> **Type** : UX login fallback Analytics
> **Sévérité** : 🟦 P5 (quand Analytics passera en SaaS public)
> **Owner** : agent Analytics
> **Spec parent** : `veridian-hub/todo/2026-05-20-fallback-login-apps-redirect-hub.md`
> **Créé** : 2026-05-20

## Demande

Sur `analytics-engine.staging.veridian.site/login` et l'équivalent prod
quand Analytics sera public, ajouter 2 boutons "Continuer avec Google" +
"Continuer avec Microsoft" en plus du form login existant.

**Pas d'implémentation OAuth côté Analytics** — les boutons redirigent
simplement vers `app.veridian.site/login?next=<current_url>` et le Hub gère
le flow OAuth puis renvoie un magic link Analytics via le contrat HMAC.

## Pré-requis

- Analytics doit avoir un flow magic link cross-app implémenté (cf. ticket
  dormant `veridian-analytics/todo/2026-05-20-hub-integration-when-saas-launched.md`)
- Hub doit avoir livré le support `?next=` (Phase 2 ticket OAuth)

## Effort estimé

- 0.5j (UI + redirect)

## Référence

- Spec complète : `veridian-hub/todo/2026-05-20-fallback-login-apps-redirect-hub.md`

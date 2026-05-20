# [CROSS-APP] Intégration Hub OAuth + provisioning quand Analytics passe en SaaS public

> **Type** : Ticket cross-app dormant
> **Sévérité** : 🟦 P5 (réveille quand Analytics passe en SaaS multi-tenant public)
> **Owner principal** : agent Analytics
> **Owner secondaire** : agent Hub
> **Créé** : 2026-05-20

## Contexte

Analytics est aujourd'hui en mode **bring-your-own-key** (chaque client crée
ses propres credentials, pas de signup/auth via Hub). Pas de SSO Hub, pas
de billing Stripe centralisé, pas de provisioning via le contrat HMAC.

Quand Analytics passera en SaaS public (cf. CONTRAT-HUB.md roadmap), il
faudra le câbler au Hub comme les autres apps :
- Implémenter les 5 endpoints du contrat (`provision`, `attach-owner`,
  `suspend`, `resume`, `health`)
- Implémenter les webhooks app → Hub (5 événements)
- Câbler le flow d'invitation multi-membre via Hub (cf. ticket Prospection)
- Câbler OAuth Sign-in propagation (auto-login HMAC depuis Hub)
- Câbler Stripe metered subscription si pricing usage-based

## Pré-requis

- Décision business : Analytics multi-tenant SaaS public (pas tranchée 2026-05-20)
- Hub doit avoir livré le flow d'invitation cross-app (cf. ticket Prospection)
- Analytics doit avoir une vraie page de signup ou flow d'onboarding

## Effort estimé

- 5-7j câblage initial contrat HMAC
- 3-4j flow invitation + autologin
- 2-3j tests d'intégration

## Référence

- `CONTRAT-HUB.md` §1, §3, §5 (provisioning + invitation)
- `docs/CONTRAT-HUB.md` §6bis (autologin 3 couches)
- Ticket dormant similaire CMS : `veridian-cms/todo/2026-05-20-hub-integration-when-saas-launched.md`

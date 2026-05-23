# [BUG-23] CTA "Demander un compte gratuit" utilise l'email perso `robert.brunon@veridian.site` au lieu d'un alias générique

> **Sévérité** : 🟢 P2 (cosmétique + scalabilité business)
> **Cible** : démo prod + démo staging
> **URL exacte** : https://demo-analytics.veridian.site/ (banner + footer)
> **Détecté** : 2026-05-23

## Symptôme observé

Le banner CTA "Demander un compte gratuit →" et le footer "Demander une démo réelle"
pointent tous deux vers :
```
mailto:robert.brunon@veridian.site?subject=Demande%20Veridian%20Analytics&body=Bonjour%2C%0A%0AJ'ai%20vu%20la%20d%C3%A9mo%20publique%20de%20Veridian%20Analytics%20et%20je%20souhaite%20en%20savoir%20plus%20%2F%20ouvrir%20un%20compte.%0A%0AMerci.
```

Idem dans `/api/public-config` : `"contact_email": "robert.brunon@veridian.site"`.

## Risques / motivations

1. **Scalabilité** : si Veridian grandit, les leads doivent être routables vers un team
   (ou un CRM/Brevo), pas vers une boîte perso
2. **Branding pro** : `contact@veridian.site` ou `hello@veridian.site` ou `demo@veridian.site`
   font plus pro qu'un nom propre
3. **Spam** : exposer un email perso sur une page publique = harvest par bots → la boîte
   perso de Robert va se faire spam (et Veridian a un domaine custom, donc plein de bots
   qui scrapent les mailto sur les .site/.fr)
4. **Continuité** : si demain Robert change d'email ou délègue le commercial, il faudra
   éditer du code partout

## Comportement attendu

- Le contact_email est un **alias générique** : `contact@veridian.site` ou
  `hello@veridian.site` (cf skill `lark` pour les créer)
- Cet alias forward vers Robert pour l'instant (puis vers un team-inbox plus tard)
- Le mailto inclut un trackable subject pour discriminer la source (`subject=Demo Veridian Analytics`)
- Idéalement : remplacer le mailto par un **formulaire** (Turnstile + validation MX + tél)
  qui POST vers Brevo ou un Notifuse transactionnel pour avoir un suivi propre

## Suggestion fix

1. **Court terme** : créer l'alias `contact@veridian.site` (via skill `lark`), MAJ le seed
   `contact_email` côté DB démo, MAJ le frontend qui hardcode peut-être l'URL mailto
2. **Moyen terme** : remplacer le mailto par un formulaire de demande (Turnstile + champs
   email/téléphone/site/contexte) → autopipe vers une notif Telegram + un CRM léger

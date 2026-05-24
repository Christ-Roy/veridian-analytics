# [BUG-12] Page /account exposée sur la démo + texte bilingue FR/EN incohérent

> **Sévérité** : 🟡 P1 (UX cassée sur démo + confusion linguistique)
> **Cible** : démo prod
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/account?section=profile
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Cliquer sur l'avatar utilisateur dans la nav → "Account"
> 3. La page affiche en anglais : "My Account / Profile / Change Password / Change Email /
>    Notifications / Name / Save"

## Symptôme observé

Sur une démo publique brandée FR (banner FR "Vous regardez la démo publique...",
footer FR "Hébergé en France ..."), la page Account est :
- En **anglais** : "My Account", "Change Password", "Change Email", "Save"
- Une **page paramètres utilisateur** complète, avec inputs textareas pour modifier le
  profil → sur une démo SANS auth, ça n'a aucun sens (qui modifie quel compte ?)
- Aucun gating "lecture seule" — les champs sont éditables, le bouton Save est cliquable

Body text récupéré : `"My Account / Profile / Change Password / Change Email / Notifications / Name / Save"`

## Comportement attendu

Sur la démo (`is_demo: true` dans public-config) :
- Soit masquer entièrement le lien "Account" depuis le menu utilisateur
- Soit afficher un message "L'éditeur de compte n'est pas disponible en mode démo, demandez
  un compte gratuit →"

Sur tenant client réel :
- Tout doit être en français (cohérent avec le reste)
- Vérifier que les formulaires fonctionnent

## Hypothèse cause

1. **Pas de gate `is_demo`** sur ce composant — porté du staminads natif tel quel
2. **i18n incomplet** : les strings de account-page n'ont pas été traduites en FR.
   Probablement tout staminads est encore en EN par défaut et seuls quelques composants
   Veridian ont des strings FR (banner, footer, ...)

## Suggestion fix

1. **Court terme (démo)** : ajouter un guard `if (publicConfig.is_demo) return null` (ou
   afficher un placeholder) sur le composant `<AccountPage />`. Masquer aussi le lien
   "Account" du menu dans ce cas.
2. **Durable** : i18n. Centraliser les strings (react-intl/i18next) et fournir un bundle
   FR. Choisir une langue par défaut selon `Accept-Language` ou un toggle utilisateur.
3. **Tests** : E2E qui charge la démo en `accept-language: fr-FR`, screenshote chaque
   page, et vérifie qu'aucune string upstream EN n'apparaît (regex sur des termes
   typiques : `Sign in`, `Change Password`, `Save`, etc.).

## Pendant qu'on y est

Idem pour la sidebar Settings que je n'ai pas pu tester (page blanche) — probablement
aussi en EN avec sections "Members / Goals / Funnels / API Keys".

## Status

✅ FIXÉ (partie démo) 2026-05-23 par `fix/demo-veridian-bugs` (engine
SHA `0ef2754`, PR
[#2](https://github.com/Christ-Roy/veridian-analytics-engine/pull/2)).

Le gate `isDemo` rend désormais un panneau FR « Compte non disponible
en démo » avec CTA mailto. Plus aucun fetch `api.auth.me` ne part en
mode démo.

Reste hors scope (à traiter dans un sprint i18n dédié) : traduire la
page `/account` réelle (non-démo) FR + traduire la sidebar Settings
(BUG-05).

Changement :

- `console/src/routes/_authenticated/workspaces/$workspaceId/account.tsx` :
  gate `isDemo` après les hooks → panneau preview + CTA.

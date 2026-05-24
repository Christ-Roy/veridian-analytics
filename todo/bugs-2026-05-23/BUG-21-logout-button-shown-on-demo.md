# [BUG-21] Bouton "Logout" affiché dans le menu utilisateur sur la démo publique (sans auth)

> **Sévérité** : 🟢 P2 (UX confusion, pas bloquant)
> **Cible** : démo prod
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple (menu utilisateur)
> **Détecté** : 2026-05-23

## Symptôme observé

Dans le menu utilisateur du dashboard démo (visible via `read_page`) :
```
link "Account" [ref_55] href="/workspaces/demo-apple/account"
  img "user" [ref_56]
button "Logout" [ref_57]
  img "logout" [ref_58]
```

Le bouton "Logout" est rendu sur la démo. Or :
- La démo n'a pas d'auth (cf `is_demo: true` + public-config)
- Que ferait un click sur Logout ? Probablement rien d'utile, ou un redirect cassé

## Comportement attendu

Sur la démo (`is_demo: true`) :
- Masquer "Logout"
- Masquer "Account"
- Remplacer le menu par un CTA "Demander un compte gratuit →" qui est déjà dans le banner

## Suggestion fix

Côté composant `<UserMenu />` :
```tsx
const { is_demo } = usePublicConfig()
if (is_demo) {
  return <DemoCTAMenu />  // composant alternatif sans Logout/Account
}
return <RegularUserMenu />
```

## Lié

BUG-12 (page /account exposée sur démo).

## Status

✅ FIXÉ 2026-05-23 par `fix/demo-veridian-bugs` (engine SHA `0ef2754`,
PR
[#2](https://github.com/Christ-Roy/veridian-analytics-engine/pull/2)).

Dans `console/src/routes/_authenticated/workspaces/$workspaceId.tsx`,
le `Dropdown` (menu desktop) et le bloc Account/Logout (menu mobile)
sont désormais conditionnés à `!isDemo`. En mode démo, le bouton
utilisateur disparaît complètement — le `DemoBanner` global garde
déjà le CTA « Demander un compte gratuit ».

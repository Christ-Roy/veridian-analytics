# [BUG-06] Live counter affiche un nombre incohérent à 12 chiffres "099644222211 live now"

> **Sévérité** : 🔴 P0 (bug visible en production, donne l'impression d'un produit cassé)
> **Cible** : démo prod
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/live
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple/live
> 2. Attendre 3-4 secondes que la page se stabilise
> 3. Au lieu de "X live now" (où X est un petit entier réaliste, genre 12), on lit
>    **"099644222211 live now"** — un nombre de 12 chiffres incompréhensible

## Symptôme observé

Le DOM contient :
```html
<span class="text-lg font-medium text-gray-800">099644222211 live now</span>
```

Le nombre `099644222211` est une concaténation/glitch :
- Soit le compteur animé (counting up) concatène ses étapes au lieu de remplacer l'innerText
  (probable : `0`, `09`, `096`, `0996`, ..., chaque chiffre s'ajoute au lieu de remplacer)
- Soit un bug de formatage qui zero-pad et oublie de trim

À comparer avec les autres compteurs sur la même page qui s'affichent correctement :
"4", "9", "6" pour les Top Cities/Pages/etc.

## Comportement attendu

Le compteur live doit afficher un entier raisonnable, ex : `12 live now` ou `42 live now`.

Sur la démo générée à partir de 200k sessions, "Top Pages" affiche des chiffres en
unités/dizaines (4, 4, 4, 3, ...) — donc le live count attendu est probablement
dans la même fourchette (~10-50 visiteurs simultanés simulés).

## Console JS

Aucune erreur applicative associée.

## Hypothèse cause

Pattern probable d'un composant React qui anime un compteur :
```tsx
// BUG: append au lieu de remplacer
useEffect(() => {
  for (let i = 0; i <= target; i++) {
    setDisplay(prev => prev + i.toString())  // ← BUG : concatène
  }
}, [target])

// Devrait être :
setDisplay(i.toString())  // remplace
```

OU pattern d'un setInterval qui s'accumule entre renders à cause d'une dependency mal
gérée :
```tsx
useEffect(() => {
  const id = setInterval(() => setCount(c => c + lastVisitorCount), 1000)
  // ← BUG : si lastVisitorCount n'est pas reset, ça grossit
}, [])  // missing cleanup
```

Le nombre `099644222211` commence par `0` puis grimpe — cohérent avec un compteur qui
"compte de 0 à N" mais bug de string concat au lieu de display.

## Suggestion fix

1. **Trouver le composant** : grep le repo engine sur "live now" :
   ```bash
   rg -l '"live now"|`live now`|tlive now' apps/
   ```
2. **Inspecter la logique d'animation du compteur** — chercher `setDisplay`,
   `setCount`, `useEffect` autour de ce composant
3. **Fix le bug** :
   - Si concat : remplacer `prev + i` par `i`
   - Si interval qui s'accumule : ajouter cleanup `() => clearInterval(id)`
4. **Test de régression** : E2E qui charge `/live`, attend 5s, et vérifie que le compteur
   `live now` matche `/^\d{1,4}$/` (1 à 4 chiffres max). Bloquer la CI si > 4 chiffres.

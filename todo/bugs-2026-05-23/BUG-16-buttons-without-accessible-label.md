# [BUG-16] 24 boutons sans label texte ni aria-label dans la nav du dashboard — a11y WCAG fail

> **Sévérité** : 🟡 P1 (accessibilité — bloquant WCAG 2.1 SC 4.1.2 "Name, Role, Value")
> **Cible** : démo prod (probablement engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple
> **Détecté** : 2026-05-23

## Symptôme observé

Sur le dashboard demo-apple, sur 55 boutons au total :
- **24 sans label** = ni innerText ni aria-label ni title

Examples capturés via `read_page` :
```
button [ref_11] type="button"
button [ref_12] type="button"
button [ref_13] type="button"
button [ref_15] type="button"
button [ref_16] type="button"
button [ref_18] type="button"
button [ref_22] type="button"  // "menu" icône
button [ref_24] type="button"  // "global" icône
button [ref_26] type="button"  // "question-circle" icône
button [ref_28] type="button"  // "user" icône
button [ref_31] type="button"  // "close" icône
```

Beaucoup sont des icon-only buttons (menu hamburger, settings, help, etc.). Un screen reader
n'aura aucun moyen de comprendre à quoi ils servent.

## Risques

1. **WCAG 2.1 fail** : critère 4.1.2 "Name, Role, Value" non respecté. Tout audit
   accessibilité (RGAA en France) flaggera ça.
2. **Tests automatisés** : `@axe-core/playwright` ou Lighthouse bloqueront sur
   `button-name`.
3. **UX clavier** : navigation au clavier impossible → un utilisateur Tab-only ne sait
   pas où il clique.

## Comportement attendu

Chaque button doit avoir au moins un de :
- `<button>Texte visible</button>`
- `<button aria-label="Description de l'action">...</button>`
- `<button title="Description...">...</button>`

Pour les icon-only buttons (la plupart) :
```tsx
<button aria-label="Ouvrir le menu utilisateur" type="button">
  <UserIcon />
</button>
```

## Suggestion fix

1. **Audit automatisé** : `@axe-core/playwright` dans la suite E2E :
   ```ts
   import { AxeBuilder } from '@axe-core/playwright'
   test('dashboard a11y', async ({ page }) => {
     await page.goto('https://demo-analytics.veridian.site/workspaces/demo-apple')
     const results = await new AxeBuilder({ page }).analyze()
     const buttonNameViolations = results.violations.filter(v => v.id === 'button-name')
     expect(buttonNameViolations).toHaveLength(0)
   })
   ```
2. **Fix manuel** : grep côté engine sur `<Button>` ou `<button` sans `aria-label` ni
   children textuel — ajouter les labels manquants
3. **Lint** : ajouter `eslint-plugin-jsx-a11y` au repo engine pour catcher au build

# [C1] Port composants React Veridian → console staminads

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche** : `feat/C1-ui-port-components`
> **Charge** : 6h
> **Dépend de** : rien (composants visuels uniquement, peuvent être stubbés)
> **Bloque** : C2, C3 (qui les consomment)

---

## But

Porter les composants React Veridian depuis `veridian-analytics/components/` vers `veridian-analytics-engine/console/src/veridian/`. Garder leur look-and-feel Tailwind + shadcn/ui. **Ne PAS toucher au reste de la console staminads** (qui utilise AntDesign upstream).

## Spec

### Setup Tailwind isolé dans la console

La console staminads utilise AntDesign. On ne va pas tout casser. Stratégie :

- [ ] **Ajouter Tailwind à Vite config** mais **scoper le CSS sur `src/veridian/**`** uniquement
- [ ] Importer `tailwindcss` + `class-variance-authority` + `clsx` + `tailwind-merge` + `lucide-react` (déjà présent ? vérifier)
- [ ] Ajouter shadcn/ui primitives (Card, Button, Badge minimum) dans `src/veridian/ui/`
- [ ] **Tailwind preflight désactivé** ou scopé pour ne pas pourrir les composants AntDesign upstream

### Composants à porter (depuis legacy)

| Source legacy | Cible bridge |
|---|---|
| `components/service-score-block.tsx` | `console/src/veridian/service-score-block.tsx` |
| `components/shadow-marketing-block.tsx` | `console/src/veridian/shadow-marketing-block.tsx` |
| `components/locked-service-page.tsx` | `console/src/veridian/locked-service-page.tsx` |
| `components/sparkline.tsx` | `console/src/veridian/sparkline.tsx` |
| `components/impersonation-banner.tsx` | `console/src/veridian/impersonation-banner.tsx` |
| `components/ui/card.tsx` | `console/src/veridian/ui/card.tsx` |
| `components/ui/button.tsx` (si existant) | `console/src/veridian/ui/button.tsx` |
| `components/ui/badge.tsx` (si existant) | `console/src/veridian/ui/badge.tsx` |

### Adaptations nécessaires

- Remplacer les imports `@/components/...` legacy par `@/veridian/...` ou imports relatifs
- Remplacer les imports `@/lib/...` par fetch HTTP vers bridge endpoints (mais ce ticket ne porte PAS les pages — juste les composants visuels — donc les composants doivent prendre des props et pas fetch eux-mêmes)
- **Convention composants** : les composants Veridian sont des composants **purement présentationnels** (props in, JSX out). Pas de fetch interne. Le fetch se fait dans les pages (ticket C2).

### Service worker PWA

- [ ] Porter `veridian-analytics/public/sw.js` → `console/public/sw.js` (service worker pour PWA push notifications)
- [ ] Porter `veridian-analytics/public/pwa-install.js` → `console/public/pwa-install.js`
- [ ] Porter `veridian-analytics/components/pwa-register.tsx` → `console/src/veridian/pwa-register.tsx`

### Composant `gsc/` legacy

Le dossier `components/gsc/` (avec ses sous-composants) est plus complexe — il combine du fetch + de la présentation. **Le porter mais en mode props-only** : tout le fetch part dans la page (ticket C2). Si trop gros, scinder en sub-tickets dans C2.

## Tests obligatoires

`console/src/veridian/__tests__/` (Vitest + React Testing Library) :
- [ ] `service-score-block.test.tsx` : rend le score + label correctement, cas score 0 / 50 / 90
- [ ] `shadow-marketing-block.test.tsx` : rend titre + CTA + génère le mailto: correctement
- [ ] `locked-service-page.test.tsx` : rend l'état "verrouillé"
- [ ] `sparkline.test.tsx` : rend la SVG avec data
- [ ] `impersonation-banner.test.tsx` : visible uniquement si props `impersonating=true`

## Husky / coverage

```yaml
- sources:
    - console/src/veridian/service-score-block.tsx
    - console/src/veridian/shadow-marketing-block.tsx
    - console/src/veridian/locked-service-page.tsx
    - console/src/veridian/sparkline.tsx
    - console/src/veridian/impersonation-banner.tsx
  covered_by:
    - console/src/veridian/__tests__/service-score-block.test.tsx
    # ...
```

## Status

⏳ pending

## Notes pour l'agent qui pick

- **Référence legacy** : `~/Bureau/veridian-platform/veridian-analytics/components/`
- **Ne pas casser AntDesign upstream** : Tailwind scopé STRICTEMENT sur `src/veridian/**`. Tester en faisant un `npm run build` console que le bundle staminads upstream se rend toujours correctement.
- Si conflit Tailwind preflight × AntDesign : utiliser un `<div className="veridian-scope">` wrapper avec un selector CSS scopé
- **Pas de fetch dans les composants** — ils sont purement présentationnels. Le fetch est dans les pages (C2)

# [BUG-19] Page /annotations rendue mais quasi-vide (seulement le titre "Annotations")

> **Sévérité** : 🟡 P1 (la feature est annoncée dans la nav mais ne fait rien de visible sur la démo)
> **Cible** : démo prod
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/annotations
> **Détecté** : 2026-05-23

## Symptôme observé

```js
({ bodyLen: 539, h: ['Annotations'] })
```

La page rend juste le H1 "Annotations" mais aucune liste, aucun CTA "Créer une annotation",
aucun état vide explicite, juste 539 caractères de body (essentiellement banner + nav + footer).

À comparer à `/explore` qui rend des cards de templates, ou `/live` qui rend du contenu
temps réel.

## Comportement attendu

Soit :
- **Liste d'annotations** : si le seed démo en a (ex: "Release iPhone 17 Pro - 2026-04-15"),
  les afficher avec leur timeline impact
- **État vide propre** : "Aucune annotation pour ce workspace. [Créer une annotation]"
- Sur démo : si pas de seed, afficher 2-3 annotations factices pour montrer le concept

## Hypothèse cause

- Soit le composant est porté mais le seed démo ne contient pas d'annotations
- Soit le composant lui-même n'est porté que partiellement (juste le H1, le reste est dead
  code)

## Suggestion fix

1. **Vérifier le seed** démo (cf `project_demo_public_veridian.md` mentionne un re-seed cron) :
   y a-t-il un fixture annotations pour `demo-apple` ?
2. **Si pas** : ajouter 3-5 annotations seed factices (releases produit, campagnes marketing,
   changements site)
3. **Si oui mais ça affiche rien** : composant `<AnnotationsPage />` cassé — investiguer

## Lié

Pattern similaire à BUG-03/04/05 (pages quasi-blanches) mais ici le H1 rend → progrès partiel.

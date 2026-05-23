# [BUG-10] Liens "Documentation" et "Report an issue" pointent vers staminads.com / staminads/staminads

> **Sévérité** : 🔴 P0 (envoie les clients chez le concurrent / upstream, problème commercial)
> **Cible** : démo prod + démo staging + engine prod + engine staging
> **URL exacte** : visible sur n'importe quel dashboard (menu utilisateur / footer)
> **Détecté** : 2026-05-23
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Ouvrir le menu (icône burger ou avatar)
> 3. On y trouve :
>    - "Documentation" → `https://docs.staminads.com`
>    - "Report an issue" → `https://github.com/staminads/staminads/issues`
>    - "v6.1.0" (texte) — voir BUG-13

## Symptôme observé

Extrait du DOM :
```
link [ref_48] href="https://docs.staminads.com"
 generic "Documentation" [ref_50]
link [ref_51] href="https://github.com/staminads/staminads/issues"
 generic "Report an issue" [ref_53]
```

Un client Veridian qui clique "Documentation" se retrouve sur la doc staminads.com (langue
anglaise, branding upstream, parle d'install self-host, pas du SaaS Veridian).

Un client qui clique "Report an issue" arrive sur GitHub `staminads/staminads/issues` —
il pourrait poster son bug là-bas en croyant écrire à Veridian, l'info part chez l'upstream
public (potentielle fuite de stack/config/données client).

## Comportement attendu

- "Documentation" → `https://docs.veridian.site` (ou `https://veridian.site/docs/analytics`)
- "Report an issue" → soit un mailto `mailto:support@veridian.site`, soit un formulaire
  dédié, soit un lien vers un repo privé Veridian (jamais le repo public upstream)
- En mode démo publique : tout simplement masquer ces liens (la démo n'est pas un client)

## Hypothèse cause

Composant nav / footer / settings du fork engine non nettoyé. Constants hardcodées en dur.

## Suggestion fix

Grep côté engine :
```bash
rg 'staminads\.com|staminads/staminads' apps/web/src/
```

Remplacer par les URLs Veridian. Centraliser dans un fichier de constantes (ex
`apps/web/src/config/brand.ts`) :
```ts
export const BRAND = {
  name: 'Veridian Analytics',
  docsUrl: 'https://docs.veridian.site',
  issuesUrl: 'mailto:support@veridian.site',
  homepageUrl: 'https://veridian.site',
}
```

**Lié** : BUG-08, BUG-09, BUG-13 — même série de bugs branding upstream pas nettoyé.

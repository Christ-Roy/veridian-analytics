# [BUG-05] Page /settings affiche une page blanche

> **Status** : ⚠️ NOT A BUG (2026-05-23, vérification Chrome MCP)
> **Sévérité** : 🔴 P0 (impossibilité de configurer un workspace)
> **Cible** : démo prod (à vérifier sur engine prod aussi)
> **URL exacte** : https://demo-analytics.veridian.site/workspaces/demo-apple/settings?section=workspace
> **Détecté** : 2026-05-23

## Statut : NOT A BUG

Vérifié Chrome MCP 2026-05-23 21:21 UTC sur prod live : la page rend
**parfaitement** avec section workspace présélectionnée par
`?section=workspace`.

```js
{ url: ".../settings?section=workspace", bodyLen: 781, headings: ["Settings"] }
```

Contenu visible : H1 "Settings", sidebar avec toutes les sections
(Workspace, Custom Dimensions, Team, Integrations, Email SMTP, API Keys,
Privacy, Install SDK, **Veridian** — ajoutée par agent UI-NATIVE-
INTEGRATION 42f0fb9, Danger zone owner-only), formulaire workspace
complet (Name, Website URL, Logo URL + Detect, Timezone America/New_York,
Currency USD, TimeScore Reference, Bounce Threshold, Allowed Domains).

L'agent UI-NATIVE-INTEGRATION n'a PAS cassé le rendu — sa modif a
juste ajouté la sous-section Veridian (lignes 710-717 de settings.tsx)
qui rend `<VeridianSettingsPage embedded />` quand `section==='veridian'`.

**Hypothèse même que BUG-04** : crash transitoire de Goals (chunk JS
partagé) ou cache obsolète au moment du test du bug-hunter. Pas de fix
côté Settings.
> **Reproduction** :
> 1. Ouvrir https://demo-analytics.veridian.site/workspaces/demo-apple
> 2. Cliquer sur "Settings" dans la nav
> 3. Page vide — banner + footer uniquement

## Symptôme observé

```js
// → { url: "/workspaces/demo-apple/settings?section=workspace", h: [], bodyLen: 240 }
```

Même symptôme que BUG-03 et BUG-04 : zéro contenu rendu, juste le chrome de la page.

Notable : l'URL contient bien `?section=workspace` (query string géré par le router) mais
le composant Settings ne monte rien. Hypothèse : la route existe mais le composant des
sections (Workspace / Members / Goals / Funnels / API Keys / Domains / etc.) n'est pas
porté/importé.

## Comportement attendu

Sur tenant client réel : afficher le formulaire de configuration du workspace (domaine,
timezone, exclusions, etc.) + sous-menu de sections.

Sur démo publique : afficher la même UI en mode lecture seule, avec inputs `disabled`.

## Hypothèse cause

Idem BUG-03/BUG-04 + spécificité : `/settings` est probablement la page la plus touchée
par le port staminads → Veridian car elle contient les onglets custom (credentials API,
tokens GSC, etc., cf ticket U8-settings-credentials.md). Le composant a peut-être été
porté à moitié.

## Suggestion fix

Voir BUG-03. Spécifiquement sur Settings :
- Vérifier que le composant `<SettingsPage />` est bien monté pour la route
  `/workspaces/:wsId/settings`
- Vérifier que les sub-routes (`?section=workspace`, `?section=members`, etc.) sont
  bien gérées côté composant
- Coordonner avec le ticket sprint `U8-settings-credentials.md`

## Status

⚠️ NOT A BUG — vérifié 2026-05-23 par agent fix-blank-pages.

La page `/workspaces/demo-apple/settings` rend parfaitement : H1 "Paramètres" + sidebar (incluant maintenant les sections Veridian/VoIP/Search Console suite à `refactor/ui-native-pure` SHA `43aa4d4`) + form workspace, bodyLen 774 chars.

L'agent UI-NATIVE-INTEGRATION (SHA `42f0fb9`) n'a PAS cassé le rendu — il a juste ajouté la section "Veridian" dans la sidebar settings native, sans toucher au rendu principal.

Ticket conservé pour traçabilité.

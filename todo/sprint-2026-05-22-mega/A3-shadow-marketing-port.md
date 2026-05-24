# [A3] Port Shadow Marketing config → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/A3-shadow-marketing-port`
> **Charge** : 2h
> **Dépend de** : A2 (consomme inactiveServices)
> **Bloque** : C2 (UI dashboard affiche les ShadowMarketingBlocks)

---

## But

Porter la config statique de shadow marketing (textes vendeurs pour services inactifs) depuis `veridian-analytics/lib/shadow-marketing.ts` vers bridge. Servir aux pages UI qui rendent les blocks "non actifs comme pub passive avec CTA upsell".

## Spec

### Fichier à créer
**`veridian-bridge/src/shadow-marketing.ts`** — port direct du data statique.

Structure (port direct du legacy) :
```ts
export type ShadowIconKey = 'phone' | 'inbox' | 'line-chart' | 'search' | 'megaphone' | 'gauge' | 'bell';

export interface ShadowMarketingEntry {
  title: string;        // titre vendeur
  description: string;  // 2 phrases max, valeur business
  ctaLabel: string;     // texte du bouton CTA
  emailSubject: string; // sujet email pré-rempli
  emailBodyTemplate: string; // body avec {{domain}} placeholder
  icon: ShadowIconKey;
}

export const SHADOW_MARKETING: Record<ServiceKey, ShadowMarketingEntry>;
```

Les 6 entrées de `KNOWN_SERVICES` doivent avoir leur config (pageviews, forms, calls, gsc, ads, pagespeed). **Garder exactement les textes du legacy** — Robert les a déjà validés en prod.

### Endpoint
**`GET /api/admin/shadow-marketing`** → la config complète (servie au front qui choisit quoi afficher selon `inactiveServices` du tenant).

Pas d'auth nécessaire : c'est du data statique marketing.

## Tests obligatoires

`veridian-bridge/tests/shadow-marketing.test.ts` :
- [x] Les 6 services de `KNOWN_SERVICES` ont une entrée
- [x] Chaque entrée a tous les champs requis (title, description, ctaLabel, emailSubject, emailBodyTemplate, icon)
- [x] `emailBodyTemplate` contient bien `{{domain}}` placeholder
- [x] Endpoint retourne 200 + JSON valide

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/shadow-marketing.ts
  covered_by:
    - veridian-bridge/tests/shadow-marketing.test.ts
```

## Status

✅ done

Livré sur `feat/A3-shadow-marketing-port` puis mergé sur `dev` — voir commit
final dans le README sprint pour le SHA exact.

Détail :
- `veridian-bridge/src/shadow-marketing.ts` — config 6 services, type
  `ShadowIconKey`, interface `ShadowMarketingEntry`, `SHADOW_MARKETING`
  importe `ServiceKey` depuis `./tenant-status.js`.
  Différence vs legacy : `emailBodyTemplate` est une `string` avec placeholder
  `{{domain}}` (au lieu d'une fonction `(domain) => string`) pour permettre
  la sérialisation JSON via l'endpoint. Le front fait
  `template.replace('{{domain}}', siteDomain)`.
- `veridian-bridge/src/app.ts` — endpoint `GET /api/admin/shadow-marketing`,
  **public** (pas d'auth, data statique marketing).
- `veridian-bridge/tests/shadow-marketing.test.ts` — 6 tests :
  6 services présents, champs requis non vides, icon ∈ ShadowIconKey,
  placeholder `{{domain}}` présent, endpoint 200 sans Bearer, endpoint
  ignore un Bearer invalide (toujours 200).
- `test-coverage-map.yaml` — entrée pour `src/shadow-marketing.ts` +
  ajout de `tests/shadow-marketing.test.ts` aux covered_by de `src/app.ts`.

Textes des 6 services copiés mot pour mot du legacy
`veridian-analytics/lib/shadow-marketing.ts` (`pageviews`, `forms`, `calls`,
`gsc`, `ads`, `pagespeed`). Le service `push` du legacy n'a pas été porté
(hors `KNOWN_SERVICES` actuel — sera ajouté si B2 push-pwa-port le rapatrie).

## Notes pour l'agent qui pick

- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/lib/shadow-marketing.ts`
- **Copie les textes mot pour mot**, ne paraphrase pas — Robert les a tunés en prod
- Ce ticket est rapide (data statique) — bon ticket de warm-up pour un agent

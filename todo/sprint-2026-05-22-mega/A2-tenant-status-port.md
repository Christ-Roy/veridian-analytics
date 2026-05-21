# [A2] Port Tenant Status (services actifs/inactifs) → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/A2-tenant-status-port`
> **Charge** : 3h
> **Dépend de** : rien
> **Bloque** : A3 (shadow-marketing consomme inactiveServices), C2 (dashboard root)

---

## But

Porter `buildTenantStatus()` depuis `veridian-analytics/lib/tenant-status.ts` vers bridge. Détermine pour un workspace quels services parmi `KNOWN_SERVICES = ['pageviews', 'forms', 'calls', 'gsc', 'ads', 'pagespeed']` sont actifs.

## Spec

### Fichier à créer
**`veridian-bridge/src/tenant-status.ts`**

```ts
export const KNOWN_SERVICES = ['pageviews', 'forms', 'calls', 'gsc', 'ads', 'pagespeed'] as const;
export type ServiceKey = (typeof KNOWN_SERVICES)[number];

export interface SiteStatus {
  workspaceId: string;
  activeServices: ServiceKey[];
  inactiveServices: ServiceKey[];
  counts: {
    pageviews: number;
    forms: number;
    calls: number;
    gscRows: number;
    gscClicks: number;
    gscImpressions: number;
    gscProperty: GscPropertySummary | null;
  };
}

export async function buildTenantStatus(workspaceId: string): Promise<SiteStatus>;
```

### Endpoint
**`GET /api/admin/tenant/:workspaceId/status`** → `SiteStatus`

### Logique active/inactive

Un service est `active` si son count > 0 sur les 30 derniers jours.

Pour la V1 :
- `pageviews` : query staminads.events
- `forms` : 0 tant que B1 pas livré → TODO marqué
- `calls` : 0 V1
- `gsc` : 0 tant que A4 pas livré → TODO marqué
- `ads`, `pagespeed` : 0 V1

## Tests obligatoires

`veridian-bridge/tests/tenant-status.test.ts` :
- [ ] Workspace vide → tous services inactifs
- [ ] Workspace 1500 PV → `active = ['pageviews']`, inactive = les 5 autres
- [ ] Endpoint reject sans Bearer → 401

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/tenant-status.ts
  covered_by:
    - veridian-bridge/tests/tenant-status.test.ts
```

## Status

⏳ pending

## Notes pour l'agent qui pick

- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/lib/tenant-status.ts`
- L'ordre canonique des services dans `KNOWN_SERVICES` est important (UI les affiche dans cet ordre)
- N'introduis pas Postgres si pas nécessaire — ClickHouse suffit pour V1

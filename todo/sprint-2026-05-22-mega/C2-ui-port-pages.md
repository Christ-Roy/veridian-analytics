# [C2] Port pages dashboard → console staminads

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche** : `feat/C2-ui-port-pages`
> **Charge** : 8h (gros morceau)
> **Dépend de** : C1 (composants visuels disponibles) + A1/A2/A3/A4/B1/B2 (endpoints bridge disponibles)
> **Bloque** : audit Chrome MCP final

---

## But

Porter les pages dashboard depuis `veridian-analytics/app/(dashboard)/dashboard/*` vers la console staminads. Chaque page consomme les endpoints bridge livrés en A* et B*.

## Spec

### Pages à porter

| Source legacy | Cible console (TanStack Router route) |
|---|---|
| `app/(dashboard)/dashboard/page.tsx` (271L, Score + grille services) | Embed au top du dashboard workspace staminads existant |
| `app/(dashboard)/dashboard/gsc/page.tsx` (87L) | `/workspace/:id/gsc` |
| `app/(dashboard)/dashboard/forms/page.tsx` (200L) | `/workspace/:id/forms` |
| `app/(dashboard)/dashboard/calls/page.tsx` (254L) | `/workspace/:id/calls` (V1 placeholder "Bientôt") |
| `app/(dashboard)/dashboard/push/page.tsx` (42L) | `/workspace/:id/push` |
| `app/(dashboard)/dashboard/settings/page.tsx` (15L) | Embed dans settings staminads upstream |
| `app/admin/page.tsx` | `/admin` (SUPERADMIN only, impersonation banner) |
| `app/(auth)/welcome/page.tsx` | `/welcome` (ticket C3) |

### Pattern fetch — TanStack Query

Pas de `auth()` Auth.js. À la place :
- Token JWT staminads dans localStorage (déjà géré par console upstream)
- Fetch vers bridge avec `Authorization: Bearer ${VERIDIAN_ADMIN_API_KEY}` pour endpoints `/api/admin/*`
- TanStack Query hooks : `useTenantScore(workspaceId)`, `useTenantStatus(workspaceId)`, `useShadowMarketing()`, `useGscQuery(workspaceId, days)`, etc.

```ts
// Exemple
export const useTenantScore = (workspaceId: string) =>
  useQuery({
    queryKey: ['tenant', workspaceId, 'score'],
    queryFn: () => fetch(`${BRIDGE_URL}/api/admin/tenant/${workspaceId}/score`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    }).then(r => r.json()),
    staleTime: 60_000,
  });
```

### Page dashboard root (le plus gros)

- [ ] Embed le Score Veridian (`<ServiceScoreBlock score={...} label={...} />`)
- [ ] Grille des 6 services :
  - Pour chaque `activeService` : `<ServiceScoreBlock service={...} />` avec mini sparkline
  - Pour chaque `inactiveService` : `<ShadowMarketingBlock entry={SHADOW_MARKETING[service]} domain={tenant.domain} />`
- [ ] Mix actifs + inactifs dans l'ordre canonique `KNOWN_SERVICES`
- [ ] `<ImpersonationBanner />` au top si admin impersonne

### Page GSC

- [ ] Affichage tableau queries (top 100) avec impressions, clicks, position moyenne, CTR
- [ ] Filtres : période (7j/30j/90j), pays, device
- [ ] État vide : "Connecte ton GSC" + bouton OAuth (ticket A4 fournit l'endpoint `POST /api/admin/gsc/oauth-begin`)
- [ ] Graphe temporel clicks/impressions

### Page Forms

- [ ] Tableau soumissions avec date, formSlug, email lead
- [ ] Click row → détail submission (modal ou page sépare)
- [ ] Filtres : par formSlug, période
- [ ] Export CSV (V2)
- [ ] Tableau Leads (dédupliqués par email) avec submissionsCount, lastSeenAt

### Page Calls (V1 placeholder)

- [ ] Composant `<LockedServicePage service="calls" />` qui affiche "Bientôt — VoIP en cours d'intégration"
- [ ] Lien vers la roadmap publique (V2)

### Page Push

- [ ] Form "Envoyer une notif" : title, body, url, icon
- [ ] Preview du rendu push (UX miroir du rendu navigateur)
- [ ] Liste subscribers actifs (count)
- [ ] Historique envois (date, title, success/failure count)

### Page Settings

- [ ] Liste memberships + bouton invite (V2 — pour l'instant juste affichage)
- [ ] API key tenant + bouton "régénérer" + confirmation
- [ ] Custom domain tracker (V3, désactivé V1)
- [ ] Webhook URLs (V2)

### Page Admin (SUPERADMIN)

- [ ] Tableau tous les tenants avec slug, nbSites, pageviews30d, status, plan
- [ ] Bouton "Impersonner" → set cookie `veridian_admin_as_tenant` + redirect dashboard
- [ ] Bouton "Créer tenant" (V2)
- [ ] Quick stats cross-tenants (total pageviews, total forms, etc.)

## Tests obligatoires

Pour CHAQUE page :
- [ ] Vitest : composant rend correctement avec loading / error / data
- [ ] Playwright e2e (optionnel pour V1, obligatoire si page critique comme dashboard root et admin) : flow utilisateur OK

## Husky / coverage

```yaml
- sources:
    - console/src/routes/workspace/$id/index.tsx
    - console/src/routes/workspace/$id/gsc.tsx
    - console/src/routes/workspace/$id/forms.tsx
    - console/src/routes/workspace/$id/calls.tsx
    - console/src/routes/workspace/$id/push.tsx
    - console/src/routes/admin/index.tsx
  covered_by:
    - console/src/routes/__tests__/dashboard.test.tsx
    - console/src/routes/__tests__/gsc.test.tsx
    # ...
```

## Audit Chrome MCP (à faire en fin de ticket)

Pour CHAQUE page portée :
- [ ] Screenshot desktop 1440×900
- [ ] Screenshot mobile 375×667
- [ ] `read_console_messages` : 0 erreur, 0 warning critique
- [ ] `read_network_requests` : pas de 404, pas de CORS, pas de payload > 500kB
- [ ] Accessibilité : alt sur img, label sur input, heading order, contraste WCAG AA
- [ ] Responsive : pas de scroll horizontal mobile

Tous les findings remontés dans `../UI-POLISH.md` (pas fixés ici sauf trivial : typos, alt manquants).

## Status

⏳ pending

## Notes pour l'agent qui pick

- **Gros ticket** — prévoir 1-2 sessions
- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/app/(dashboard)/dashboard/*`
- Si C1 (composants) pas encore livré → stubber les composants Veridian en placeholder, remplacer quand C1 est prêt
- Si A1/A2/A3/A4/B1/B2 pas encore livrés → mocker les hooks TanStack Query, remplacer par vrai fetch quand backend est livré
- **Workflow hot-reload obligatoire** : push `dev` → ssh dev-pub dev-up.sh → refresh navigateur. **Chrome MCP en parallèle pour audit pendant qu'on dev**

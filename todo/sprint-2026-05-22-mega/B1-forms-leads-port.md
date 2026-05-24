# [B1] Port FormSubmission + Lead → veridian-bridge

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/B1-forms-leads-port`
> **Charge** : 6h
> **Dépend de** : A4 (la DB Postgres bridge doit exister — sinon créer la DB dans ce ticket)
> **Bloque** : C2 (page Forms tab consomme cet endpoint)

---

## But

Porter la chaîne `FormSubmission → Lead → LeadSession` depuis `veridian-analytics/prisma/schema.prisma` + `lib/ingest.ts` + `app/api/ingest/form/route.ts` vers bridge. C'est **la feature business clé** : track les formulaires, déduplique les leads par email, lie chaque soumission au visiteur web.

## Spec

### Schéma Prisma bridge (étend celui de A4)

```prisma
model Site {
  id              String   @id @default(cuid())
  tenantId        String
  siteKey         String   @unique   // public key utilisée par le tracker
  domain          String
  name            String
  createdAt       DateTime @default(now())
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  formSchemas     FormSchema[]
  formSubmissions FormSubmission[]
  leads           Lead[]
  @@index([tenantId])
}

model FormSchema {
  id          String   @id @default(cuid())
  siteId      String
  formSlug    String   // ex: "contact-devis", "newsletter"
  name        String   // nom humain
  fields      Json     // [{ name, label, type, required }]
  createdAt   DateTime @default(now())
  site        Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  submissions FormSubmission[]
  @@unique([siteId, formSlug])
}

model FormSubmission {
  id            String   @id @default(cuid())
  siteId        String
  formSchemaId  String?
  formSlug      String   // dénormalisé pour requêtes rapides
  data          Json     // payload du form
  ipAddress     String?
  userAgent     String?
  pageUrl       String?
  visitorId     String?  // cookie vrd_vid si présent
  sessionId     String?  // session staminads si match
  leadId        String?  // FK vers Lead créé/matché
  createdAt     DateTime @default(now())
  site          Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  formSchema    FormSchema? @relation(fields: [formSchemaId], references: [id])
  lead          Lead?    @relation(fields: [leadId], references: [id])
  @@index([siteId, createdAt])
  @@index([leadId])
}

model Lead {
  id            String   @id @default(cuid())
  siteId        String
  email         String?  // null si form anonyme
  phone         String?
  name          String?
  metadata      Json?    // données enrichies (entreprise, etc.)
  firstSeenAt   DateTime @default(now())
  lastSeenAt    DateTime @default(now())
  submissionsCount Int   @default(1)
  site          Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  submissions   FormSubmission[]
  sessions      LeadSession[]
  @@unique([siteId, email])
  @@index([siteId, lastSeenAt])
}

model LeadSession {
  id            String   @id @default(cuid())
  leadId        String
  visitorId     String?  // cookie vrd_vid
  sessionId     String?  // session staminads
  source        String?  // utm_source ou referer
  medium        String?  // utm_medium
  campaign      String?  // utm_campaign
  startedAt     DateTime @default(now())
  endedAt       DateTime?
  pageviewCount Int      @default(1)
  lead          Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  @@index([leadId])
}
```

### Lib à porter
**`veridian-bridge/src/forms/index.ts`** :
- `ingestFormSubmission(siteKey, payload)` — happy path complet :
  1. Lookup `Site` par siteKey
  2. Détecte / crée `FormSchema` selon `formSlug` envoyé
  3. Crée `FormSubmission`
  4. Si email présent → upsert `Lead` (dedup par email + siteId)
  5. Crée / update `LeadSession` (matché par visitorId)
  6. Push event `form_submission` vers staminads (workspace.events) avec custom dim `lead_id`
- `listSubmissions(workspaceId, filters)` — pagination + filtres pour dashboard
- `getLeadDetails(leadId)` — vue complète d'un lead

### Endpoints
- `POST /api/ingest/form` (PUBLIC, no auth — c'est appelé depuis les sites clients par le tracker)
  - Input : `{ siteKey, formSlug, data, visitorId?, sessionId?, pageUrl? }`
  - **Rate limit** : 10 req/min par IP (anti-spam)
  - **Captcha** : V2, pas dans ce ticket
- `GET /api/admin/tenant/:workspaceId/forms?days=30` → liste paginée submissions
- `GET /api/admin/lead/:leadId` → détail complet (submissions + sessions)
- `POST /api/admin/lead/:leadId/notes` → ajouter note manuelle (V2)

## Tests obligatoires

`veridian-bridge/tests/forms/` :
- [x] `ingest-happy-path.test.ts` : POST form → FormSubmission créé + Lead créé + event staminads pushé
- [x] `dedup-by-email.test.ts` : 2 POST avec même email → 1 Lead avec submissionsCount=2
- [x] `missing-sitekey.test.ts` : 401/404
- [x] `rate-limit.test.ts` : 11e req/min → 429
- [x] `list-submissions.test.ts` : pagination + filtres OK
- [x] `xss-sanitization.test.ts` (bonus) : payload XSS strippé avant stockage JSONB

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/forms/index.ts
    - veridian-bridge/src/forms/ingest.ts
    - veridian-bridge/src/forms/dedup.ts
  covered_by:
    - veridian-bridge/tests/forms/ingest-happy-path.test.ts
    - veridian-bridge/tests/forms/dedup-by-email.test.ts
    - veridian-bridge/tests/forms/missing-sitekey.test.ts
    - veridian-bridge/tests/forms/rate-limit.test.ts
    - veridian-bridge/tests/forms/list-submissions.test.ts
```

## Status

❌ REVERTED 2026-05-23 par cleanup-veridian-scope (PR #5 → main `a5a5189`).

Scope final Robert 2026-05-23 : forms ingestion supprimée — les sites client utilisent les **goals staminads natifs** (`event:form_submission`) au lieu de notre tracking custom. Plus simple, plus aligné staminads.

**Drop effectif** :
- bridge `src/forms/` supprimé (8 fichiers)
- tables `FormSubmission`, `FormSchema`, `Lead`, `LeadSession` droppées (migration `20260523000000_drop_forms_leads`)
- endpoint `/api/ingest/form` retiré
- tests d'intégration retirés
- UI tab Forms déplacé dans `_optional-features/`

Si besoin de leads tracking un jour : voir CLAUDE.md section VISION + memory `project_analytics_vision_scope_final`. C'est une **décision business** Robert, pas une réactivation auto.

- Modèles Prisma `Site`, `FormSchema`, `FormSubmission`, `Lead`, `LeadSession`
  + migration additive `20260522000000_add_forms_leads`
- Lib `veridian-bridge/src/forms/` : `ingestFormSubmission`, `listSubmissions`,
  `getLeadDetails` + helpers (`sanitize`, `rate-limit`, `staminads-event`)
- Endpoints : `POST /api/ingest/form` (public, rate-limit 10/min/IP, CORS),
  `GET /api/admin/tenant/:workspaceId/forms`, `GET /api/admin/lead/:leadId`
- 22 tests forms verts (191 total bridge), typecheck OK, Husky pre-push OK
- `test-coverage-map.yaml` étendu (entrée Forms B1 + helper fake-prisma-forms)
- Câblé dans `src/index.ts` (feature optionnelle, gated sur `BRIDGE_DATABASE_URL`)

## Notes pour l'agent qui pick

- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/prisma/schema.prisma` (models FormSubmission/FormSchema/Lead/LeadSession), `lib/ingest.ts`, `app/api/ingest/form/route.ts`
- Le tracker legacy POST sur `/api/ingest/form` (sur le domaine `analytics.app.veridian.site`). En migration, le tracker staminads pose le formhandler côté bridge sur `analytics-engine-bridge.app.veridian.site/api/ingest/form` — coordonner avec D2 pour le mapping des routes
- **Sécurité** : sanitize les `data` envoyés pour éviter stockage de scripts XSS. Stockage en `Json` Postgres = OK tant qu'on n'eval pas côté front
- **Migration historique** : si tenant existant a déjà des FormSubmission/Lead legacy, dump + import (cf. D2)

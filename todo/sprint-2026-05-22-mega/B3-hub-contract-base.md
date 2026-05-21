# [B3] Hub contract — endpoints provisioning de base

> **Repo cible** : `veridian-analytics-engine/veridian-bridge`
> **Branche** : `feat/B3-hub-contract-base`
> **Charge** : 6h
> **Dépend de** : A4 (DB Postgres bridge existe — étend `Tenant`)
> **Bloque** : D2 (provisioning des 5 clients)

---

## But

Câbler les **3 endpoints HMAC fondamentaux du contrat Hub Veridian** côté bridge (provision + attach-owner + health). Pattern A : HMAC Hub-to-app.

Source de vérité : [`../../../CONTRAT-HUB.md`](../../../CONTRAT-HUB.md) §5.1, §5.3, §5.5, §6.1.

Matrice actuelle § 10 (ligne 2241+) : Analytics = `❌` sur ces 3 lignes. Objectif ce ticket : passer à `✅`.

## Spec

### Migration Prisma — étend `Tenant`

```prisma
model Tenant {
  // existant cf A4
  // ...

  // Hub integration
  hubTenantId     String?  @unique
  plan            String   @default("free")
  planSource      String   @default("hub")   // 'hub' | 'manual'
  status          String   @default("active") // active | suspended | soft_deleted | trial_expired
  apiKey          String?  // api_key tenant délivrée au provisioning Hub
  suspendedAt     DateTime?
  softDeletedAt   DateTime?
  // ...
}
```

### Lib HMAC
**`veridian-bridge/src/hub-hmac.ts`** :

```ts
export function verifyHubHmac(req: Request): { valid: boolean; error?: string };
// Vérifie header `X-Hub-Signature` = HMAC-SHA256(secret, `${ts}.${body}`)
// - Anti-replay : timestamp dans header `X-Hub-Timestamp` doit être ≤ 5 min du now()
// - Comparaison constant-time via crypto.timingSafeEqual
// - ENV : HUB_HMAC_SECRET (staging/prod différents)
// - Mode dev : SKIP_HMAC=true bypasse (cf. CONTRAT-HUB §6.6)
```

### Lib paywall (stub V1)
**`veridian-bridge/src/paywall.ts`** :

```ts
export async function requireActivePlan(tenantId: string): Promise<void>;
// Lève PaywallError(402, code) si tenant.status ∈ {suspended, trial_expired, soft_deleted}
// V1 : juste check status. V2 (ticket S3) : obfuscation field-level.
```

### Endpoints

**`POST /api/tenants/provision`** (§5.1)
- Auth : HMAC Hub
- Input : `{ tenant_id, owner_email, plan, locale, metadata? }`
- 3 cas idempotents (Cas A/B/C de §5.1) :
  - Cas A (nouveau) : crée Tenant + retourne `{ tenant_id, api_key, dashboard_url }`
  - Cas B (existant ré-attaché) : refresh `apiKey`, retourne même payload
  - Cas C (conflit) : `{ error_code: 'conflict', message }`
- **Idempotency-Key** : V1 stocke dans table `IdempotencyKey` (V1.1 : ticket S3)
- Side effects : crée workspace staminads via STAMINADS_URL si pas encore fait

**`POST /api/tenants/attach-owner`** (§5.3)
- Auth : HMAC Hub
- Input : `{ tenant_id, user_id, email }`
- Lie un user au tenant en mode OWNER (côté bridge — à coordonner avec staminads workspace owner mapping)
- Idempotent : un re-attach du même user = NOOP

**`GET /api/tenants/{id}/health`** (§5.5)
- Auth : HMAC Hub
- Output : `{ status: 'active'|..., last_event_at, sites_count, pageviews_30d }`

## Tests obligatoires

`veridian-bridge/tests/hub/` :
- [ ] `hmac-valid.test.ts` : signature valide → request passe
- [ ] `hmac-invalid-signature.test.ts` → 401
- [ ] `hmac-replay-attack.test.ts` : timestamp > 5min → 401
- [ ] `hmac-body-modified.test.ts` : body changé après signature → 401
- [ ] `provision-cas-a.test.ts` : nouveau tenant → row créée + apiKey retournée
- [ ] `provision-cas-b.test.ts` : idempotent, rejouer = même réponse
- [ ] `provision-cas-c.test.ts` : conflit → error_code propre
- [ ] `attach-owner.test.ts` : lien user-tenant OK
- [ ] `attach-owner-idempotent.test.ts` : 2x même call = NOOP
- [ ] `health.test.ts` : retourne metrics correctes
- [ ] `paywall-required.test.ts` : tenant suspended → 402 sur endpoints `requireActivePlan`

## Husky / coverage

```yaml
- sources:
    - veridian-bridge/src/hub-hmac.ts
    - veridian-bridge/src/paywall.ts
    - veridian-bridge/src/hub/provision.ts
    - veridian-bridge/src/hub/attach-owner.ts
    - veridian-bridge/src/hub/health.ts
  covered_by:
    - veridian-bridge/tests/hub/hmac-valid.test.ts
    # ... liste complète des 11 tests ci-dessus
```

## ENV à configurer

- `HUB_HMAC_SECRET_STAGING` (32+ chars hex)
- `HUB_HMAC_SECRET_PROD` (32+ chars hex)
- `SKIP_HMAC=true` (dev local seulement, cf. §6.6)

Récupérer depuis `~/credentials/.all-creds.env` ou demander à l'agent Hub la valeur exacte du secret (côté Hub, c'est l'agent Hub qui détient la source).

## Critères de complétion

Une fois ce ticket livré, mettre à jour **dans `CONTRAT-HUB.md`** :
- §10.1 ligne `POST provision` : Analytics `❌` → `✅`
- §10.1 ligne `POST attach-owner` : `❌` → `✅`
- §10.1 ligne `GET health` : `❌` → `✅`
- §10.4 toutes les lignes : `—` → `✅`

## Status

⏳ pending

## Notes pour l'agent qui pick

- **Pré-requis** : lire `CONTRAT-HUB.md` §5.1, §5.3, §5.5, §6.1, §6.5, §6.6 avant de commencer
- **Coordination Hub** : l'agent Hub doit avoir setup son côté provisioning (déjà fait pour Notifuse + Prospection). Demander à Robert / créer un ticket Hub si l'agent Hub doit faire quelque chose en parallèle
- **Endpoint testing** : utiliser le pattern `fake-staminads` helper + un faux Hub HMAC signer dans les tests
- **Lifecycle avancé** (suspend/resume/soft-delete) : reporté en ticket S3 (cf. SPRINT.md)

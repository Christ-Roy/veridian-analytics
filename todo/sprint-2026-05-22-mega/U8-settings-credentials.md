# [U8] Page Settings tenant — config + credentials self-service (GSC / OVH / VoIP)

> **Repo cible** : `veridian-analytics-engine` (console + bridge)
> **Branche** : `feat/U8-settings-credentials` depuis `staging`
> **Charge** : 10h
> **Dépend de** : C1 (composants) + harness bridge

---

## But

Page `/settings` où un tenant gère **sa propre config** sans passer par Robert.
C'est la page la plus importante côté autonomie client. Aujourd'hui : rien côté
engine, et le legacy ne gère que email/password.

Robert l'a explicitement demandé : **le user doit pouvoir mettre lui-même ses
credentials GSC, OVH, et VoIP** (pour que le bridge pull les logs VoIP).

## Sections de la page Settings

### 1. Compte
- Changer email, changer mot de passe (port du legacy `settings-forms.tsx`)
- Réutilise les endpoints auth staminads

### 2. Site & tracking
- Domaine(s) du site, siteKey (lecture seule + bouton copier)
- Re-générer le snippet tracker
- Toggle visitor_id / cookie consent

### 3. 🔑 Google Search Console (credentials self-service)
- Statut connexion GSC (connecté / pas connecté)
- Bouton "Connecter Search Console" → OAuth flow (`POST /api/admin/gsc/oauth-begin`)
- Si déjà connecté : nom de la propriété, dernière sync, bouton "Resync maintenant", bouton "Déconnecter"
- **Important** : le user ne saisit PAS un client_secret Google — il fait juste
  le flow OAuth (autorise Veridian à lire SA Search Console). Le client OAuth
  Google est celui de Veridian (ENV bridge `GOOGLE_OAUTH_CLIENT_ID`).

### 4. 📞 VoIP / Téléphonie (credentials self-service)
C'est le morceau neuf. Le tenant doit pouvoir brancher son provider VoIP pour
que le bridge pull les logs d'appels (`sipCall` en legacy).

- Choix du provider : OVH Telephony, Telnyx, autre (extensible)
- Champs credentials selon provider :
  - **OVH** : application key / application secret / consumer key (API OVH)
  - **Telnyx** : API key
- Les credentials sont **chiffrés AES-256-GCM** en DB bridge (même pattern que
  les tokens GSC — `TOKEN_ENCRYPTION_KEY`)
- Bouton "Tester la connexion" → vérifie que les creds marchent
- Le bridge a un cron qui pull les call logs via ces creds (ticket B-VOIP séparé)
- Statut : dernière sync logs VoIP, nombre d'appels remontés

### 5. Notifications
- Email de notif (nouveau lead, rapport hebdo) on/off
- Préférences push admin

## Modèle Prisma bridge — nouvelle table

```prisma
model TenantCredential {
  id            String   @id @default(cuid())
  tenantId      String
  kind          String   // 'voip_ovh' | 'voip_telnyx' | ...
  encryptedData Json     // creds chiffrés AES-256-GCM
  status        String   @default("untested") // untested | ok | failed
  lastSyncAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, kind])
}
```

## Endpoints bridge à créer

- `GET /api/admin/tenant/:wsId/settings` — config complète du tenant
- `PUT /api/admin/tenant/:wsId/settings` — update config (site, notifs)
- `POST /api/admin/tenant/:wsId/credentials` — enregistre des creds VoIP (chiffrés)
- `POST /api/admin/tenant/:wsId/credentials/:kind/test` — teste la connexion
- `DELETE /api/admin/tenant/:wsId/credentials/:kind`

## Sécurité

- Creds VoIP **jamais** renvoyés en clair par l'API (masqués `••••1234`)
- Chiffrement AES-256-GCM obligatoire en DB
- Endpoints admin Bearer

## Tests
- Unitaires + intégration (chiffrement, round-trip, test connexion mocké)
- Tests Vitest UI pour la page

## Status
✅ done — staging `1c716c6` (feature: `55c3459`)

Livré dans `veridian-analytics-engine` sur `staging` :

**Bridge** (`veridian-bridge/`)
- Migration additive `20260522000100_add_tenant_credentials_settings` :
  tables `TenantCredential` + `TenantSettings` (rien d'existant touché).
- `src/credentials/` : chiffrement AES-256-GCM générique (clé partagée
  `TOKEN_ENCRYPTION_KEY`, même format de blob que `gsc/oauth.ts`),
  providers VoIP OVH/Telnyx (validation Zod, masquage `••••1234`, test
  connexion), store CRUD.
- `src/settings/` : agrégation vue config + upsert prefs + 6 routes HTTP
  admin Bearer (module isolé `routes.ts`, pas de modif `app.ts`).
- Creds JAMAIS renvoyés en clair. Câblé dans `index.ts` + harness intégration.

**Console** (`console/`)
- Page `/veridian/settings/:workspaceId` — 5 sections (Compte, Site,
  GSC, VoIP, Notifications), route TanStack sous `_authenticated`.
- `api.ts` étendu (requestJson PUT/POST/DELETE + clients settings/creds).

**Tests** : 69 unitaires bridge + 11 intégration (vrai Postgres :
migration, chiffrement round-trip JSONB, `@@unique`, cascade FK) + 13
Vitest UI. `test-coverage-map.yaml` étendu.

**Fixes CI annexes** (débloquent tout le sprint staging) :
- `staging-deploy.yml` écrit désormais `TOKEN_ENCRYPTION_KEY` dans le
  `.env` staging (était manquant → Settings + GSC + VoIP désactivés
  silencieusement). Secret `TOKEN_ENCRYPTION_KEY_STAGING` créé.
- `timeout-minutes` étage 3 deploy 10→18 min (le smoke dépassait le cap).

**Vérifié en prod staging** : `[bridge] Settings routes registered`,
endpoints répondent avec auth gating correct (`GET /settings` → 401 sans
Bearer), migration appliquée, 4 containers `healthy`.

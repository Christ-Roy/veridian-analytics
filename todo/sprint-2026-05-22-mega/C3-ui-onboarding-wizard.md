# [C3] Onboarding wizard nouveau tenant → console staminads

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche** : `feat/C3-ui-onboarding-wizard`
> **Charge** : 4h
> **Dépend de** : C1 (composants visuels)
> **Bloque** : rien (peut être livré indépendamment)

---

## But

Wizard `/welcome` qui guide un nouveau tenant à installer le snippet staminads sur son site, en 3 étapes avec validation automatique. Améliore le drop-off rate post-signup.

## Spec

### Route
`/welcome` (accessible après signup ou bouton "Setup tracker" depuis dashboard si encore aucun event reçu).

### Wizard 3 étapes

#### Étape 1 — "Copie ton snippet"
- Bloc code avec le `<script>` à coller (généré côté bridge avec workspaceId + visitorId enabled)
- Bouton "Copier dans le presse-papier" avec feedback toast
- Brève explication : "Ce snippet à coller dans le `<head>` de ton site sera invisible et trackera les visites"

#### Étape 2 — "Pose-le dans ton site"
- Illustration : "Va dans le `<head>` de ton site et colle juste avant `</head>`"
- Selon le CMS du client (si on le sait) : guide spécifique (WordPress, Webflow, Next.js, etc.). V1 : guide générique uniquement.
- Lien vers la doc complète (V2)

#### Étape 3 — "Vérifier"
- Bouton "Je l'ai posé, vérifier"
- Polling toutes les 5 sec : `GET /api/admin/tenant/:workspaceId/check-tracker`
- Retours possibles :
  - `{ status: 'waiting' }` → "On attend le premier événement..."
  - `{ status: 'ok', firstSeenAt: '2026-...' }` → "✅ Premier pageview reçu ! Redirection dans 3s..."
  - Après 60 sec sans event : "On ne reçoit toujours rien — vérifie que le script est bien dans le `<head>`. [Refaire le check] [Aide]"

### Endpoint bridge (côté ticket A1/A2 à compléter)

**`GET /api/admin/tenant/:workspaceId/check-tracker`** :
```json
{
  "status": "ok" | "waiting",
  "firstSeenAt": "2026-05-22T14:23:11Z" | null,
  "totalEvents24h": 0
}
```

(Cet endpoint peut vivre dans le ticket A2 — l'ajouter là-bas, ou créer un nouveau fichier `veridian-bridge/src/check-tracker.ts`)

### Email fallback Notifuse

Si après 24h aucun event reçu, déclencher un email Notifuse :
- Subject : "Tu as oublié ? Le tracker Veridian n'est pas encore en place"
- Body : "Voici ton snippet, voici comment l'installer, voici la doc"
- Trigger : cron quotidien côté bridge qui scanne les `Tenant` créés > 24h sans event

(Le cron à câbler peut être un endpoint POST appelé par cron externe, ou un interval dans le bridge)

## Tests obligatoires

`console/src/routes/__tests__/welcome.test.tsx` :
- [ ] Étape 1 : snippet généré contient bien le workspaceId + bon URL endpoint
- [ ] Bouton copier déclenche `navigator.clipboard.writeText`
- [ ] Étape 3 : polling status `waiting` puis `ok` → transition correcte
- [ ] Après 60s waiting → message d'aide affiché

`veridian-bridge/tests/check-tracker.test.ts` :
- [ ] Workspace 0 events → `status: 'waiting'`
- [ ] Workspace 1 event reçu → `status: 'ok'` + firstSeenAt correct
- [ ] Workspace inconnu → 404

## Husky / coverage

```yaml
- sources:
    - console/src/routes/welcome.tsx
    - veridian-bridge/src/check-tracker.ts
  covered_by:
    - console/src/routes/__tests__/welcome.test.tsx
    - veridian-bridge/tests/check-tracker.test.ts
```

## Status

⏳ pending

## Notes pour l'agent qui pick

- Référence legacy : `~/Bureau/veridian-platform/veridian-analytics/app/(auth)/welcome/page.tsx`
- **Snippet généré** : doit pointer vers `https://analytics-engine.app.veridian.site/track` en prod, `https://analytics-engine-dev.staging.veridian.site/track` en dev
- Le polling toutes les 5 sec peut être agressif sur ClickHouse — V2 : passer en SSE ou WebSocket si charge problématique

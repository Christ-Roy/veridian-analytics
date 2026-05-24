# [GIGA-UI] Tout ce qu'il reste à faire niveau UI — Veridian Analytics

> **Repo cible** : `veridian-analytics-engine/console`
> **Branche de travail** : `staging` (modèle main ← staging, plus de `dev`)
> **Créé** : 2026-05-22
> **Statut** : ⏳ pending — escadron d'agents UI à lancer

---

## Contexte

Le sprint giga a livré l'**ossature UI** : composants C1 + un dashboard root intégré
(`ui-integration-polish`, commit `3381e10`). Mais le sprint UI n'est **pas fini** :
C2 (pages complètes) et C3 (onboarding wizard) n'ont jamais été lancés, et la démo
publique E1 n'est pas déployée.

Ce ticket recense **TOUT le restant UI** et le découpe en chantiers parallélisables
pour un escadron d'agents.

### Ce qui EXISTE déjà (ne pas refaire)

`console/src/veridian/` contient :
- Composants : `service-score-block`, `shadow-marketing-block`, `locked-service-page`,
  `sparkline`, `impersonation-banner`, `pwa-register`, primitives `ui/{card,button,badge}`
- `pages/dashboard.tsx` + `pages/dashboard-tabs/{forms,gsc,push}-tab.tsx` (tabs STUB)
- Route `console/src/routes/_authenticated/veridian.dashboard.$workspaceId.tsx`
- `api.ts` (client fetch bridge), `theme.css` (palette dark teal), `types.ts`, `utils.ts`
- `demo-banner.tsx`, `demo-footer.tsx` (pour le mode démo E1)
- Tests Vitest + screenshots

### Ce qui MANQUE — l'objet de ce ticket

Les **3 tabs Forms/GSC/Push sont des stubs** ("🚧 disponible après ticket X")
alors que les endpoints bridge A4/B1/B2 sont maintenant TOUS livrés et testés.
Il faut les brancher pour de vrai. Plus : onboarding wizard, page admin, polish.

---

## Découpage en chantiers (escadron d'agents UI)

### U1 — Brancher le tab GSC sur le vrai endpoint A4
> Zone : `console/src/veridian/pages/dashboard-tabs/gsc-tab.tsx` + hooks

- Remplacer le stub par le vrai contenu : consomme `GET /api/admin/tenant/:wsId/gsc?days=30`
- Affiche : total clicks/impressions/CTR/position, graphe timeseries (echarts ou recharts),
  table top queries, table top pages
- Sélecteur de période (7j / 28j / 90j)
- Bouton "Connecter Search Console" → déclenche `POST /api/admin/gsc/oauth-begin`
- États : loading skeleton, empty ("GSC pas encore connecté" + CTA), error + retry
- Hook TanStack Query `useGscQuery(workspaceId, days)`
- Tests Vitest

### U2 — Brancher le tab Forms sur le vrai endpoint B1
> Zone : `console/src/veridian/pages/dashboard-tabs/forms-tab.tsx` + hooks

- Remplacer le stub : consomme `GET /api/admin/tenant/:wsId/forms?days=30`
- Table paginée des FormSubmission (date, formSlug, email lead, source)
- Vue détail Lead au clic → `GET /api/admin/lead/:leadId` (submissions + sessions)
- Filtres : par formSlug, par période
- Badge "nouveau lead" / "lead récurrent"
- États loading/empty/error
- Hooks `useFormSubmissions`, `useLeadDetails`
- Tests Vitest

### U3 — Brancher le tab Push sur le vrai endpoint B2
> Zone : `console/src/veridian/pages/dashboard-tabs/push-tab.tsx` + hooks

- Remplacer le stub : consomme `GET /api/admin/tenant/:wsId/push/subscribers`
  et `GET /api/admin/tenant/:wsId/push/history`
- Compteur d'abonnés actifs
- Formulaire "Envoyer une notification" (titre, body, url, icon) → `POST /api/admin/push/send`
  avec confirmation avant envoi (action irréversible — envoie à tous les abonnés)
- Historique des notifs envoyées (table : date, titre, targetCount, successCount, failureCount)
- États loading/empty/error
- Hooks `usePushSubscribers`, `usePushHistory`, mutation `useSendPush`
- Tests Vitest

### U4 — Onboarding wizard `/welcome` (ex-ticket C3) ✅ LIVRÉ

> Zone : `console/src/veridian/pages/welcome.tsx` + route + composants wizard
> Livré 2026-05-22 — commit `09d1680` sur `staging`.

Wizard 3 étapes pour qu'un nouveau tenant installe le tracker :
1. **"Copie ton snippet"** — bloc code `<script>` généré (workspaceId + endpoint),
   bouton "Copier" + toast ✅
2. **"Pose-le dans ton site"** — guide générique (coller avant `</head>`) +
   illustration `<head>` ✅
3. **"Vérifier"** — polling `GET /api/admin/tenant/:wsId/check-tracker` toutes les 5s,
   états waiting / ok (premier pageview reçu → redirect dashboard) / timeout 60s
   avec panneau d'aide [Refaire le check] [Aide] ✅
- Route TanStack `/veridian/welcome/$workspaceId` sous `_authenticated` ✅
- ✅ **Endpoint check-tracker CRÉÉ** : il n'existait pas côté bridge. Ajouté
  `veridian-bridge/src/check-tracker.ts` (factory `createCheckTrackerHandler` +
  helper `makeStaminadsRecentActivityFetcher` qui compte les pageviews 24h via
  staminads analytics.query). Fail-safe : workspace vide / staminads down →
  status `waiting`, jamais une 5xx. Route montée sous `requireVeridianAdmin`.
- ✅ Tests : 12 Vitest console (snippet, copy, navigation, polling, timeout,
  403) + 11 tests bridge. `test-coverage-map.yaml` mis à jour.

**Note pour U6 (polish)** : `welcome.tsx` n'est PAS encore branché comme CTA
depuis le dashboard (`EmptyStateInstallTracker` garde son mailto). Câbler le
lien `/veridian/welcome/$workspaceId` quand 0 event = à faire côté dashboard
(évité ici pour ne pas entrer en conflit avec U1-U3 qui touchent `dashboard.tsx`).

### U5 — Page admin `/admin` + impersonation
> Zone : `console/src/veridian/pages/admin.tsx` + route

- Route `/admin` réservée SUPERADMIN (guard côté console)
- Liste des tenants avec leur Score Veridian, statut, dernière activité
- Bouton "Voir comme ce tenant" → active l'impersonation banner (déjà livré en C1)
- Recherche / tri / filtres
- Tests Vitest

### U6 — Polish visuel transverse + audit Chrome MCP
> Zone : transverse — `theme.css`, responsive, micro-interactions

- Passe esthétique sur les 3 tabs branchés (U1-U3) : cohérence spacing/typo/couleurs
- Responsive mobile vérifié sur toutes les pages (375px) — Robert check au téléphone
- Animations subtiles : transitions de tab, fade-in des cards, skeletons shimmer
- Dark mode cohérent partout (palette dark teal Veridian scopée `.veridian-scope`)
- **Audit Chrome MCP** : screenshots desktop + mobile de chaque page, console JS clean,
  network < 500ms, Lighthouse > 85
- Screenshots committés dans `console/src/veridian/pages/screenshots/`
- ⚠️ U6 démarre APRÈS U1-U5 (il polit leur livraison)

### U7 — Finir la démo publique E1 (déploiement)
> Zone : déploiement Dokploy + seed — PAS de code console

- L'agent E1 a livré le code (branding démo, demo-banner, demo-footer) mais
  n'a PAS déployé l'instance. DNS `demo-analytics.veridian.site` créé (→ 51.210.7.44)
  mais rien ne tourne dessus (HTTP 000).
- À faire : créer le compose Dokploy `veridian-analytics-demo` (image
  `ghcr.io/christ-roy/veridian-analytics-engine:latest` + `IS_DEMO=true`),
  ClickHouse dédié, label Traefik `demo-analytics.veridian.site`, cert Let's Encrypt
- Générer `DEMO_SECRET`, premier seed `POST /api/demo.generate?secret=...`
- Vérifier `https://demo-analytics.veridian.site/workspaces/demo-apple` → 200 avec data
- Cron daily de re-seed
- Cf. ticket détaillé `E1-demo-public-veridian-analytics.md` (sections 3-8)
- C'est le véhicule pour montrer l'app SANS Tailscale SANS login

---

## ⚠️ Tickets complémentaires (ce ticket ne suffit PAS seul)

Le scope initial U1-U7 était incomplet. Tickets additionnels créés 2026-05-22 :

- **`U8-settings-credentials.md`** — page Settings tenant : config + creds
  self-service GSC / OVH / VoIP (le user branche lui-même sa téléphonie)
- **`B-VOIP-call-logs.md`** — ingestion logs d'appels VoIP côté bridge
  (OVH Telephony / Telnyx) — alimente le tab Calls
- **`U9-calls-tab-auth-misc.md`** — tab Calls + flow login/welcome + page 404
  brandée + cohérence barre de tabs
- **`INFRA-compose-env-audit.md`** — audit ENV compose (VAPID manquant détecté,
  etc.) : garantir que le compose contient TOUT pour que l'app marche déployée

## Ordre d'exécution global

```
VAGUE 1 (parallèle) :
  U1 gsc-tab · U2 forms-tab · U3 push-tab · U4 wizard · U5 admin
  U7 démo-deploy · U8 settings · B-VOIP · INFRA-compose-env
        │
        ▼
VAGUE 2 :
  U9 calls-tab (dépend de B-VOIP) — peut stubber si B-VOIP pas fini
        │
        ▼
VAGUE 3 :
  U6 polish + audit Chrome MCP — APRÈS toutes les pages mergées
```

## Règles communes (tous les agents U*)

1. **Worktree isolé** strict — jamais le checkout principal
2. **Husky jamais bypass** (le gate T6 est en place)
3. **Modèle Opus**
4. Branche `feat/U<n>-<slug>` depuis `staging`, merge ff-only sur `staging`
5. Hooks fetch via TanStack Query, pattern dans `api.ts` existant
6. Tests Vitest pour chaque page/tab
7. Ne PAS casser la console AntDesign upstream — tout scopé `.veridian-scope`
8. Endpoints bridge : tous livrés et testés (A1-A4, B1-B3). URL bridge dans la config console.
9. Pas de "je continue ?"

## Critère de complétion

- Les 3 tabs Forms/GSC/Push affichent de la VRAIE data (plus de stub "🚧")
- Wizard `/welcome` fonctionnel avec vérification tracker
- Page `/admin` avec liste tenants + impersonation
- Démo publique `demo-analytics.veridian.site` accessible sans login, sans Tailscale
- Audit Chrome MCP OK (desktop + mobile + Lighthouse > 85)
- Tous les tests Vitest verts

## Status

❌ OBSOLÈTE 2026-05-24 — scope changé par Robert le 2026-05-23 (cf CLAUDE.md section VISION). Ce ticket décrivait des features UI Veridian custom qui ne seront PAS commercialisées (score, shadow marketing, forms tab, push tab, page admin Robert, dashboard custom). Ces composants sont dans `_optional-features/` ou `_archive/`.

L'UI commercialisée vit dans la stack vanille staminads + 2 onglets Settings (voip, search-console). Refonte livrée par `refactor/ui-native-pure` (PR #28, main `43aa4d4`).

Si un futur besoin business émerge → nouveau ticket, pas réactivation de celui-ci.

# Audit live BUG-HUNTER — 2026-05-23

> Audit manuel Chrome MCP de l'UI Veridian Analytics live (démo prod, démo staging, engine prod).
> 23 tickets de bugs créés. **Aucun fix appliqué** — tickets prêts à consommer par d'autres agents.

## Top 3 P0 à fixer en priorité

1. **[BUG-01]** `analytics-engine.app.veridian.site` expose un formulaire de création admin sans auth.
   N'importe qui sur internet peut potentiellement prendre le contrôle root de la prod. **Faille
   sécu critique, fix dans l'heure** (`docker exec` + bootstrap admin manuellement, puis gate le
   /setup côté code).

2. **[BUG-02]** L'onglet "Veridian" du dashboard démo affiche "ERREUR 404 NOT FOUND" — la valeur
   ajoutée principale Veridian (score, status, shadow marketing) est cassée sur la démo publique
   que tout prospect va voir. Endpoints `/api/admin/tenant/*` manquants côté analytics-engine.

3. **[BUG-08/09/10/13/20]** Branding upstream `Staminads` pas nettoyé : title HTML, alt logo,
   liens docs/issues, version v6.1.0, FOUC au cold load. Visible sur chaque visite. À traiter
   en lot (1 PR qui clean tout d'un coup).

## Sévérité — résumé

| Sévérité | Compte | Tickets |
|---|---|---|
| 🔴 P0 (bloquant) | 11 | BUG-01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11 |
| 🟡 P1 (gênant) | 9 | BUG-12, 14, 15, 16, 17, 19, 20, 22 |
| 🟢 P2 (cosmétique) | 3 | BUG-13, 18, 21, 23 |
| **Total** | **23** | |

Note : BUG-13 est marqué P1 dans son fichier mais c'est P2-ish (info disclosure mineur). Le
ticket suit BUG-08/09/10 comme série "branding upstream".

## Tickets par thème

### Sécurité (4 tickets)
- 🔴 **BUG-01** — analytics-engine PROD : formulaire admin public sans auth ← **CRITIQUE**
- 🟡 BUG-17 — Pas de CSP header sur demo + engine prod
- 🟢 BUG-18 — Header `x-powered-by: Express` exposé
- 🟡 BUG-22 — `/api/tools.favicon` public sans rate-limit / sans whitelist

### Features cassées (5 tickets)
- 🔴 BUG-02 — Onglet Veridian du dashboard = 404
- 🔴 BUG-03 — Page /goals blanche
- 🔴 BUG-04 — Page /filters blanche
- 🔴 BUG-05 — Page /settings blanche
- 🔴 BUG-07 — Page /install-sdk = "Page introuvable"

### Bug visible production (1 ticket)
- 🔴 BUG-06 — Live counter affiche "099644222211 live now" (12 chiffres garbage)

### Branding upstream Staminads pas nettoyé (5 tickets, à fixer en lot)
- 🔴 BUG-08 — `<title>Staminads</title>` hardcoded
- 🔴 BUG-09 — Logo `alt="Staminads"`
- 🔴 BUG-10 — Liens docs.staminads.com + staminads/staminads/issues
- 🔴 BUG-11 — robots.txt démo servi sur engine prod
- 🟢 BUG-13 — Version "v6.1.0" exposée

### UX / démo (3 tickets)
- 🟡 BUG-12 — Page /account exposée + bilingue FR/EN
- 🟡 BUG-19 — Page /annotations vide (seul H1 rendu)
- 🟡 BUG-20 — Cold load FOUC + flash "Staminads"
- 🟢 BUG-21 — Bouton "Logout" sur démo sans auth

### Privacy / data leak (1 ticket)
- 🟡 BUG-14 — Logo Apple chargé depuis apple.com → IP visiteur leak

### i18n / localisation (1 ticket)
- 🟡 BUG-15 — Timezone "America/New_York" sur démo "Hébergée en France"

### Accessibilité (1 ticket)
- 🟡 BUG-16 — 24/55 boutons sans label/aria-label

### Business / scalabilité (1 ticket)
- 🟢 BUG-23 — CTA mailto vers email perso robert.brunon@

## Pages auditées

### Démo prod (`demo-analytics.veridian.site`)

| Route | Verdict | Notes |
|---|---|---|
| `/` (landing) | 🟡 partiel | Charge OK, mais cold-load flash "Staminads" (BUG-08, 20) |
| `/workspaces` | ✓ OK | Liste s'affiche, lien Ouvrir la démo OK |
| `/workspaces/demo-apple` (dashboard) | 🟡 partiel | Dashboard OK avec data, mais branding cassé partout (BUG-08/09/10/13) + 24 buttons sans aria |
| `/workspaces/demo-apple/explore` | ✓ OK | Templates de reports affichés |
| `/workspaces/demo-apple/live` | 🔴 KO | "099644222211 live now" — BUG-06 |
| `/workspaces/demo-apple/goals` | 🔴 KO | Page blanche — BUG-03 |
| `/workspaces/demo-apple/filters` | 🔴 KO | Page blanche — BUG-04 |
| `/workspaces/demo-apple/annotations` | 🟡 partiel | Juste le H1 — BUG-19 |
| `/workspaces/demo-apple/settings` | 🔴 KO | Page blanche — BUG-05 |
| `/workspaces/demo-apple/account` | 🟡 partiel | Bilingue + exposée — BUG-12 |
| `/veridian/dashboard/demo-apple` | 🔴 KO | "ERREUR 404" — BUG-02 |
| `/install-sdk` | 🔴 KO | "Page introuvable" — BUG-07 |

### Démo staging (`demo-staging-analytics.veridian.site`)

- Identique à démo prod (built from same code) — landing OK, comportement attendu identique. Pas audité dans le détail page par page pour éviter de doubler les tickets ; suppose que tous les bugs prod s'y appliquent aussi.

### Engine prod (`analytics-engine.app.veridian.site`)

| Route | Verdict | Notes |
|---|---|---|
| `/` (redirige `/setup`) | 🔴 KO **CRITIQUE** | Formulaire admin public sans auth — BUG-01 |
| `/robots.txt` | 🔴 KO | Sert le robots.txt démo — BUG-11 |
| Reste | non audité | Pas de compte admin = impossible de tester les pages auth-required |

### Bridge prod (`analytics-engine-bridge.app.veridian.site`)

| Route | Verdict | Notes |
|---|---|---|
| `/health` | ✓ OK | Retourne JSON propre |
| `/` | ✓ OK | 404 propre avec CSP |
| `/api/v1/*` | (404) | Endpoints non testés (auth requise probablement) |

## Pages NON auditées (et pourquoi)

- **engine staging** (`analytics-engine.staging.veridian.site/workspaces/.../welcome`) : accessible
  via un onglet préexistant. Vu un H1 "Démarrage" + "Copier le snippet" qui rend, semble OK. Pas
  d'audit profond ; pourrait avoir aussi les bugs de branding/blank pages mais pas vérifié page
  par page.
- **Engine prod auth-required** (toutes les routes /workspaces, /settings) : impossible parce
  que pas de compte admin. Pour les tester il faut d'abord fixer BUG-01 et bootstrap un admin.
- **Mobile responsive réel** : Chrome MCP `resize_window` ne change pas `window.innerWidth`
  (DPR ou bug MCP), donc je n'ai pas pu tester un vrai viewport mobile 375×812. Les chiffres
  rapportés "24 buttons < 32px height" viennent du viewport 1900px (BUG-16 reste valable, ce
  sont des boutons trop petits en absolute pixels).
- **Flow signup / login Hub** : pas dans le scope (Hub est un autre repo, on n'audite que les
  apps Analytics).
- **Tests de soumission de formulaires** : refusé d'envoyer un email/password réel sur la
  démo (pour éviter de polluer la DB) — j'ai juste probé les endpoints en POST et vu les 401/404.

## Frictions rencontrées

- **Chrome MCP `resize_window`** ne déclenche pas un vrai resize du viewport CSS, le
  `window.innerWidth` reste à 1900px. Je n'ai pas pu tester le vrai responsive mobile.
  → suggestion : utiliser un device emulation MCP si disponible, sinon vérifier visuellement
  via screenshot avec une largeur forcée
- **Console errors massivement polluées par les extensions Chrome** (Tag Assistant, autres
  vendor.js) — j'ai dû filtrer manuellement. Pour les audits futurs, lancer Chrome MCP dans
  un profil sans extensions ou ajouter un filter pattern qui exclut `chrome-extension://`
- **`get_page_text`** retourne le contenu prioritisé "article-mode", ce qui rend "Loading..."
  sur les pages SPA qui n'ont pas encore hydraté. Pour vérifier qu'une page n'est PAS
  blanche, il faut compter `document.body.innerText.length` via `javascript_tool`.
- **Aucune trace d'analytics** : Veridian Analytics ne se trace pas lui-même (au moins pas
  via un script visible dans le HTML). Anti-dogfooding ? À voir s'il y a une raison ou si
  c'est un oubli.

## Recommandation ordre de fix

**Sprint sécurité immédiat (cette semaine)** — 4 tickets :
1. BUG-01 (admin form public sans auth) — **AUJOURD'HUI**
2. BUG-11 (robots.txt prod = robots démo, indexe le formulaire admin = pire) — aujourd'hui
3. BUG-17 (CSP missing) — cette semaine
4. BUG-22 (favicon proxy sans whitelist/auth) — cette semaine

**Sprint démo crédible (cette semaine)** — 6 tickets :
5. BUG-02 (Veridian tab 404) — la valeur ajoutée Veridian doit marcher sur la démo
6. BUG-03/04/05 (goals/filters/settings blank) — la nav doit pas mener à du vide
7. BUG-06 (live counter garbage)
8. BUG-07 (install-sdk 404)

**Sprint branding (1 PR groupée)** — 5 tickets liés :
9. BUG-08/09/10/13/20 — clean tout l'upstream staminads en une passe

**Sprint qualité (semaine suivante)** — 8 tickets :
10. BUG-12, 14, 15, 16, 18, 19, 21, 23

## Couverture estimée

- Pages testées avec inspection profonde : 11 routes
- Endpoints API probés : ~8 (workspaces, analytics.query, public-config, tools.favicon, /api/admin/tenant/*, /api/auth.setupAdmin, /health)
- Cibles couvertes : démo prod (full), engine prod (surface), démo staging (surface), bridge prod (surface)
- Cibles non couvertes : engine prod auth-required (bloqué par BUG-01), engine staging détail

## Métadonnées

- **Outils utilisés** : Chrome MCP (navigate, read_page, read_console_messages, read_network_requests, javascript_tool), curl direct
- **Durée audit** : ~30 min
- **Aucun build local** : interdiction respectée, zéro `npm`/`vite`/`docker` sur la machine Robert
- **Aucun code applicatif modifié** : zéro fix, juste 23 tickets markdown + ce README

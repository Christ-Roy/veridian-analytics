# 🎨 UI-POLISH — Backlog dashboard avec Robert (hot-reload)

> **But** : tenir à jour la liste des écrans / composants qui méritent un polish UI.
> Itéré en LIVE avec Robert sur l'env DEV hot-reload (`https://dev-server-1.tail324436.ts.net/`).
> Une modif `.ts/.tsx` côté agent → NestJS/Next watch redémarre → Robert recharge la page → feedback en 5 sec.
>
> **Workflow type** :
> 1. Robert dit "le tableau X est moche" / "ce bouton est mal placé"
> 2. Agent identifie le composant, le modifie sur la branche `dev`
> 3. `git push origin dev` → CI dev-checks (~30s)
> 4. `ssh dev-pub 'bash /opt/dev/analytics-engine/scripts/dev-up.sh'` → reload
> 5. Robert rafraîchit, valide ou demande ajustement
> 6. Quand validé : `git checkout staging && git merge dev && git push` → promotion

> Mis à jour : 2026-05-20

---

## 🔥 En cours (à polish dans cette session)

> Coche pour archiver. Section vide = rien en attente de Robert.

- [ ] *(rien pour l'instant — ajouter dès qu'un screen a besoin de polish)*

---

## 📋 Backlog priorisé (par fréquence d'usage)

### 🟧 Vue dashboard tenant — pages les plus regardées

#### `/dashboard` (overview tenant)
- [ ] **Cartes KPI en haut** : pageviews 7j / 30j / 90j, formulaires, appels — vérifier hiérarchie visuelle, padding, contraste
- [ ] **Graphe principal** : engagement par jour — currently echarts ? Tester sur mobile, vérifier responsive
- [ ] **Liste "top pages"** : tableau ou cards ? Vérifier la lisibilité quand >20 lignes
- [ ] **Sélecteur de période** : actuellement où ? UX picker date-range
- [ ] **État vide** quand le tenant n'a pas encore d'events : illustration + CTA "Installe le tracker"

#### `/dashboard/gsc` (Google Search Console)
- [ ] **Tableau queries** : 1000+ lignes possibles, performance scroll/pagination ?
- [ ] **Filtres** : combinaison query × URL × pays — actuellement utilisable ?
- [ ] **Détail query** : modal ou page ? Vérifier la lecture mobile
- [ ] **Empty state** quand GSC pas connecté : guide pas-à-pas pour connecter

#### `/dashboard/forms` (soumissions de formulaires)
- [ ] **Tableau soumissions** : lisibilité champs longs (email + texte libre)
- [ ] **Détail soumission** : expand inline ou modal ?
- [ ] **Export CSV** : présent ? Bouton bien visible ?
- [ ] **Filtre par formulaire** : si plusieurs forms sur le même site

#### `/dashboard/calls` (appels SIP/VoIP)
- [ ] **Liste appels** : durée, numéro source, destination, statut — tableau readable ?
- [ ] **Audio player inline** pour les enregistrements ? (si feature présente)
- [ ] **Lien vers la session web matchée** (quand on aura le tracking VoIP)

#### `/dashboard/push` (notifications push PWA)
- [ ] **Liste abonnés** : nombre, segment par device, vérifier lisibilité
- [ ] **Form "envoyer une notif"** : preview du rendu push, validation longueur title/body
- [ ] **Historique des envois** : tableau open rate / click rate

#### `/dashboard/settings`
- [ ] **Gestion des membres** : tableau memberships + bouton invite — design ?
- [ ] **API key / siteKey** : affichage + bouton "régénérer", confirmation
- [ ] **Webhook URLs** (si feature) : présent ? lisible ?
- [ ] **Custom UTM presets** : à créer pour la convention UTM standardisée (cf sprint shortener)

### 🟧 Admin (Robert SUPERADMIN)

#### `/admin` (overview cross-tenants)
- [ ] **Liste tenants** : tableau avec slug, nb sites, pageviews 30j, statut, plan — lisible ?
- [ ] **Bouton impersonate** : actuellement comment ? Banner visible quand impersonné ?
- [ ] **Action rapide "créer tenant"**

#### `/admin/sites`
- [ ] **Liste sites** + edition domain, siteKey
- [ ] **Bouton "régénérer siteKey"** + confirmation

#### `/admin/gsc`
- [ ] **Statut sync GSC** par site (date dernier sync, status)
- [ ] **Bouton "force resync"**

#### `/admin/short-links` 🆕 (à créer dans sprint S1)
- [ ] **Liste paginée** filtrable par tenant
- [ ] **Modale création** : slug auto-suggéré, UTM dropdowns standardisés (utm_source en select des canaux connus)
- [ ] **Stats inline** : clicks 7j/30j
- [ ] **Page détail** : graphe temporel + top referrers + top pays
- [ ] **Bouton "copier"** avec feedback toast

#### `/admin/migration-diff` 🆕 (à créer dans sprint S2)
- [ ] **Tableau par tenant × 30j** : pageviews_legacy / pageviews_staminads / écart %
- [ ] **Couleurs feu tricolore** : vert <5%, jaune 5-10%, rouge >10%
- [ ] **Graphe temporel** par tenant pour repérer les pics de divergence
- [ ] **Bouton "investiguer"** → drill-down sur les events qui divergent

### 🟧 Auth & onboarding

#### `/login`
- [ ] **Form credentials** : design actuel à revoir ?
- [ ] **Magic link** : UX du "vérifier ton email"
- [ ] **Boutons OAuth Google/Microsoft** 🆕 (cf ticket P5 quand SaaS public)

#### `/welcome` (onboarding nouveau tenant)
- [ ] **Wizard install tracker** : étape 1 (copier le snippet) → étape 2 (poser dans le `<head>`) → étape 3 (vérifier "I see pageviews!")
- [ ] **Détection auto** : ping `/api/check-tracker?siteKey=...` qui dit "✅ pageview reçu il y a 12s"

### 🟧 Tracker / public

#### Page d'erreur `/r/[slug]` (404 lien expiré ou invalide) 🆕
- [ ] **Illustration sympa** + "Ce lien n'existe pas ou a expiré"
- [ ] **CTA "retour à veridian.site"**

#### Banner cookie consent (sur sites clients)
- [ ] À fournir avec le snippet : modèle de banner cookie minimal RGPD-compliant
- [ ] **Bouton "Accepter" + "Refuser"** → set localStorage `vrd_consent`
- [ ] Tracker respecte le flag (pas de cookie `vrd_vid` si refusé)

---

## 🎨 Composants UI partagés à standardiser

À voir avec Robert en hot-reload :

- [ ] **Couleurs marque Veridian** : palette principale, accents, hover, danger — vérifier cohérence cross-pages
- [ ] **Boutons** : variantes primary / secondary / ghost / danger — tailles md/sm
- [ ] **Tableaux** : style header, hover row, pagination, vide
- [ ] **Cards KPI** : layout standardisé (label, valeur, delta vs période précédente, icône)
- [ ] **Toast / notification** : design (succès, erreur, info)
- [ ] **Modales** : sizing, overlay, fermeture (esc + click outside)
- [ ] **Forms** : labels, validation inline, messages d'erreur
- [ ] **Date range picker** : composant unique réutilisé partout
- [ ] **Empty state** : illustration + texte + CTA (modèle réutilisable)
- [ ] **Loading state** : skeleton vs spinner, cohérence
- [ ] **Mobile responsive** : audit page par page

---

## 📜 Règles polish UI

1. **Toujours en hot-reload sur env DEV** (`dev-server-1.tail324436.ts.net`), JAMAIS direct sur staging/prod
2. **Robert valide visuellement** chaque modif avant promotion staging → main
3. **Pas de refactor profond** dans le sprint POC démo — juste cosmétique + ergo (cf master prompt "ship-fast mode")
4. **Tests Playwright e2e** : à mettre à jour SEULEMENT si on change un sélecteur clé ou un flow user
5. **Pas de mock data** dans le dashboard : tester sur du vrai trafic (5 tenants prod ont du data)
6. **Accessibilité minimale** : alt sur images, label sur input, contraste WCAG AA, heading order
7. **À chaque polish** : `git commit -m "polish(ui): <feature> — <changement>"` pour traçabilité

---

## 📌 Comment ajouter une entrée

Quand Robert dit "X est moche" ou "Y mériterait un polish" :

1. Ajoute une checkbox dans la bonne section (Vue dashboard / Admin / etc.)
2. Format : `- [ ] **<emoji feature>** : <description courte>`
3. Si urgent / en cours : déplace en haut dans **"🔥 En cours"**
4. Quand validé : `[x]` la case, ou retire la ligne (les `[x]` peuvent être archivés tous les 30j dans `docs/changelog-ui.md`)

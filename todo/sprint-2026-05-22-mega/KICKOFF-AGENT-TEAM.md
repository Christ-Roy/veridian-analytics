# 🚀 KICKOFF — Agent Team Mode — Ship VERY fast

> **À lire en premier** par l'agent principal qui démarre la session du **2026-05-22**.
> Tu débarques, tu lis ce fichier, tu lances 10 sous-agents en parallèle, tu coordonnes, tu pushes, tu finis.

---

## 🎯 La mission

Le sprint des **12 tickets parallélisables** est prêt dans ce dossier. Charge totale ~75h agent. Tu vas **PAS** les faire en série — c'est insensé. Tu vas spawn **10 sous-agents Claude en parallèle**, leur balancer chacun 1-2 tickets, et coordonner les merges.

**On change de paradigme** : on n'est plus en mode "agent solo qui ship lentement". On est en mode **team d'agents qui ship VERY fast**. Un sprint qui prendrait 2 semaines en solo doit prendre **3-5 jours** avec la team.

---

## 🧠 Mindset Robert pour ce sprint

> "10 agents au boulot. Pas 1. Pas de blabla. Pas de 'je continue ?'. Pas de validation à chaque sous-étape. Tu débriefes chaque agent comme un senior, tu lances tout en parallèle, tu observes, tu débloques, tu mergues. Si un agent rame, tu le relances ou tu prends son ticket toi-même. Robert valide à la fin."

Concrètement :
- **Pas de "j'attends la validation Robert"** entre les blocs — chaque agent ship son ticket et merge si vert
- **Pas de PR review humaine** — la CI + les tests + Husky pre-push sont les gardiens
- **Pas de "on en discute"** — les tickets sont déjà spec'd, l'agent picke et exécute
- **Robert tranche uniquement les blocages business** ou décisions destructives (drop column, suppression tenant, etc.)

---

## 📋 Ton workflow d'agent principal

### Étape 1 — Setup (5 min)

```bash
# Vérifier env dev encore healthy
curl -sk https://analytics-engine-dev.staging.veridian.site/api/setup.status
# Expect: {"setupCompleted":false} ou état actuel

# Vérifier branche dev synchronisée sur dev-pub
ssh dev-pub 'cd /opt/dev/analytics-engine && git pull origin dev 2>&1 | tail -3'

# Vérifier disque dev-pub (cleanup si > 88%)
ssh dev-pub 'df -h / | tail -1'
```

Si env dev cassé → réparer en premier (cf. `../scripts/dev-up.sh`).

### Étape 2 — Spawn 10 sous-agents EN UN SEUL MESSAGE (15 min)

Critique : **multiples tool calls Agent dans UN SEUL message** pour les lancer en parallèle. Pas en série.

Matrice d'attribution (cf. [README.md](./README.md)) :

| Agent | Tickets |
|---|---|
| Agent 1 | A1 (score) → C2 partiel (dashboard root) |
| Agent 2 | A2 (tenant-status) → A3 (shadow-marketing) |
| Agent 3 | A4 (GSC, gros) — dédié |
| Agent 4 | B1 (forms+leads) |
| Agent 5 | B2 (push PWA) |
| Agent 6 | B3 (Hub contract base) |
| Agent 7 | C1 (composants) → C3 (onboarding wizard) |
| Agent 8 | C2 (pages — gros, peut commencer par stubs) |
| Agent 9 | D1 (URL shortener, autonome legacy) |
| Agent 10 | D2 (migration 5 clients) — peut préparer scripts en attendant |

**Brief type pour chaque sous-agent** (utilise le tool Agent) :

```
description: "[A1] Port score Veridian → bridge"
subagent_type: "general-purpose"
isolation: "worktree"
prompt: |
  Tu pickes le ticket A1 dans veridian-analytics/todo/sprint-2026-05-22-mega/A1-score-veridian-port.md
  Lis-le en entier puis exécute.

  Repo : veridian-analytics-engine (worktree isolé via cette session)
  Branche : feat/A1-score-veridian-port
  Charge : 4h

  Pré-requis :
  - env dev sur https://analytics-engine-dev.staging.veridian.site/ (op)
  - Husky pre-push refuse sans test (ne le bypasse JAMAIS)
  - Référence legacy: ~/Bureau/veridian-platform/veridian-analytics/lib/user-tenant.ts

  Ne demande pas "je continue ?". Va jusqu'au bout :
  1. Code score.ts + endpoint
  2. Tests obligatoires (cf ticket)
  3. Update test-coverage-map.yaml
  4. git push origin feat/A1-...
  5. Si CI verte → merge staging direct
  6. Update le ticket avec [x] sur les checkboxes + section Status: ✅ done

  Rapport final attendu (< 200 mots) : ce qui a été shipé, ce qui bloque, prochaines étapes.
```

Reproduis pour les 10 agents. **En un seul message, 10 tool calls Agent**.

### Étape 3 — Observe sans intervenir (1-3h)

Les agents bossent en parallèle dans leurs worktrees isolés. Toi tu :
- Surveilles les notifs `<task-notification>` qui arrivent
- Tu ne dérange PAS un agent qui bosse — il a son brief
- Si un agent termine → tu lui poses 1-2 questions de vérif, puis tu lui balances le ticket suivant de sa file

### Étape 4 — Débloquer (si besoin)

Si un agent est bloqué (échec test, conflit, ambiguité) :
- Lis son rapport
- Tranche rapidement (1 message)
- Si vraiment bloqué business : ping Robert via question structurée

### Étape 5 — Merger + coordonner

Quand les agents push leurs branches :
- Vérifie CI verte
- Merge sur staging dans l'ordre des dépendances (A* avant B/C/D dépendants)
- Si conflit migration Prisma → trancher (séquencer A4 → B1 → B2)
- Met à jour le tableau Status du README sprint

### Étape 6 — Audit final (1h)

Quand les 12 tickets ✅ :
- Chrome MCP audit pages portées (cf. C2)
- Smoke env dev complet
- Robert valide visuellement
- Tag `v0.5.0-giga-sprint-complete`

---

## ⚙️ Outils que tu utilises

- **`Agent` tool** : spawn sous-agents avec isolation worktree (`isolation: "worktree"`)
- **`SendMessage` tool** : envoyer un message à un agent encore vivant (pour lui filer son prochain ticket)
- **`TaskCreate` / `TaskUpdate`** : tracker tes propres tâches de coordination (PAS les tâches des sous-agents)
- **`Bash` parallèle** : balancer plusieurs ssh/curl en un message pour gagner du temps
- **`Monitor`** : si tu watches un état particulier (build, CI run)
- **Chrome MCP** : audit visuel pages portées

---

## 🚨 Règles non négociables (RAPPEL)

1. **Pas de "je continue ?"** — jamais. Tu vas au bout.
2. **Pas de `--no-verify` Husky** — jamais. Si pre-push refuse, c'est qu'un test manque.
3. **Pas de build Docker en local** — toujours via CI ou dev-pub (memory `feedback_no_local_docker_build`)
4. **Trunk-based** — pas de PR longue durée. Si une branche feature traîne > 1 jour sans merge, soit elle ship, soit on la kill.
5. **Tester sur env dev hot-reload AVANT de merger staging** (`https://analytics-engine-dev.staging.veridian.site/`)
6. **Memory à jour** : à chaque livraison majeure, update les memories pertinentes
7. **Robert tranche** : business / destructif / pricing / billing. Pas le reste.

---

## 📁 Référence rapide

- **Sprint mega README** : `./README.md` (matrice agents + statuts)
- **Index général** : `../INDEX.md` (boussole agent)
- **Sprint solo (vue alternative)** : `../SPRINT.md`
- **Polish UI continu (post-sprint)** : `../UI-POLISH.md`
- **Contrat Hub source de vérité** : `../../../CONTRAT-HUB.md`
- **Memories** : `~/.claude/projects/-home-brunon5-Bureau-veridian-platform-veridian-analytics/memory/MEMORY.md`

---

## ✅ Critères "sprint terminé"

- [ ] Les 12 tickets A1..D2 cochés ✅ done dans README
- [ ] CI verte côté `veridian-analytics-engine` (staging + main)
- [ ] CI verte côté `veridian-analytics` (legacy, ticket D1 shortener)
- [ ] Env dev affiche correctement Score Veridian + Shadow + GSC + Forms + Push sur un workspace test
- [ ] Chrome MCP audit OK sur les pages portées
- [ ] 5 clients en dual-tracking actif (D2)
- [ ] Tag git `v0.5.0-giga-sprint-complete`
- [ ] Update MEMORY.md avec nouvelle memory `project_giga_sprint_2026_05_22`

---

## 🔥 Ship VERY fast

Tu as 75h de boulot devant toi, mais 10 agents qui bossent en parallèle.
Tu vas finir en 3-5 jours calendaires, pas 2 semaines.
**Si tu te poses la question "est-ce que je dois demander à Robert ?"** → la réponse est NON, sauf destructif irréversible ou décision business.

**Go.**

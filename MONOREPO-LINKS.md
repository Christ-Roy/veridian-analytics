# Liens vers le monorepo veridian-platform

> Ce repo a été extrait de `Christ-Roy/veridian-platform` le 2026-05-13.
> L'historique git d'analytics est préservé via `git filter-repo --subdirectory-filter analytics/`.
> Les autres apps Veridian (cms, twenty, sites clients, infra) restent dans le monorepo.
> Hub, Prospection et Notifuse ont aussi été extraits en repos polyrepo.

## Quand consulter le monorepo

| Tu cherches… | Va voir là-bas |
|---|---|
| Backlog stratégique cross-apps, ordre des sprints | `veridian-platform/todo/TODO-LIVE.md` |
| Vision globale plateforme, architecture cross-apps | `veridian-platform/CLAUDE.md` |
| Doc d'une autre app (cms, twenty…) | `veridian-platform/todo/apps/<app>/TODO.md` |
| Sprint GitOps (référence transverse) | `~/Bureau/SPRINT-GITOPS-VERIDIAN.md` (local) |
| Standards CI/CD partagés (workflows réutilisables) | `veridian-platform/.github/workflows/_*.yml` |
| Pattern blue-green Veridian | mémoire `project_blue_green_pattern` |
| Configuration Dokploy + naming convention | mémoire `project_infra_pieges` + `runbooks/standards/dokploy-naming.md` |

Worktree local du monorepo (read-only par convention) :
`~/Bureau/veridian-platform-main/`

## Repos polyrepo Veridian (frères)

| App | Repo | Worktree local |
|---|---|---|
| Hub | `Christ-Roy/veridian-hub` | `~/Bureau/veridian-hub/` |
| Prospection | `Christ-Roy/veridian-prospection` | `~/Bureau/veridian-prospection/` |
| Notifuse (deploy) | `Christ-Roy/notifuse-deploy` | `~/Bureau/notifuse-deploy/` |
| **Analytics** | `Christ-Roy/veridian-analytics` | `~/Bureau/veridian-platform-analytics/` |

## Inter-app communication

Analytics est consommée par Hub (lecture stats tenant) **via URL publique** :
`https://analytics.app.veridian.site` (pas de nom de container interne).

Auth inter-services : header `Authorization: Bearer <ADMIN_API_KEY>`.

Si tu modifies un endpoint d'Analytics consommé par Hub :
- Ouvre une issue ici (`Christ-Roy/veridian-analytics`)
- Coordonne avec le repo Hub avant breaking change

## Ne pas copier de code entre les deux repos

- Si une feature Analytics demande un changement dans Hub / CMS / etc.,
  c'est au team lead de l'app concernée de le faire dans son repo
- Si un standard CI doit être partagé (workflow réutilisable), il vit
  dans le monorepo et est référencé via `uses: Christ-Roy/veridian-platform/.github/workflows/_x.yml@main`

## Sortir le repo du worktree pattern monorepo

Le dossier local `~/Bureau/veridian-platform-analytics/` continue à pointer
vers ce repo polyrepo (origin = `Christ-Roy/veridian-analytics`).
Plus de relation avec le worktree monorepo après l'extraction du 2026-05-13.

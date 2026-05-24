# [ANALYTICS] Endpoint `POST /api/sso/issue-magic-link` — Hub livré, ton tour

> **Type** : Endpoint contractuel cross-app (Couche 4 SSO)
> **Sévérité** : 🟡 P2
> **Owner** : agent Analytics
> **Spec parent** : `veridian-hub/docs/CONTRAT-HUB.md` §6bis.8
> **Hub livré** : 2026-05-23
> **Créé** : 2026-05-23

## Statut côté Hub

Le Hub a livré la **Couche 4 — Bounce OAuth** (cf. CONTRAT-HUB §6bis.8) :

- ✅ `/login?next=<url>` valide whitelist regex anti open-redirect
- ✅ Cookie signé `__Secure-veridian-next` (HMAC AUTH_SECRET, TTL 10min)
- ✅ Routes `/api/auth/bounce/{prepare,complete}` câblées
- ✅ Gestion erreurs 5xx / 400 user_not_in_app / cookie absent
- ✅ Tests Vitest exhaustifs

**Ce qui reste à livrer côté Analytics** : l'endpoint
`POST /api/sso/issue-magic-link` qui sera appelé par le Hub en HMAC
après chaque OAuth Hub réussi pour le bounce vers Analytics.

## Spec exacte à livrer

```
POST /api/sso/issue-magic-link
Headers:
  X-Veridian-Timestamp: <unix_ms>
  X-Veridian-Hub-Signature: <hex(hmac_sha256(HUB_API_SECRET, "{ts}.{body}"))>
  Content-Type: application/json
Body:
  { "hub_user_id": "<uuid>", "email": "<string>" }
```

### Réponses attendues

- **200** : `{ "magic_link_url": "https://analytics.app.veridian.site/auth/token?t=..." }`
  - URL DOIT être https + host `*.veridian.site`
  - Réutiliser logique magic_link Couche 3 existante
- **400 user_not_in_app** : `{ "error": "user_not_in_app" }`
  - Hub redirige vers `/dashboard?app=analytics&hint=signup`
  - **Ne PAS** auto-créer de tenant
- **401/403** : HMAC invalide
- **5xx** : Hub redirige `/auth/bounce/error?app=analytics&code=unreachable`

## ENV côté Analytics

| Var | Convention |
|---|---|
| `HUB_API_SECRET` | secret HMAC partagé (côté Hub = `ANALYTICS_HUB_API_SECRET`) |

Côté Hub : ENV `ANALYTICS_API_URL` + `ANALYTICS_HUB_API_SECRET` à câbler
dans `compose/prod.yml` + `compose/staging.yml` (actuellement seul
`ANALYTICS_API_URL` + `ANALYTICS_ADMIN_KEY` existent — coordonner avec
l'agent Hub pour ajouter le secret HMAC standardisé au moment où Analytics
livre cet endpoint).

## Tests CI bloquants à ajouter (§6bis.8.5)

- HMAC invalide → 401
- HMAC valide + user en local → 200
- HMAC valide + user inconnu → 400 `user_not_in_app`
- Magic link consommé → session Analytics posée
- Rate limit 10/min/user

## Bouton UI login Analytics (§6bis.8.1)

```tsx
<Button onClick={() => {
  const next = encodeURIComponent(window.location.href);
  window.location.href = `https://app.veridian.site/login?next=${next}`;
}}>
  <GoogleLogo /> Continuer avec Google
</Button>
```

Aucun provider OAuth local côté Analytics — tout au Hub.

## Estimation

~1 jour (endpoint + tests + boutons UI).

## Référence

- `veridian-hub/docs/CONTRAT-HUB.md` §6bis.8
- `veridian-hub/todo/2026-05-20-fallback-login-apps-redirect-hub.md`
- Code Hub livré : `veridian-hub/lib/auth/bounce-{next,apps}.ts`,
  `app/api/auth/bounce/{prepare,complete}/route.ts`

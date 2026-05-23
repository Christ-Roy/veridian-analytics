# [BUG-22] API `/api/tools.favicon?url=...` proxifie publiquement n'importe quel favicon — risque SSRF-light + abus

> **Sévérité** : 🟡 P1 (vecteur d'abus / fuite IP serveur vers domaines tiers / pas d'authentification)
> **Cible** : démo prod (testé), probablement engine prod aussi
> **URL exacte** : https://demo-analytics.veridian.site/api/tools.favicon?url=...
> **Détecté** : 2026-05-23

## Symptôme observé

L'endpoint `/api/tools.favicon?url=<X>` :
- Accepte n'importe quelle URL en paramètre `url`
- Est appelé sans authentification (public)
- Retourne un PNG (vraie favicon ou stub 68 bytes si fetch échoue)

Probes effectués :
```bash
$ curl "https://demo-analytics.veridian.site/api/tools.favicon?url=http://169.254.169.254/latest/meta-data/" 
→ PNG stub 68 bytes (HTTP 200) — fetch a échoué, fallback OK

$ curl "https://demo-analytics.veridian.site/api/tools.favicon?url=http://localhost:5432/" 
→ PNG stub 68 bytes (HTTP 200) — pas exploitable directement

$ curl "https://demo-analytics.veridian.site/api/tools.favicon?url=file:///etc/passwd" 
→ PNG stub 68 bytes (HTTP 200) — bloqué

$ curl "https://demo-analytics.veridian.site/api/tools.favicon?url=https://google.com" 
→ vraie favicon Google (HTTP 200)
```

Bonne nouvelle : **pas de fuite directe** (le fallback PNG masque les erreurs). Mais :

## Risques résiduels

1. **Le serveur Veridian fait des requêtes vers n'importe quelle URL** indiquée par n'importe
   quel visiteur (puisque l'endpoint est non-authentifié). Conséquences :
   - **Légal** : si quelqu'un proxifie en masse des requêtes vers un site tiers, le tiers
     verra des requêtes venant de l'IP serveur Veridian → potentiellement IP-banlist
     Veridian
   - **Abus** : un attaquant peut utiliser Veridian comme amplificateur pour faire des
     requêtes (bypass IP allowlist, brouiller son trafic)
   - **Coût** : si on ne rate-limit pas, n'importe qui peut faire du DOS sur l'endpoint
     → coût bandwidth + CPU
2. **Timing-based info disclosure** : même si le PNG est uniforme, la latence de réponse
   peut révéler si le serveur destination existe ou non (open/closed port scanning)
3. **Pas de validation** : l'URL n'est même pas check pour les schemes `file://`, `gopher://`,
   etc. (heureusement node fetch ne supporte que http/https)

## Comportement attendu

L'endpoint doit :
1. **Whitelister** les URLs : soit liste fermée (les domaines des workspaces clients), soit
   regex stricte (http/https uniquement, pas d'IP privée RFC1918, pas de loopback, pas de
   link-local 169.254/16)
2. **Rate-limit** : 30 req/min par IP par exemple
3. **Authentifier** : exiger un cookie session valide (interdire l'accès anonyme), sauf
   pour les domaines visibles sur la démo (whitelist hardcodée)
4. **Cache aggressively** : un favicon ne change pas souvent ; mettre `Cache-Control:
   public, max-age=86400`. L'origine ne devrait fetch que rarement
5. **Timing-equalize** : retourner toujours en ~300ms (delay artificiel si fetch trop rapide)
   pour empêcher le port scanning timing

## Suggestion fix

```ts
// pseudo-code
app.get('/api/tools.favicon', rateLimit({windowMs: 60_000, max: 30}), async (req, res) => {
  const url = req.query.url
  if (!isAllowedFaviconUrl(url)) return res.status(400).send(stubPng)
  const cached = await cache.get(url)
  if (cached) return res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(cached)
  const result = await fetchFaviconWithTimeout(url, 2000)
  await cache.set(url, result, 86400)
  res.set('Cache-Control', 'public, max-age=86400').type('image/png').send(result)
})

function isAllowedFaviconUrl(url: string) {
  try {
    const u = new URL(url)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    if (isPrivateOrLoopbackHost(u.hostname)) return false
    return true
  } catch { return false }
}
```

## Lié

BUG-14 (logo Apple chargé depuis apple.com) — proxifier les logos via cet endpoint serait
naturel, mais d'abord faut le sécuriser.

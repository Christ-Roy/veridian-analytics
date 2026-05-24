# [BUG-18] Header `x-powered-by: Express` exposé — info disclosure mineure

> **Sévérité** : 🟢 P2 (cosmétique sécu)
> **Cible** : démo prod + engine prod
> **URL exacte** : https://analytics-engine.app.veridian.site/
> **Détecté** : 2026-05-23

## Symptôme observé

```
$ curl -sI https://analytics-engine.app.veridian.site/ | grep -i powered
x-powered-by: Express
```

## Risques

- Disclosure du framework backend
- Aide marginale aux attaquants pour cibler des CVE Express
- Standard "good hygiene" : la baseline OWASP recommande de masquer ce header

## Comportement attendu

Pas de header `x-powered-by` (ou alors une valeur custom marketing comme
`x-powered-by: Veridian`).

## Suggestion fix

Dans le code Express (apps/web/server.ts ou équivalent) :
```ts
app.disable('x-powered-by')
```

Ou via `helmet()` qui le fait par défaut.

Test :
```ts
test('no x-powered-by header', async ({ request }) => {
  const r = await request.get('/')
  expect(r.headers()['x-powered-by']).toBeUndefined()
})
```

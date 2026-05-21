// e2e — Raccourcisseur d'URL D1.
//
// Flow : creer un lien via l'API admin -> hit /r/<slug> -> verifier 302 +
// UTM injectes -> verifier clickCount incrémenté via API stats.
//
// Skip si ADMIN_API_KEY non set (cas runs locaux sans env complet).

import { test, expect } from '@playwright/test';

const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

test.describe('URL shortener — D1', () => {
  test.skip(!ADMIN_KEY, 'ADMIN_API_KEY not set');

  let createdId = '';
  let createdSlug = '';

  test('creates a short link via admin API', async ({ request }) => {
    const res = await request.post('/api/admin/short-links', {
      headers: { 'x-admin-key': ADMIN_KEY },
      data: {
        targetUrl: 'https://veridian.site/blog/test-e2e',
        utmSource: 'linkedin',
        utmMedium: 'social',
        utmCampaign: `e2e-${Date.now().toString(36)}`,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.shortLink.slug).toBeTruthy();
    createdId = body.shortLink.id;
    createdSlug = body.shortLink.slug;
  });

  test('rejects creation with javascript: target (open-redirect protection)', async ({
    request,
  }) => {
    const res = await request.post('/api/admin/short-links', {
      headers: { 'x-admin-key': ADMIN_KEY },
      data: { targetUrl: 'javascript:alert(1)' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects creation with invalid slug format', async ({ request }) => {
    const res = await request.post('/api/admin/short-links', {
      headers: { 'x-admin-key': ADMIN_KEY },
      data: { targetUrl: 'https://veridian.site', slug: 'BAD SLUG' },
    });
    expect(res.status()).toBe(400);
  });

  test('redirects /r/<slug> to targetUrl with UTM injected', async ({
    request,
  }) => {
    test.skip(!createdSlug, 'short link creation failed');
    const res = await request.get(`/r/${createdSlug}`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(302);
    const loc = res.headers()['location'];
    expect(loc).toBeTruthy();
    const u = new URL(loc!);
    expect(u.searchParams.get('utm_source')).toBe('linkedin');
    expect(u.searchParams.get('utm_medium')).toBe('social');
  });

  test('GET /r/<missing-slug> returns 307 to not-found', async ({ request }) => {
    const ghost = `ghost-${Date.now().toString(36)}`;
    const res = await request.get(`/r/${ghost}`, { maxRedirects: 0 });
    // 307 vers /r/<slug>/not-found, qui renvoie ensuite une page 200.
    expect([307, 404]).toContain(res.status());
  });

  test('click increments counter (stats endpoint)', async ({ request }) => {
    test.skip(!createdId || !createdSlug, 'no created link');
    // Hit le lien (le tracking est fire-and-forget, le serveur peut etre
    // legerement en retard — on attend 1s pour laisser la promise se settle)
    const r1 = await request.get(`/r/${createdSlug}`, { maxRedirects: 0 });
    expect(r1.status()).toBe(302);
    await new Promise((r) => setTimeout(r, 1500));
    const stats = await request.get(
      `/api/admin/short-links/${createdId}/stats?days=1`,
      { headers: { 'x-admin-key': ADMIN_KEY } },
    );
    expect(stats.status()).toBe(200);
    const body = await stats.json();
    expect(body.windowTotal).toBeGreaterThanOrEqual(1);
  });

  test('PATCH updates targetUrl and the new URL is served after revalidate', async ({
    request,
  }) => {
    test.skip(!createdId || !createdSlug, 'no created link');
    const newTarget = 'https://veridian.site/blog/test-e2e-updated';
    const patch = await request.patch(`/api/admin/short-links/${createdId}`, {
      headers: { 'x-admin-key': ADMIN_KEY },
      data: { targetUrl: newTarget },
    });
    expect(patch.status()).toBe(200);
    // unstable_cache + revalidateTag : le prochain hit doit aller a la nouvelle URL.
    // Petite latence pour laisser la revalidation se propager.
    await new Promise((r) => setTimeout(r, 500));
    const r = await request.get(`/r/${createdSlug}`, { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    const loc = r.headers()['location'];
    expect(loc?.startsWith(newTarget)).toBe(true);
  });

  test('DELETE soft-deletes (subsequent hit -> 307 not-found)', async ({
    request,
  }) => {
    test.skip(!createdId || !createdSlug, 'no created link');
    const del = await request.delete(`/api/admin/short-links/${createdId}`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    });
    expect(del.status()).toBe(200);
    await new Promise((r) => setTimeout(r, 500));
    const r = await request.get(`/r/${createdSlug}`, { maxRedirects: 0 });
    expect([307, 404]).toContain(r.status());
  });
});

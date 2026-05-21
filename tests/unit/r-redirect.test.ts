// Tests du handler /r/[slug] (redirect public + click tracking).
//
// On mocke :
//  - @/lib/short-links : resolveShortLink (cache wrapper) + buildRedirectUrl
//  - @/lib/prisma : shortLink.update + shortLinkClick.create (async)

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shortLink: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
    },
    shortLinkClick: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { GET } from '@/app/r/[slug]/route';
import { prisma } from '@/lib/prisma';

type PrismaMock = typeof prisma & {
  shortLink: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  shortLinkClick: {
    create: ReturnType<typeof vi.fn>;
  };
};

const p = prisma as PrismaMock;

function makeReq(ip = '203.0.113.1', extra: Record<string, string> = {}): Request {
  return new Request('http://test.local/r/foo', {
    headers: {
      'x-forwarded-for': ip,
      'user-agent': 'test-agent',
      ...extra,
    },
  });
}

describe('GET /r/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 307 to not-found page when slug does not exist', async () => {
    p.shortLink.findUnique.mockResolvedValueOnce(null);
    const res = await GET(makeReq('1.1.1.1'), {
      params: Promise.resolve({ slug: 'ghost' }),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('/r/ghost/not-found');
  });

  it('returns 307 to not-found when link is inactive', async () => {
    p.shortLink.findUnique.mockResolvedValueOnce({
      id: 'l1',
      slug: 'expired',
      targetUrl: 'https://x.com',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      expiresAt: null,
      active: false,
    });
    const res = await GET(makeReq('1.1.1.2'), {
      params: Promise.resolve({ slug: 'expired' }),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/not-found');
  });

  it('returns 307 to not-found when link is expired', async () => {
    p.shortLink.findUnique.mockResolvedValueOnce({
      id: 'l1',
      slug: 'expired',
      targetUrl: 'https://x.com',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      expiresAt: new Date(Date.now() - 1000),
      active: true,
    });
    const res = await GET(makeReq('1.1.1.3'), {
      params: Promise.resolve({ slug: 'expired' }),
    });
    expect(res.status).toBe(307);
  });

  it('returns 302 to target URL with UTM injected when slug exists', async () => {
    p.shortLink.findUnique.mockResolvedValueOnce({
      id: 'l1',
      slug: 'ok',
      targetUrl: 'https://veridian.site/blog',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'mars',
      utmTerm: null,
      utmContent: null,
      expiresAt: null,
      active: true,
    });
    const res = await GET(makeReq('1.1.1.4'), {
      params: Promise.resolve({ slug: 'ok' }),
    });
    expect(res.status).toBe(302);
    const loc = res.headers.get('location');
    expect(loc).toBeTruthy();
    const u = new URL(loc!);
    expect(u.origin + u.pathname).toBe('https://veridian.site/blog');
    expect(u.searchParams.get('utm_source')).toBe('linkedin');
    expect(u.searchParams.get('utm_medium')).toBe('social');
    expect(u.searchParams.get('utm_campaign')).toBe('mars');
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('tracks the click (1 update + 1 create) on a successful redirect', async () => {
    p.shortLink.findUnique.mockResolvedValueOnce({
      id: 'l-track',
      slug: 'tracked',
      targetUrl: 'https://veridian.site',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      expiresAt: null,
      active: true,
    });
    const res = await GET(
      makeReq('203.0.113.42', {
        referer: 'https://news.example/',
        'cf-ipcountry': 'fr',
      }),
      { params: Promise.resolve({ slug: 'tracked' }) },
    );
    expect(res.status).toBe(302);
    // Le tracking est fire-and-forget — on cede la microtask + un tick pour
    // laisser les promises se settle.
    await new Promise((r) => setImmediate(r));
    expect(p.shortLink.update).toHaveBeenCalledTimes(1);
    expect(p.shortLink.update).toHaveBeenCalledWith({
      where: { id: 'l-track' },
      data: { clickCount: { increment: 1 } },
    });
    expect(p.shortLinkClick.create).toHaveBeenCalledTimes(1);
    const createArgs = p.shortLinkClick.create.mock.calls[0][0];
    expect(createArgs.data.shortLinkId).toBe('l-track');
    expect(createArgs.data.ip).toBe('203.0.113.42');
    expect(createArgs.data.country).toBe('fr');
    expect(createArgs.data.referer).toBe('https://news.example/');
  });

  it('rate limits after 60 hits from the same IP (returns 429)', async () => {
    p.shortLink.findUnique.mockResolvedValue({
      id: 'l-rl',
      slug: 'rl',
      targetUrl: 'https://x.com',
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
      expiresAt: null,
      active: true,
    });
    // 60 hits OK
    const ip = '203.0.113.99';
    for (let i = 0; i < 60; i++) {
      const r = await GET(makeReq(ip), {
        params: Promise.resolve({ slug: 'rl' }),
      });
      // Soit 302 soit 429 — au moins on doit voir 429 au 61eme
      expect([200, 302, 307, 429].includes(r.status)).toBe(true);
    }
    // 61eme : doit etre 429
    const last = await GET(makeReq(ip), {
      params: Promise.resolve({ slug: 'rl' }),
    });
    expect(last.status).toBe(429);
    expect(last.headers.get('retry-after')).toBe('60');
  });
});

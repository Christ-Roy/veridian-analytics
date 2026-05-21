// Tests des API admin /api/admin/short-links.
//
// On mocke prisma + auth + revalidateTag. requireAdmin lit ADMIN_API_KEY.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    shortLink: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shortLinkClick: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { GET as ListGET, POST as ListPOST } from '@/app/api/admin/short-links/route';
import {
  GET as DetailGET,
  PATCH as DetailPATCH,
  DELETE as DetailDELETE,
} from '@/app/api/admin/short-links/[id]/route';
import { GET as StatsGET } from '@/app/api/admin/short-links/[id]/stats/route';
import { prisma } from '@/lib/prisma';

type PrismaMock = typeof prisma & {
  shortLink: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  shortLinkClick: {
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const p = prisma as PrismaMock;
const ADMIN_KEY = 'test-key-abcdefghijklmnop';

function adminReq(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: {
      'x-admin-key': ADMIN_KEY,
      'content-type': 'application/json',
      // IP unique par appel pour eviter le rate-limit interne de requireAdmin
      'x-forwarded-for': `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('admin /api/admin/short-links', () => {
  const ORIGINAL_KEY = process.env.ADMIN_API_KEY;

  beforeEach(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) delete process.env.ADMIN_API_KEY;
    else process.env.ADMIN_API_KEY = ORIGINAL_KEY;
  });

  describe('GET (list)', () => {
    it('rejects without admin key', async () => {
      const req = new Request('http://x/api/admin/short-links');
      const res = await ListGET(req);
      expect(res.status).toBe(401);
    });

    it('returns paginated list', async () => {
      p.shortLink.findMany.mockResolvedValueOnce([
        { id: 'l1', slug: 'a', targetUrl: 'https://x.com' },
      ]);
      p.shortLink.count.mockResolvedValueOnce(1);
      const res = await ListGET(adminReq('http://x/api/admin/short-links'));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(1);
      expect(body.total).toBe(1);
    });
  });

  describe('POST (create)', () => {
    it('400 on invalid target URL', async () => {
      const res = await ListPOST(
        adminReq('http://x/api/admin/short-links', 'POST', {
          targetUrl: 'not-a-url',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('400 on javascript: target URL', async () => {
      // zod url() accepte les schemes exotiques mais isValidTargetUrl refine
      const res = await ListPOST(
        adminReq('http://x/api/admin/short-links', 'POST', {
          targetUrl: 'javascript:alert(1)',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('400 on invalid slug format', async () => {
      const res = await ListPOST(
        adminReq('http://x/api/admin/short-links', 'POST', {
          targetUrl: 'https://x.com',
          slug: 'BAD SLUG',
        }),
      );
      expect(res.status).toBe(400);
    });

    it('creates with auto slug when no slug provided', async () => {
      // Simule un superadmin existant
      p.user.findFirst.mockResolvedValueOnce({ id: 'u-admin' });
      // findFreeSlug fait un findUnique : on retourne null (slug libre)
      p.shortLink.findUnique.mockResolvedValueOnce(null);
      p.shortLink.create.mockResolvedValueOnce({
        id: 'l-new',
        slug: 'page',
        targetUrl: 'https://veridian.site/page',
      });
      const res = await ListPOST(
        adminReq('http://x/api/admin/short-links', 'POST', {
          targetUrl: 'https://veridian.site/page',
        }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.shortLink.slug).toBe('page');
      expect(p.shortLink.create).toHaveBeenCalledTimes(1);
    });

    it('500 if no superadmin user exists', async () => {
      p.user.findFirst.mockResolvedValueOnce(null);
      const res = await ListPOST(
        adminReq('http://x/api/admin/short-links', 'POST', {
          targetUrl: 'https://x.com/page',
        }),
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe('no_superadmin_user_found');
    });
  });

  describe('GET / PATCH / DELETE [id]', () => {
    it('GET 404 if link not found', async () => {
      p.shortLink.findUnique.mockResolvedValueOnce(null);
      const res = await DetailGET(adminReq('http://x/api/admin/short-links/nope'), {
        params: Promise.resolve({ id: 'nope' }),
      });
      expect(res.status).toBe(404);
    });

    it('PATCH updates targetUrl with valid URL', async () => {
      p.shortLink.update.mockResolvedValueOnce({
        id: 'l1',
        slug: 'x',
        targetUrl: 'https://new.url',
      });
      const res = await DetailPATCH(
        adminReq('http://x/api/admin/short-links/l1', 'PATCH', {
          targetUrl: 'https://new.url',
        }),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      expect(res.status).toBe(200);
      expect(p.shortLink.update).toHaveBeenCalled();
    });

    it('PATCH rejects javascript: target URL', async () => {
      const res = await DetailPATCH(
        adminReq('http://x/api/admin/short-links/l1', 'PATCH', {
          targetUrl: 'javascript:alert(1)',
        }),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      expect(res.status).toBe(400);
    });

    it('DELETE soft-deletes by default (active=false)', async () => {
      p.shortLink.update.mockResolvedValueOnce({ id: 'l1', active: false });
      const res = await DetailDELETE(
        adminReq('http://x/api/admin/short-links/l1', 'DELETE'),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      expect(res.status).toBe(200);
      expect(p.shortLink.update).toHaveBeenCalledWith({
        where: { id: 'l1' },
        data: { active: false },
      });
    });

    it('DELETE ?hard=true triggers hard delete', async () => {
      p.shortLink.delete.mockResolvedValueOnce({ id: 'l1' });
      const res = await DetailDELETE(
        adminReq('http://x/api/admin/short-links/l1?hard=true', 'DELETE'),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      expect(res.status).toBe(200);
      expect(p.shortLink.delete).toHaveBeenCalled();
    });
  });

  describe('GET /:id/stats', () => {
    it('returns aggregated stats with empty data', async () => {
      p.shortLink.findUnique.mockResolvedValueOnce({
        id: 'l1',
        slug: 'foo',
        clickCount: 0,
      });
      p.shortLinkClick.findMany.mockResolvedValueOnce([]);
      const res = await StatsGET(
        adminReq('http://x/api/admin/short-links/l1/stats?days=7'),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalClickCount).toBe(0);
      expect(body.windowTotal).toBe(0);
      expect(body.clicksPerDay.length).toBeGreaterThan(0); // serie continue
      expect(body.topReferers).toEqual([]);
      expect(body.topCountries).toEqual([]);
    });

    it('aggregates referers and countries correctly', async () => {
      const now = new Date();
      p.shortLink.findUnique.mockResolvedValueOnce({
        id: 'l1',
        slug: 'foo',
        clickCount: 3,
      });
      p.shortLinkClick.findMany.mockResolvedValueOnce([
        { createdAt: now, referer: 'https://www.linkedin.com/feed', country: 'FR' },
        { createdAt: now, referer: 'https://www.linkedin.com/', country: 'fr' },
        { createdAt: now, referer: null, country: 'DE' },
      ]);
      const res = await StatsGET(
        adminReq('http://x/api/admin/short-links/l1/stats?days=7'),
        { params: Promise.resolve({ id: 'l1' }) },
      );
      const body = await res.json();
      expect(body.windowTotal).toBe(3);
      expect(body.topReferers[0]).toEqual({ referer: 'linkedin.com', count: 2 });
      // 'direct' pour le null referer
      expect(body.topReferers.find((r: { referer: string }) => r.referer === 'direct')).toBeTruthy();
      // Countries case-insensitive
      const fr = body.topCountries.find((c: { country: string }) => c.country === 'FR');
      expect(fr?.count).toBe(2);
    });

    it('404 when link does not exist', async () => {
      p.shortLink.findUnique.mockResolvedValueOnce(null);
      const res = await StatsGET(
        adminReq('http://x/api/admin/short-links/ghost/stats?days=30'),
        { params: Promise.resolve({ id: 'ghost' }) },
      );
      expect(res.status).toBe(404);
    });
  });
});

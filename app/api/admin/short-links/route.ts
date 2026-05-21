// /api/admin/short-links
//
// GET  : liste paginee des short-links (filtre tenantId optionnel)
// POST : creation (slug auto-genere depuis URL si non fourni)
//
// Guard : requireAdmin() (cf. lib/admin-auth.ts) — dual auth M2M
// (x-admin-key) OU session Auth.js superadmin.

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  handlePrismaError,
  jsonError,
  requireAdmin,
} from '@/lib/admin-auth';
import { auth } from '@/auth';
import { isSuperadmin } from '@/lib/admin-guard';
import {
  SLUG_REGEX,
  findFreeSlug,
  isValidTargetUrl,
  slugFromUrl,
} from '@/lib/short-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  targetUrl: z.string().url().max(2048).refine(isValidTargetUrl, {
    message: 'targetUrl must be http(s)',
  }),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(SLUG_REGEX, {
      message:
        'slug must be lowercase alphanumeric + dashes, start/end with alphanumeric',
    })
    .optional(),
  utmSource: z.string().max(64).optional(),
  utmMedium: z.string().max(64).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  tenantId: z.string().min(1).max(64).optional(),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

export async function GET(req: Request) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenantId') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)),
  );

  const where = tenantId ? { tenantId } : {};
  const [items, total] = await Promise.all([
    prisma.shortLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        targetUrl: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        tenantId: true,
        clickCount: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        tenant: { select: { id: true, slug: true, name: true } },
        createdByUser: { select: { id: true, email: true } },
      },
    }),
    prisma.shortLink.count({ where }),
  ]);

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}

/**
 * Resolution du `createdBy` :
 * - Si l'appel vient d'une session Auth.js superadmin -> user.id de la session
 * - Sinon (M2M via x-admin-key) -> resolution par email superadmin
 *   `SUPERADMIN_EMAIL` (env) ou premier SUPERADMIN trouve. Echec si aucun.
 */
async function resolveCreatedBy(): Promise<string | null> {
  const session = await auth().catch(() => null);
  if (isSuperadmin(session)) {
    const sUser = session?.user as { email?: string | null } | undefined;
    if (sUser?.email) {
      const u = await prisma.user.findUnique({
        where: { email: sUser.email },
        select: { id: true },
      });
      if (u) return u.id;
    }
  }
  // Fallback M2M : prend le premier SUPERADMIN. SUPERADMIN_EMAIL prioritaire si defini.
  const explicit = process.env.SUPERADMIN_EMAIL;
  if (explicit) {
    const u = await prisma.user.findUnique({
      where: { email: explicit },
      select: { id: true },
    });
    if (u) return u.id;
  }
  const fallback = await prisma.user.findFirst({
    where: { platformRole: 'SUPERADMIN' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return fallback?.id ?? null;
}

export async function POST(req: Request) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('invalid_payload', 400, {
      issues: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const createdBy = await resolveCreatedBy();
  if (!createdBy) {
    return jsonError('no_superadmin_user_found', 500, {
      hint: 'set SUPERADMIN_EMAIL env or create a SUPERADMIN user',
    });
  }

  // Slug : si fourni, on echoue clean en cas de conflit (409).
  // Sinon on genere depuis l'URL avec retries.
  let finalSlug: string;
  if (data.slug) {
    finalSlug = data.slug;
  } else {
    const base = slugFromUrl(data.targetUrl);
    try {
      finalSlug = await findFreeSlug(base);
    } catch {
      return jsonError('slug_generation_failed', 500);
    }
  }

  try {
    const link = await prisma.shortLink.create({
      data: {
        slug: finalSlug,
        targetUrl: data.targetUrl,
        utmSource: data.utmSource ?? null,
        utmMedium: data.utmMedium ?? null,
        utmCampaign: data.utmCampaign ?? null,
        utmTerm: data.utmTerm ?? null,
        utmContent: data.utmContent ?? null,
        tenantId: data.tenantId ?? null,
        createdBy,
        expiresAt: data.expiresAt ?? null,
      },
    });
    // On invalide tout le tag — pas d'impact, le cache stocke pas tous les
    // slugs simultanement, juste les hot. Le nouveau slug etant inconnu,
    // pas besoin d'invalider ; mais le tag invalide les eventuels listes.
    revalidateTag('short-links');
    return NextResponse.json({ shortLink: link }, { status: 201 });
  } catch (e) {
    const handled = handlePrismaError(e);
    if (handled) return handled;
    return jsonError('create_failed', 500);
  }
}

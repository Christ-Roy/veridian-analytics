// /api/admin/short-links/[id]
//
// GET    : detail d'un short-link (sans les clicks)
// PATCH  : update partiel (targetUrl, UTM, active, expiresAt)
// DELETE : soft delete (active=false). ?hard=true pour suppression dure.

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  handlePrismaError,
  jsonError,
  requireAdmin,
} from '@/lib/admin-auth';
import { isValidTargetUrl } from '@/lib/short-links';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  const { id } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, slug: true, name: true } },
      createdByUser: { select: { id: true, email: true } },
    },
  });
  if (!link) return jsonError('short_link_not_found', 404);
  return NextResponse.json({ shortLink: link });
}

const patchSchema = z
  .object({
    targetUrl: z
      .string()
      .url()
      .max(2048)
      .refine(isValidTargetUrl, { message: 'targetUrl must be http(s)' })
      .optional(),
    utmSource: z.string().max(64).nullable().optional(),
    utmMedium: z.string().max(64).nullable().optional(),
    utmCampaign: z.string().max(128).nullable().optional(),
    utmTerm: z.string().max(128).nullable().optional(),
    utmContent: z.string().max(128).nullable().optional(),
    active: z.boolean().optional(),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((v) => (v === undefined ? undefined : v === null ? null : new Date(v))),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'no_fields_to_update' });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonError('invalid_json');
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('invalid_payload', 400, { issues: parsed.error.flatten() });
  }

  try {
    const link = await prisma.shortLink.update({
      where: { id },
      data: parsed.data,
    });
    // Le cache resolveShortLink est tagge — on invalide pour que le prochain
    // hit prenne la nouvelle valeur (targetUrl, UTM, active).
    revalidateTag('short-links');
    return NextResponse.json({ shortLink: link });
  } catch (e) {
    return handlePrismaError(e) ?? jsonError('update_failed', 500);
  }
}

/**
 * Soft delete : active=false par defaut. ?hard=true pour delete dur.
 * Le soft delete vide les caches pour que la route /r/[slug] retourne 404.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  const { id } = await params;
  const url = new URL(req.url);
  const hard = url.searchParams.get('hard') === 'true';

  try {
    if (hard) {
      await prisma.shortLink.delete({ where: { id } });
    } else {
      await prisma.shortLink.update({
        where: { id },
        data: { active: false },
      });
    }
    revalidateTag('short-links');
    return NextResponse.json({ ok: true, hard });
  } catch (e) {
    return handlePrismaError(e) ?? jsonError('delete_failed', 500);
  }
}

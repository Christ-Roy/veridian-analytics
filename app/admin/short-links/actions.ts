'use server';

// Server actions /admin/short-links — wrapper autour des routes API
// internes. Pattern identique a /admin/actions.ts (cf. syncGscAction) :
// la logique vit dans la route handler, les actions injectent juste la
// clef admin et revalident le path.

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/admin-guard';
import { revalidatePath, revalidateTag } from 'next/cache';
import {
  findFreeSlug,
  isValidTargetUrl,
  SLUG_REGEX,
  slugFromUrl,
} from '@/lib/short-links';

export interface CreateShortLinkInput {
  targetUrl: string;
  slug?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  tenantId?: string;
  expiresAt?: string; // ISO date
}

export async function createShortLinkAction(input: CreateShortLinkInput) {
  const session = await auth();
  requireSuperadmin(session);

  if (!input.targetUrl || !isValidTargetUrl(input.targetUrl)) {
    return { ok: false as const, error: 'invalid_target_url' };
  }
  if (input.slug && !SLUG_REGEX.test(input.slug)) {
    return { ok: false as const, error: 'invalid_slug_format' };
  }

  // Resolve createdBy : l'email session -> id du user
  const sUser = session?.user as { email?: string | null } | undefined;
  if (!sUser?.email) {
    return { ok: false as const, error: 'no_session_user' };
  }
  const user = await prisma.user.findUnique({
    where: { email: sUser.email },
    select: { id: true },
  });
  if (!user) {
    return { ok: false as const, error: 'session_user_not_found_in_db' };
  }

  let finalSlug: string;
  if (input.slug) {
    const exists = await prisma.shortLink.findUnique({
      where: { slug: input.slug },
      select: { id: true },
    });
    if (exists) return { ok: false as const, error: 'slug_already_taken' };
    finalSlug = input.slug;
  } else {
    const base = slugFromUrl(input.targetUrl);
    try {
      finalSlug = await findFreeSlug(base);
    } catch {
      return { ok: false as const, error: 'slug_generation_failed' };
    }
  }

  let expiresAtDate: Date | null = null;
  if (input.expiresAt) {
    const d = new Date(input.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return { ok: false as const, error: 'invalid_expires_at' };
    }
    expiresAtDate = d;
  }

  try {
    const link = await prisma.shortLink.create({
      data: {
        slug: finalSlug,
        targetUrl: input.targetUrl,
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        utmTerm: input.utmTerm || null,
        utmContent: input.utmContent || null,
        tenantId: input.tenantId || null,
        createdBy: user.id,
        expiresAt: expiresAtDate,
      },
    });
    revalidateTag('short-links');
    revalidatePath('/admin/short-links');
    return { ok: true as const, shortLink: link };
  } catch (e) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return { ok: false as const, error: 'slug_already_taken' };
    }
    return { ok: false as const, error: 'create_failed' };
  }
}

export async function toggleShortLinkActiveAction(id: string, active: boolean) {
  const session = await auth();
  requireSuperadmin(session);
  await prisma.shortLink.update({ where: { id }, data: { active } });
  revalidateTag('short-links');
  revalidatePath('/admin/short-links');
  revalidatePath(`/admin/short-links/${id}`);
  return { ok: true as const };
}

export async function deleteShortLinkAction(id: string) {
  const session = await auth();
  requireSuperadmin(session);
  // Soft delete (active=false). Hard delete reserve a une route DELETE explicite.
  await prisma.shortLink.update({ where: { id }, data: { active: false } });
  revalidateTag('short-links');
  revalidatePath('/admin/short-links');
  return { ok: true as const };
}

export interface UpdateShortLinkInput {
  targetUrl?: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  active?: boolean;
}

export async function updateShortLinkAction(
  id: string,
  patch: UpdateShortLinkInput,
) {
  const session = await auth();
  requireSuperadmin(session);

  if (patch.targetUrl !== undefined && !isValidTargetUrl(patch.targetUrl)) {
    return { ok: false as const, error: 'invalid_target_url' };
  }

  try {
    const link = await prisma.shortLink.update({
      where: { id },
      data: patch,
    });
    revalidateTag('short-links');
    revalidatePath('/admin/short-links');
    revalidatePath(`/admin/short-links/${id}`);
    return { ok: true as const, shortLink: link };
  } catch {
    return { ok: false as const, error: 'update_failed' };
  }
}

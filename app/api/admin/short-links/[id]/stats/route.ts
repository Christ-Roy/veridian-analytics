// /api/admin/short-links/[id]/stats?days=30
//
// Renvoie les stats agregees du short-link :
// - clicksPerDay : tableau de { day: 'YYYY-MM-DD', clicks: N } sur la fenetre
// - topReferers  : top 10 domaines referers (parsed depuis la full URL)
// - topCountries : top 10 pays (cf-ipcountry)
// - total        : total clicks dans la fenetre

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError, requireAdmin } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseRefererDomain(ref: string | null): string {
  if (!ref) return 'direct';
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return 'unknown';
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauth = requireAdmin(req);
  if (unauth) return unauth;
  const { id } = await params;

  const url = new URL(req.url);
  const days = Math.min(
    365,
    Math.max(1, parseInt(url.searchParams.get('days') ?? '30', 10)),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const link = await prisma.shortLink.findUnique({
    where: { id },
    select: { id: true, slug: true, clickCount: true },
  });
  if (!link) return jsonError('short_link_not_found', 404);

  // Charge les clicks bruts sur la fenetre (cap a 10k pour eviter OOM
  // sur un slug viral — au-dela on agrege en SQL si besoin).
  const clicks = await prisma.shortLinkClick.findMany({
    where: { shortLinkId: id, createdAt: { gte: since } },
    select: { createdAt: true, referer: true, country: true },
    orderBy: { createdAt: 'asc' },
    take: 10000,
  });

  // Agregation in-memory (acceptable pour <=10k rows par slug par fenetre)
  const dayMap = new Map<string, number>();
  const refMap = new Map<string, number>();
  const countryMap = new Map<string, number>();

  for (const c of clicks) {
    const day = c.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    const refDom = parseRefererDomain(c.referer);
    refMap.set(refDom, (refMap.get(refDom) ?? 0) + 1);
    const country = c.country?.toUpperCase() || 'unknown';
    countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
  }

  // Fill missing days avec 0 pour avoir une serie continue (pratique pour
  // les graphes echarts sans gaps).
  const clicksPerDay: Array<{ day: string; clicks: number }> = [];
  const dayCursor = new Date(since);
  dayCursor.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  while (dayCursor <= today) {
    const key = dayCursor.toISOString().slice(0, 10);
    clicksPerDay.push({ day: key, clicks: dayMap.get(key) ?? 0 });
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
  }

  const topReferers = [...refMap.entries()]
    .map(([referer, count]) => ({ referer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topCountries = [...countryMap.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    shortLinkId: id,
    slug: link.slug,
    totalClickCount: link.clickCount,
    windowDays: days,
    windowTotal: clicks.length,
    clicksPerDay,
    topReferers,
    topCountries,
  });
}

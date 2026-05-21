// Page detail d'un short-link : stats + edition inline.
// Server component qui charge les stats puis les passe a un client
// component pour les graphes + edition inline.

import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { isSuperadmin } from '@/lib/admin-guard';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkline } from '@/components/sparkline';
import { ArrowLeft } from 'lucide-react';
import { ShortLinkEditor } from './editor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SHORTENER_HOST = 'lnk.veridian.site';

function parseRefererDomain(ref: string | null): string {
  if (!ref) return 'direct';
  try {
    const u = new URL(ref);
    return u.hostname.replace(/^www\./, '') || 'direct';
  } catch {
    return 'unknown';
  }
}

export default async function ShortLinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=/admin/short-links');
  }
  if (!isSuperadmin(session)) redirect('/dashboard');

  const { id } = await params;
  const link = await prisma.shortLink.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, slug: true, name: true } },
      createdByUser: { select: { id: true, email: true } },
    },
  });
  if (!link) notFound();

  // Stats sur 30 jours (cap a 10k clicks)
  const days = 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const clicks = await prisma.shortLinkClick.findMany({
    where: { shortLinkId: id, createdAt: { gte: since } },
    select: { createdAt: true, referer: true, country: true },
    take: 10000,
  });

  const dayMap = new Map<string, number>();
  const refMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  for (const c of clicks) {
    const dayKey = c.createdAt.toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) ?? 0) + 1);
    const r = parseRefererDomain(c.referer);
    refMap.set(r, (refMap.get(r) ?? 0) + 1);
    const co = c.country?.toUpperCase() || 'unknown';
    countryMap.set(co, (countryMap.get(co) ?? 0) + 1);
  }

  // Serie complete avec gaps a 0
  const sparkData: Array<{ day: string; value: number }> = [];
  const cursor = new Date(since);
  cursor.setUTCHours(0, 0, 0, 0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  while (cursor <= today) {
    const k = cursor.toISOString().slice(0, 10);
    sparkData.push({ day: k, value: dayMap.get(k) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const topReferers = [...refMap.entries()]
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const topCountries = [...countryMap.entries()]
    .map(([k, v]) => ({ name: k, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const publicUrl = `https://${SHORTENER_HOST}/${link.slug}`;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/admin/short-links"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour aux liens
        </Link>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              <span className="font-mono">{link.slug}</span>
              {!link.active ? (
                <span className="ml-2 rounded-md bg-zinc-700 px-2 py-0.5 text-xs">
                  inactif
                </span>
              ) : null}
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              {publicUrl}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">
              {link.clickCount}
            </div>
            <div className="text-xs text-muted-foreground">clics totaux</div>
          </div>
        </div>
      </header>

      <Card>
        <CardContent className="p-6 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Clics par jour ({days}j)</h2>
            <div className="text-xs text-muted-foreground">
              {clicks.length} clics sur la fenêtre
            </div>
          </div>
          <Sparkline data={sparkData} height={120} width={800} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 space-y-2">
            <h2 className="text-sm font-semibold">Top referers</h2>
            {topReferers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun referer</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {topReferers.map((r) => (
                  <li
                    key={r.name}
                    className="flex justify-between border-b border-border/40 py-1"
                  >
                    <span className="truncate">{r.name}</span>
                    <span className="font-mono tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-2">
            <h2 className="text-sm font-semibold">Top pays</h2>
            {topCountries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun pays</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {topCountries.map((c) => (
                  <li
                    key={c.name}
                    className="flex justify-between border-b border-border/40 py-1"
                  >
                    <span>{c.name}</span>
                    <span className="font-mono tabular-nums">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ShortLinkEditor
        id={link.id}
        initial={{
          targetUrl: link.targetUrl,
          utmSource: link.utmSource,
          utmMedium: link.utmMedium,
          utmCampaign: link.utmCampaign,
          utmTerm: link.utmTerm,
          utmContent: link.utmContent,
          active: link.active,
        }}
      />
    </div>
  );
}

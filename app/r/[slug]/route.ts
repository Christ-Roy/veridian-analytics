// GET /r/[slug] — endpoint public de redirection.
//
// Comportement :
//  1. Rate limit 60 req/min/IP (anti-scraping abusif)
//  2. Lookup slug (cache 60s via unstable_cache)
//  3. Si introuvable / inactif / expire -> 302 vers /r/[slug]/not-found
//     (Next.js servira la page Veridian-branded)
//  4. Increment clickCount + insert ShortLinkClick en async (best-effort,
//     pas bloquant pour le redirect)
//  5. Build URL finale avec UTM injectes -> 302 vers targetUrl
//
// Note securite : on refuse les target non-http(s) en amont a la creation
// (cf. isValidTargetUrl in lib/short-links.ts), donc ici on peut redirect
// sans risque d'open-redirect javascript:.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildRedirectUrl,
  resolveShortLink,
} from '@/lib/short-links';
import { createRateLimiter } from '@/lib/rate-limit';

export const runtime = 'nodejs';
// On ne veut pas que Next mette la route en cache de page — c'est juste un
// 302 dynamique. Le cache du LOOKUP est gere dans `resolveShortLink`.
export const dynamic = 'force-dynamic';

// 60 req/min/IP : suffisant pour un humain qui clique plusieurs fois, bloque
// un scraper qui foudroie l'endpoint. Memory-based (mono-instance VPS).
const redirectRateLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Rate limit par IP — 429 explicite avec Retry-After
  const ip = getClientIp(req);
  if (!redirectRateLimiter.check(ip)) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  // Lookup cache 60s. Renvoie null si inactif / expire.
  const link = await resolveShortLink(slug);
  if (!link) {
    // Render la page 404 Veridian-branded (404 = bon code semantique pour
    // un lien qui n'existe pas, pas 302 vers /404 qui poluerait Analytics).
    return new NextResponse(null, {
      status: 307,
      headers: { Location: `/r/${encodeURIComponent(slug)}/not-found` },
    });
  }

  // Click tracking async — on n'attend PAS la promise pour ne pas bloquer
  // le 302. En cas d'echec DB, on log mais on ne casse pas la redirection.
  const userAgent = req.headers.get('user-agent') ?? null;
  const referer = req.headers.get('referer') ?? null;
  const country = req.headers.get('cf-ipcountry') ?? null;
  const ipForLog = ip === 'unknown' ? null : ip;

  // Fire-and-forget : 2 ecritures en parallele (counter + click row).
  // Pas de await sur le caller -> le 302 part immediatement.
  void Promise.all([
    prisma.shortLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
    prisma.shortLinkClick.create({
      data: {
        shortLinkId: link.id,
        ip: ipForLog,
        userAgent,
        referer,
        country,
      },
    }),
  ]).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[short-link][click-track]', slug, e);
  });

  const finalUrl = buildRedirectUrl(link);
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: finalUrl,
      // Empeche le cache navigateur de "memoriser" la cible : on veut que
      // chaque clic re-hit pour le tracking + permettre les futurs PATCH.
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}

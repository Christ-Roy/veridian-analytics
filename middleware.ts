// Middleware Next.js — edge runtime, utilise auth.config (sans Prisma)
// pour protéger /dashboard/**.
//
// En plus du guard auth, on injecte un header `x-pathname-url` avec l'URL
// complete entrante — les server components/layouts peuvent ainsi lire
// les searchParams depuis `headers()`. Next 15 ne passe PAS searchParams
// aux layouts, donc ce header est le hack officiel (Vercel le
// recommande explicitement).
//
// Sous-domaine `lnk.veridian.site` (raccourcisseur D1) :
//   Si Host = lnk.veridian.site et path = /<slug>, on rewrite vers
//   /r/<slug> (sert la route handler). Le sous-domaine ne doit exposer
//   QUE /r/* et /_next/* et /favicon.ico — pas l'admin, pas le dashboard.
//   Tout autre chemin renvoie un 404 propre.

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

const { auth } = NextAuth(authConfig);

const SHORTENER_HOST = 'lnk.veridian.site';

export default auth(async function middleware(req) {
  const { NextResponse } = await import('next/server');

  // 1. Sub-domain shortener : si Host = lnk.veridian.site
  const hostHeader = req.headers.get('host') || '';
  const isShortenerHost = hostHeader.toLowerCase().startsWith(SHORTENER_HOST);
  if (isShortenerHost) {
    const path = req.nextUrl.pathname;
    // Racine : redirect vers veridian.site (pas de page d'accueil pour
    // lnk.veridian.site, c'est juste un dispatcher de slugs).
    if (path === '/' || path === '') {
      return NextResponse.redirect('https://veridian.site', 302);
    }
    // Assets Next et favicon : passer sans rewrite (sinon casse static).
    if (
      path.startsWith('/_next/') ||
      path.startsWith('/favicon') ||
      path === '/robots.txt'
    ) {
      return NextResponse.next();
    }
    // Deja prefixe /r/ : on laisse passer tel quel (cas /r/<slug>/not-found)
    if (path.startsWith('/r/')) {
      return NextResponse.next();
    }
    // Sinon : rewrite /<slug> -> /r/<slug>
    // slug = premier segment uniquement (pas de path multi-niveaux)
    const slug = path.split('/').filter(Boolean)[0];
    if (slug) {
      const rewriteUrl = req.nextUrl.clone();
      rewriteUrl.pathname = `/r/${slug}`;
      return NextResponse.rewrite(rewriteUrl);
    }
    return NextResponse.next();
  }

  // 2. Comportement standard : injection du header x-pathname-url
  // pour que les layouts puissent lire les searchParams (Next 15 limitation).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname-url', req.nextUrl.toString());
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

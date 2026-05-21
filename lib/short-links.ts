// Helpers du raccourcisseur d'URL interne (D1).
// - resolution d'un slug -> targetUrl + UTM injectes (avec cache 60s)
// - generation d'un slug auto a partir d'une URL cible
// - validation/normalisation
//
// Toutes les ecritures (insert click, increment count) restent dans le
// handler de route — ce fichier expose des helpers purs / lookup
// cache-able pour le hot path.

import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';

/** Caracteres autorises dans un slug : alphanumeriques minuscules + tiret. */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export interface ResolvedShortLink {
  id: string;
  slug: string;
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  expiresAt: Date | null;
  active: boolean;
}

/**
 * Lookup un slug -> ShortLink (sans inclure les clicks).
 * Cache Next.js 60s par slug. Invalide manuellement via
 * `revalidateShortLink(slug)` sur PATCH/DELETE/POST.
 *
 * Retourne null si inexistant ou inactif/expire (la regle "active+non-expire"
 * est appliquee ici pour que le cache soit deja "valide pour servir").
 */
export const resolveShortLink = unstable_cache(
  async (slug: string): Promise<ResolvedShortLink | null> => {
    const link = await prisma.shortLink.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        targetUrl: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmTerm: true,
        utmContent: true,
        expiresAt: true,
        active: true,
      },
    });
    if (!link) return null;
    if (!link.active) return null;
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return null;
    return link;
  },
  ['short-link-resolve'],
  { revalidate: 60, tags: ['short-links'] },
);

/**
 * Genere un slug auto a partir d'une URL cible.
 * Strategie : prend le dernier segment du path (ou le host si pas de path),
 * normalise (lowercase, ascii, tirets), tronque a 32 chars.
 *
 * Le caller doit verifier l'unicite et retry avec un suffixe random
 * (`generateRandomSuffix()`) si collision — ce helper ne touche pas la DB.
 */
export function slugFromUrl(targetUrl: string): string {
  let candidate = '';
  try {
    const u = new URL(targetUrl);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    // pathname est URL-encode (Été -> %C3%89t%C3%A9). On decode pour
    // pouvoir normaliser les diacritiques en NFD.
    let rawSeg = seg || u.hostname.replace(/^www\./, '');
    try {
      rawSeg = decodeURIComponent(rawSeg);
    } catch {
      // segment invalide URL-decode (malformed %xx) : on garde tel quel
    }
    candidate = rawSeg;
  } catch {
    candidate = targetUrl;
  }
  const normalized = candidate
    .toLowerCase()
    .normalize('NFD')
    // Strip diacritiques (Unicode combining marks U+0300..U+036F)
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return normalized || 'link';
}

/**
 * Suffix aleatoire 6 chars [a-z0-9] pour resoudre les collisions de slug.
 * Pas crypto-secure, juste pour eviter les collisions humaines.
 */
export function generateRandomSuffix(len = 6): string {
  // Charset sans 0, 1, l, o pour lisibilite (eviter les confusions humaines)
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Genere un slug unique en DB. Essaye d'abord le slug nu, puis suffixes.
 * Stoppe apres `maxAttempts` (defaut 5).
 */
export async function findFreeSlug(
  base: string,
  maxAttempts = 5,
): Promise<string> {
  const baseClean = base.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 56);
  if (!baseClean) throw new Error('empty_base_slug');
  let candidate = baseClean;
  for (let i = 0; i < maxAttempts; i++) {
    const exists = await prisma.shortLink.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    candidate = `${baseClean.slice(0, 55)}-${generateRandomSuffix(4)}`;
  }
  throw new Error('slug_generation_exhausted');
}

/**
 * Construit l'URL finale a renvoyer dans le 302 : prend `targetUrl` et
 * injecte les UTM stockes sur le ShortLink (s'ils ne sont pas deja presents
 * dans l'URL cible — on ne reecrit pas les UTM explicites).
 */
export function buildRedirectUrl(link: {
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
}): string {
  let url: URL;
  try {
    url = new URL(link.targetUrl);
  } catch {
    return link.targetUrl;
  }
  const params: Array<[string, string | null]> = [
    ['utm_source', link.utmSource],
    ['utm_medium', link.utmMedium],
    ['utm_campaign', link.utmCampaign],
    ['utm_term', link.utmTerm],
    ['utm_content', link.utmContent],
  ];
  for (const [k, v] of params) {
    if (v && !url.searchParams.has(k)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/**
 * Valide qu'une string est une URL absolue http/https.
 * Pas de file://, data://, javascript: etc — sinon redirect open redirect.
 */
export function isValidTargetUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sources UTM standardisees (drop-down "utm_source" de la modale create).
 * Conserve une coherence cross-campagne pour l'analyse.
 */
export const UTM_SOURCES = [
  'linkedin',
  'twitter',
  'newsletter',
  'qrcode',
  'email',
  'partner',
  'youtube',
  'instagram',
  'facebook',
  'tiktok',
  'discord',
  'slack',
  'direct',
] as const;

export const UTM_MEDIUMS = [
  'social',
  'email',
  'cpc',
  'organic',
  'referral',
  'print',
  'qr',
  'banner',
  'video',
] as const;

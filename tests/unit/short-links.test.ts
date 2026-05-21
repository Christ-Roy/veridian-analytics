// Tests unitaires des helpers du raccourcisseur (lib/short-links.ts).
// Couvre : slugFromUrl, buildRedirectUrl, isValidTargetUrl, SLUG_REGEX.
//
// Les helpers qui touchent la DB (resolveShortLink, findFreeSlug) sont
// couverts par tests/unit/short-links-redirect.test.ts (route handler)
// et par les e2e Playwright.

import { describe, it, expect } from 'vitest';
import {
  buildRedirectUrl,
  generateRandomSuffix,
  isValidTargetUrl,
  SLUG_REGEX,
  slugFromUrl,
} from '@/lib/short-links';

describe('slugFromUrl', () => {
  it('extracts last path segment', () => {
    expect(slugFromUrl('https://veridian.site/blog/mon-article')).toBe(
      'mon-article',
    );
  });

  it('falls back to hostname when no path', () => {
    expect(slugFromUrl('https://veridian.site/')).toBe('veridian-site');
  });

  it('strips www prefix', () => {
    expect(slugFromUrl('https://www.veridian.site/')).toBe('veridian-site');
  });

  it('normalizes diacritics and uppercase', () => {
    expect(slugFromUrl('https://exemple.com/Été-2026')).toBe('ete-2026');
  });

  it('returns "link" for empty / invalid input', () => {
    expect(slugFromUrl('')).toBe('link');
    expect(slugFromUrl('not a url')).toBe('not-a-url');
  });

  it('truncates to 32 chars', () => {
    const long = 'https://x.com/' + 'a'.repeat(80);
    expect(slugFromUrl(long).length).toBeLessThanOrEqual(32);
  });
});

describe('buildRedirectUrl', () => {
  const base = {
    targetUrl: 'https://veridian.site/page',
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
  };

  it('returns the target URL unchanged when no UTM', () => {
    expect(buildRedirectUrl(base)).toBe('https://veridian.site/page');
  });

  it('injects UTM params', () => {
    const url = buildRedirectUrl({
      ...base,
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'march',
    });
    const u = new URL(url);
    expect(u.searchParams.get('utm_source')).toBe('linkedin');
    expect(u.searchParams.get('utm_medium')).toBe('social');
    expect(u.searchParams.get('utm_campaign')).toBe('march');
  });

  it('does not override UTM already present in target URL', () => {
    const url = buildRedirectUrl({
      ...base,
      targetUrl: 'https://x.com/?utm_source=custom',
      utmSource: 'linkedin',
    });
    const u = new URL(url);
    expect(u.searchParams.get('utm_source')).toBe('custom');
  });

  it('returns raw value when target URL is invalid', () => {
    expect(buildRedirectUrl({ ...base, targetUrl: 'not-a-url' })).toBe(
      'not-a-url',
    );
  });
});

describe('isValidTargetUrl', () => {
  it('accepts http and https', () => {
    expect(isValidTargetUrl('https://veridian.site')).toBe(true);
    expect(isValidTargetUrl('http://example.com')).toBe(true);
  });

  it('rejects javascript: and data: urls (open redirect protection)', () => {
    expect(isValidTargetUrl('javascript:alert(1)')).toBe(false);
    expect(isValidTargetUrl('data:text/html,<h1>x</h1>')).toBe(false);
    expect(isValidTargetUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects garbage', () => {
    expect(isValidTargetUrl('')).toBe(false);
    expect(isValidTargetUrl('not a url')).toBe(false);
  });
});

describe('SLUG_REGEX', () => {
  it('accepts valid slugs', () => {
    expect(SLUG_REGEX.test('tt-mars')).toBe(true);
    expect(SLUG_REGEX.test('a1')).toBe(true);
    expect(SLUG_REGEX.test('a')).toBe(true);
    expect(SLUG_REGEX.test('tt-linkedin-mars-2026')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(SLUG_REGEX.test('')).toBe(false);
    expect(SLUG_REGEX.test('-leading')).toBe(false);
    expect(SLUG_REGEX.test('trailing-')).toBe(false);
    expect(SLUG_REGEX.test('UPPER')).toBe(false);
    expect(SLUG_REGEX.test('with space')).toBe(false);
    expect(SLUG_REGEX.test('a'.repeat(65))).toBe(false); // > 64 chars
  });
});

describe('generateRandomSuffix', () => {
  it('generates suffix of expected length', () => {
    expect(generateRandomSuffix()).toHaveLength(6);
    expect(generateRandomSuffix(4)).toHaveLength(4);
  });

  it('uses safe charset (no 0/1/l/o)', () => {
    for (let i = 0; i < 50; i++) {
      const s = generateRandomSuffix(20);
      expect(s).toMatch(/^[a-z2-9]+$/);
      expect(s).not.toMatch(/[01lo]/);
    }
  });
});

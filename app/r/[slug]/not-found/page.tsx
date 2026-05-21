// Page 404 user-friendly servie quand un slug n'existe pas / expire.
// Routee via un 307 depuis /r/[slug]/route.ts (on ne peut pas faire
// notFound() depuis un route handler GET non-page).
//
// Tone Veridian : sympa mais pas corporate. CTA vers veridian.site.

import Link from 'next/link';

export const metadata = {
  title: 'Lien introuvable — Veridian',
  robots: { index: false, follow: false },
};

export default function ShortLinkNotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-4xl">
          {/* SVG ne necessitant pas d'asset externe pour ne pas casser le build */}
          <span aria-hidden>🔗</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Ce lien a expiré ou n&apos;existe pas
          </h1>
          <p className="text-sm text-muted-foreground">
            Le lien que vous avez suivi n&apos;est plus actif. Il a peut-être
            été désactivé ou n&apos;a jamais existé.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="https://veridian.site"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Visiter veridian.site
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          Veridian — analytics + SEO pour artisans
        </p>
      </div>
    </main>
  );
}

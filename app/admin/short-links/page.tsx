// Page /admin/short-links — console plateforme superadmin.
// Server component qui charge la liste + delegue les interactions
// (modal create, copier) a un client component ShortLinksTable.

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isSuperadmin } from '@/lib/admin-guard';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { ShortLinksTable } from './short-links-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ShortLinksPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/login?callbackUrl=/admin/short-links');
  if (!isSuperadmin(session)) redirect('/dashboard');

  const [links, tenants] = await Promise.all([
    prisma.shortLink.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        slug: true,
        targetUrl: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        clickCount: true,
        active: true,
        expiresAt: true,
        createdAt: true,
        tenantId: true,
        tenant: { select: { id: true, slug: true, name: true } },
      },
    }),
    prisma.tenant.findMany({
      where: { deletedAt: null },
      select: { id: true, slug: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Raccourcisseur d&apos;URL</h1>
          <p className="text-sm text-muted-foreground">
            {links.length} lien{links.length > 1 ? 's' : ''} —{' '}
            <span className="font-mono">lnk.veridian.site/&lt;slug&gt;</span>
          </p>
        </div>
      </header>

      {links.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Aucun lien. Clique sur &quot;Créer un lien&quot; pour démarrer.
          </CardContent>
        </Card>
      ) : null}

      <ShortLinksTable initialLinks={links} tenants={tenants} />
    </div>
  );
}

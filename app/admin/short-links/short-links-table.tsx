'use client';

// Tableau + modal de creation pour la console /admin/short-links.
// Client component : on a besoin d'etat (modal open, form, toast,
// filter). Les mutations passent par des server actions (cf. ./actions).

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Plus, Power, Trash2, BarChart3 } from 'lucide-react';
import { UTM_SOURCES, UTM_MEDIUMS } from '@/lib/short-links';
import {
  createShortLinkAction,
  deleteShortLinkAction,
  toggleShortLinkActiveAction,
} from './actions';

interface TenantLite {
  id: string;
  slug: string;
  name: string;
}

interface ShortLinkRow {
  id: string;
  slug: string;
  targetUrl: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  clickCount: number;
  active: boolean;
  expiresAt: Date | string | null;
  createdAt: Date | string;
  tenantId: string | null;
  tenant: TenantLite | null;
}

const SHORTENER_HOST = 'lnk.veridian.site';

function buildPublicUrl(slug: string): string {
  return `https://${SHORTENER_HOST}/${slug}`;
}

export function ShortLinksTable({
  initialLinks,
  tenants,
}: {
  initialLinks: ShortLinkRow[];
  tenants: TenantLite[];
}) {
  const router = useRouter();
  const [filterTenantId, setFilterTenantId] = React.useState<string>('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const filtered = filterTenantId
    ? initialLinks.filter((l) => l.tenantId === filterTenantId)
    : initialLinks;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  async function copyLink(slug: string) {
    const url = buildPublicUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      showToast(`Copié : ${url}`);
    } catch {
      showToast('Erreur copie');
    }
  }

  async function handleToggle(id: string, current: boolean) {
    const res = await toggleShortLinkActiveAction(id, !current);
    if (res.ok) {
      showToast(current ? 'Désactivé' : 'Activé');
      router.refresh();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Désactiver ce lien ? (soft delete)')) return;
    const res = await deleteShortLinkAction(id);
    if (res.ok) {
      showToast('Lien désactivé');
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="filter-tenant">
            Tenant :
          </label>
          <select
            id="filter-tenant"
            value={filterTenantId}
            onChange={(e) => setFilterTenantId(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            data-testid="filter-tenant"
          >
            <option value="">Tous</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          size="sm"
          data-testid="open-create-modal"
        >
          <Plus className="h-4 w-4" />
          Créer un lien
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">Slug</th>
                  <th className="px-4 py-2 text-left">Cible</th>
                  <th className="px-4 py-2 text-left">UTM</th>
                  <th className="px-4 py-2 text-left">Tenant</th>
                  <th className="px-4 py-2 text-right">Clics</th>
                  <th className="px-4 py-2 text-center">Actif</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Aucun lien
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-border/40 hover:bg-muted/20"
                      data-testid={`short-link-row-${l.slug}`}
                    >
                      <td className="px-4 py-2 font-mono text-xs">
                        <a
                          href={buildPublicUrl(l.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          {l.slug}
                        </a>
                      </td>
                      <td className="max-w-[260px] truncate px-4 py-2 text-xs text-muted-foreground">
                        {l.targetUrl}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {[l.utmSource, l.utmMedium, l.utmCampaign]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.tenant?.slug || '—'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums">
                        {l.clickCount}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span
                          className={
                            l.active
                              ? 'inline-block h-2 w-2 rounded-full bg-emerald-500'
                              : 'inline-block h-2 w-2 rounded-full bg-zinc-500'
                          }
                          title={l.active ? 'Actif' : 'Inactif'}
                          aria-label={l.active ? 'Actif' : 'Inactif'}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => copyLink(l.slug)}
                            title="Copier"
                            data-testid={`copy-${l.slug}`}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Link
                            href={`/admin/short-links/${l.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
                            title="Stats"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Link>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleToggle(l.id, l.active)}
                            title={l.active ? 'Désactiver' : 'Activer'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete(l.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {createOpen ? (
        <CreateModal
          tenants={tenants}
          onClose={() => setCreateOpen(false)}
          onCreated={(slug) => {
            setCreateOpen(false);
            showToast(`Créé : ${buildPublicUrl(slug)} (copié)`);
            void navigator.clipboard.writeText(buildPublicUrl(slug)).catch(() => undefined);
            router.refresh();
          }}
        />
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          data-testid="toast"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function CreateModal({
  tenants,
  onClose,
  onCreated,
}: {
  tenants: TenantLite[];
  onClose: () => void;
  onCreated: (slug: string) => void;
}) {
  const [targetUrl, setTargetUrl] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [utmSource, setUtmSource] = React.useState('');
  const [utmMedium, setUtmMedium] = React.useState('');
  const [utmCampaign, setUtmCampaign] = React.useState('');
  const [tenantId, setTenantId] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await createShortLinkAction({
        targetUrl,
        slug: slug || undefined,
        utmSource: utmSource || undefined,
        utmMedium: utmMedium || undefined,
        utmCampaign: utmCampaign || undefined,
        tenantId: tenantId || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated(res.shortLink.slug);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      data-testid="create-modal"
    >
      <Card className="w-full max-w-lg">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">Créer un lien court</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="target-url" className="text-xs font-medium">
                URL cible *
              </label>
              <input
                id="target-url"
                type="url"
                required
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://veridian.site/blog/article-mars"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                data-testid="input-target-url"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="slug" className="text-xs font-medium">
                Slug (laisser vide pour auto)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  lnk.veridian.site/
                </span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="tt-linkedin-mars"
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono"
                  data-testid="input-slug"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="utm-source" className="text-xs font-medium">
                  utm_source
                </label>
                <select
                  id="utm-source"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  data-testid="select-utm-source"
                >
                  <option value="">—</option>
                  {UTM_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="utm-medium" className="text-xs font-medium">
                  utm_medium
                </label>
                <select
                  id="utm-medium"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  data-testid="select-utm-medium"
                >
                  <option value="">—</option>
                  {UTM_MEDIUMS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="utm-campaign" className="text-xs font-medium">
                utm_campaign
              </label>
              <input
                id="utm-campaign"
                type="text"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                placeholder="ex: spring-2026"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                data-testid="input-utm-campaign"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="tenant-id" className="text-xs font-medium">
                Tenant (optionnel)
              </label>
              <select
                id="tenant-id"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">— Lien personnel Robert —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p className="text-xs text-destructive" data-testid="create-error">
                Erreur : {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" disabled={busy} data-testid="submit-create">
                {busy ? 'Création…' : 'Créer + copier'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

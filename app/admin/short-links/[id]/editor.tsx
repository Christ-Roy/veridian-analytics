'use client';

// Editeur inline du short-link (targetUrl, UTM, active).
// Utilise la server action updateShortLinkAction.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UTM_SOURCES, UTM_MEDIUMS } from '@/lib/short-links';
import { updateShortLinkAction } from '../actions';

export function ShortLinkEditor({
  id,
  initial,
}: {
  id: string;
  initial: {
    targetUrl: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    active: boolean;
  };
}) {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = React.useState(initial.targetUrl);
  const [utmSource, setUtmSource] = React.useState(initial.utmSource ?? '');
  const [utmMedium, setUtmMedium] = React.useState(initial.utmMedium ?? '');
  const [utmCampaign, setUtmCampaign] = React.useState(initial.utmCampaign ?? '');
  const [utmTerm, setUtmTerm] = React.useState(initial.utmTerm ?? '');
  const [utmContent, setUtmContent] = React.useState(initial.utmContent ?? '');
  const [active, setActive] = React.useState(initial.active);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await updateShortLinkAction(id, {
        targetUrl,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmTerm: utmTerm || null,
        utmContent: utmContent || null,
        active,
      });
      if (!res.ok) {
        setMsg(`Erreur : ${res.error}`);
        return;
      }
      setMsg('Enregistré');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-3">
        <h2 className="text-sm font-semibold">Édition</h2>
        <form onSubmit={onSubmit} className="space-y-3" data-testid="editor-form">
          <div className="space-y-1">
            <label htmlFor="ed-target-url" className="text-xs font-medium">
              URL cible
            </label>
            <input
              id="ed-target-url"
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              data-testid="edit-target-url"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="ed-utm-source" className="text-xs font-medium">
                utm_source
              </label>
              <select
                id="ed-utm-source"
                value={utmSource}
                onChange={(e) => setUtmSource(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
              <label htmlFor="ed-utm-medium" className="text-xs font-medium">
                utm_medium
              </label>
              <select
                id="ed-utm-medium"
                value={utmMedium}
                onChange={(e) => setUtmMedium(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
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
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label htmlFor="ed-utm-campaign" className="text-xs font-medium">
                utm_campaign
              </label>
              <input
                id="ed-utm-campaign"
                value={utmCampaign}
                onChange={(e) => setUtmCampaign(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ed-utm-term" className="text-xs font-medium">
                utm_term
              </label>
              <input
                id="ed-utm-term"
                value={utmTerm}
                onChange={(e) => setUtmTerm(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="ed-utm-content" className="text-xs font-medium">
                utm_content
              </label>
              <input
                id="ed-utm-content"
                value={utmContent}
                onChange={(e) => setUtmContent(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                data-testid="edit-active"
              />
              Lien actif
            </label>
            <div className="flex items-center gap-3">
              {msg ? (
                <span className="text-xs text-muted-foreground">{msg}</span>
              ) : null}
              <Button type="submit" disabled={busy} data-testid="edit-submit">
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

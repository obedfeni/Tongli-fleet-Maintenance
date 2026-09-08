'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, Menu, RefreshCw, Truck, X } from 'lucide-react';
import { UploadPanel } from '@/components/UploadPanel';
import { MonthDueBrowser } from '@/components/MonthDueBrowser';
import { FleetTable } from '@/components/FleetTable';
import { TruckDetailSheet } from '@/components/TruckDetailSheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/components/LanguageProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FleetRow } from '@/lib/types';

export default function Page() {
  const { t } = useLanguage();
  const [fleet, setFleet] = React.useState<FleetRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedTruck, setSelectedTruck] = React.useState<string | null>(null);
  const [algorithm, setAlgorithm] = React.useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const loadFleet = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trucks');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t.failedToLoadTrucks);
      setFleet(data.fleet);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.failedToLoadTrucks);
    } finally {
      setLoading(false);
    }
    // `t` intentionally excluded: this fallback string is only ever shown
    // if the API itself sends a malformed error response (it always sends
    // a proper message), and keeping loadFleet stable avoids re-fetching
    // the whole fleet every time the user just toggles the language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    // Canonical "fetch on mount" — see https://react.dev/learn/you-might-not-need-an-effect#fetching-data
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFleet();
  }, [loadFleet]);

  async function handleUpdate(truckId: string, patch: { pmName?: string | null; pmTargetKm?: number | null }) {
    try {
      const res = await fetch(`/api/trucks/${truckId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t.failedToSave);
      setFleet((prev) => (prev ? prev.map((r) => (r.truckId === truckId ? data.truck : r)) : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.failedToSave);
    }
  }

  async function handleDeleteTruck(truckId: string) {
    if (typeof window !== 'undefined' && !window.confirm(t.confirmRemoveTruck(truckId))) return;
    try {
      const res = await fetch(`/api/trucks/${truckId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? t.failedToRemove);
      setFleet((prev) => (prev ? prev.filter((r) => r.truckId !== truckId) : prev));
      toast.success(t.truckRemoved(truckId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.failedToRemove);
    }
  }

  const selectedRow = fleet?.find((r) => r.truckId === selectedTruck);

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar — the sidebar below becomes a collapsible panel on small screens */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Truck className="h-4 w-4" />
          </div>
          <span className="font-semibold">{t.appTitle}</span>
        </div>
        <Button variant="outline" size="icon" onClick={() => setSidebarOpen((v) => !v)} aria-label={t.toggleMenu}>
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar: app identity + all buttons/options (refresh, language, theme, upload) */}
      <aside
        className={cn(
          'w-full shrink-0 border-b border-border bg-muted/20 p-5 lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:overflow-y-auto lg:border-b-0 lg:border-r',
          sidebarOpen ? 'block' : 'hidden lg:block'
        )}
      >
        <div className="mb-6 hidden items-center gap-3 lg:flex">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">{t.appTitle}</h1>
            <p className="text-xs text-muted-foreground">{t.appSubtitle}</p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFleet} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t.refresh}
          </Button>
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <UploadPanel
          onResult={(result) => {
            setFleet(result.fleet);
            setAlgorithm(result.algorithm);
            setSidebarOpen(false);
          }}
        />

        {algorithm && (
          <p className="mt-4 text-xs text-muted-foreground">
            {t.predictionEngineLabel}
            {algorithm}
          </p>
        )}
      </aside>

      {/* Main content: month-based due-date browser + full fleet table */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {fleet && fleet.length > 0 ? (
          <div className="space-y-6">
            <MonthDueBrowser fleet={fleet} />
            <FleetTable fleet={fleet} onUpdate={handleUpdate} onSelectTruck={setSelectedTruck} onDeleteTruck={handleDeleteTruck} />
          </div>
        ) : loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">{t.noTrucksYet}</div>
        )}
      </main>

      {selectedTruck && (
        <TruckDetailSheet truckId={selectedTruck} row={selectedRow} onClose={() => setSelectedTruck(null)} />
      )}
    </div>
  );
}

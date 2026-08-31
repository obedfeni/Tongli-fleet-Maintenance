'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Truck } from 'lucide-react';
import { UploadPanel } from '@/components/UploadPanel';
import { SummaryCards } from '@/components/SummaryCards';
import { FleetTable } from '@/components/FleetTable';
import { TruckDetailSheet } from '@/components/TruckDetailSheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import type { FleetRow } from '@/lib/types';

export default function Page() {
  const [fleet, setFleet] = React.useState<FleetRow[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedTruck, setSelectedTruck] = React.useState<string | null>(null);
  const [algorithm, setAlgorithm] = React.useState<string | null>(null);

  const loadFleet = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trucks');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load trucks.');
      setFleet(data.fleet);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load trucks.');
    } finally {
      setLoading(false);
    }
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
      if (!res.ok) throw new Error(data?.error ?? 'Failed to save.');
      setFleet((prev) => (prev ? prev.map((r) => (r.truckId === truckId ? data.truck : r)) : prev));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  const selectedRow = fleet?.find((r) => r.truckId === selectedTruck);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Fleet PM Predictor</h1>
            <p className="text-sm text-muted-foreground">Robust ML odometer-trend regression for predictive preventive maintenance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadFleet} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="mb-6">
        <UploadPanel
          onResult={(result) => {
            setFleet(result.fleet);
            setAlgorithm(result.algorithm);
          }}
        />
      </div>

      {fleet && fleet.length > 0 ? (
        <div className="space-y-6">
          <SummaryCards fleet={fleet} />
          <FleetTable fleet={fleet} onUpdate={handleUpdate} onSelectTruck={setSelectedTruck} />
          {algorithm && <p className="text-xs text-muted-foreground">Prediction engine: {algorithm}</p>}
        </div>
      ) : loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No trucks yet. Upload a charging log or connect a Google Sheet above to get started.
        </div>
      )}

      {selectedTruck && (
        <TruckDetailSheet truckId={selectedTruck} row={selectedRow} onClose={() => setSelectedTruck(null)} />
      )}
    </main>
  );
}

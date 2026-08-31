'use client';

import * as React from 'react';
import { X, Loader2, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Card, CardContent } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { formatDate, formatKm } from '@/lib/utils';
import type { FleetRow } from '@/lib/types';

interface ReadingPoint {
  source_row_ref: number | null;
  reading_date: string | null;
  odometer_km: number;
  is_inlier: boolean;
}

export function TruckDetailSheet({ truckId, row, onClose }: { truckId: string; row: FleetRow | undefined; onClose: () => void }) {
  const [readings, setReadings] = React.useState<ReadingPoint[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Canonical "fetch on mount / when truckId changes" — see
    // https://react.dev/learn/you-might-not-need-an-effect#fetching-data
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch(`/api/trucks/${truckId}/history`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setReadings(data.readings ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [truckId]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const chartData = React.useMemo(() => {
    if (!readings) return [];
    const dated = readings.filter((r) => r.reading_date).sort((a, b) => new Date(a.reading_date!).getTime() - new Date(b.reading_date!).getTime());
    return dated.map((r) => ({
      date: new Date(r.reading_date!).getTime(),
      km: r.odometer_km,
      inlierKm: r.is_inlier ? r.odometer_km : null,
      outlierKm: r.is_inlier ? null : r.odometer_km,
      rowRef: r.source_row_ref,
    }));
  }, [readings]);

  const trendLine = React.useMemo(() => {
    if (!row || row.avgDailyKm == null || !row.firstReadingDate || !row.lastReadingDate || row.currentOdometerKm == null) return [];
    const firstT = new Date(row.firstReadingDate).getTime();
    const lastT = new Date(row.lastReadingDate).getTime();
    const days = (lastT - firstT) / 86400000;
    const startKm = row.currentOdometerKm - row.avgDailyKm * days;
    const points = [
      { date: firstT, trend: startKm },
      { date: lastT, trend: row.currentOdometerKm },
    ];
    if (row.predictedDate && row.pmTargetKm != null && row.status !== 'OVERDUE') {
      points.push({ date: new Date(row.predictedDate).getTime(), trend: row.pmTargetKm });
    }
    return points;
  }, [row]);

  const merged = React.useMemo(() => {
    const byDate = new Map<number, any>();
    for (const p of chartData) byDate.set(p.date, { ...p });
    for (const t of trendLine) {
      const existing = byDate.get(t.date) ?? { date: t.date };
      byDate.set(t.date, { ...existing, trend: t.trend });
    }
    return Array.from(byDate.values()).sort((a, b) => a.date - b.date);
  }, [chartData, trendLine]);

  const outlierCount = readings?.filter((r) => !r.is_inlier).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-background shadow-2xl animate-slide-up">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">{truckId}</h2>
            {row && <StatusBadge status={row.status} />}
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-muted" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-6">
          {row && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Current odometer" value={`${formatKm(row.currentOdometerKm, 1)} km`} />
              <Stat label="Avg daily km" value={row.avgDailyKm != null ? `${formatKm(row.avgDailyKm, 1)} km/day` : '—'} />
              <Stat label="Fit quality (R²)" value={row.rSquared != null ? row.rSquared.toFixed(3) : '—'} />
              <Stat label="Inliers / outliers" value={`${row.inlierCount} / ${row.outlierCount}`} />
            </div>
          )}

          {row?.status === 'CHECK_LOG' && (
            <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-sm text-purple-700 dark:text-purple-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                The robust regression found a downward trend, which is physically impossible for an odometer — likely two
                bad readings close together. Check this truck&apos;s Kilometers entries near the start or end of the log.
              </div>
            </div>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Odometer trend (RANSAC-fitted, outliers in red)
              </div>
              {loading ? (
                <div className="flex h-72 items-center justify-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : merged.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No dated readings to chart yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={merged} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      className="text-xs"
                    />
                    <YAxis
                      dataKey="km"
                      type="number"
                      domain={['auto', 'auto']}
                      tickFormatter={(v) => formatKm(v, 0)}
                      className="text-xs"
                      width={70}
                    />
                    <Tooltip
                      labelFormatter={(v) => formatDate(new Date(v as number).toISOString())}
                      formatter={(value: any, name: string) => {
                        if (name === 'trend') return [`${formatKm(value, 0)} km`, 'Fitted trend'];
                        return [`${formatKm(value, 1)} km`, name === 'outlierKm' ? 'Excluded outlier' : 'Reading'];
                      }}
                      contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                    />
                    {row?.pmTargetKm != null && <ReferenceLine y={row.pmTargetKm} stroke="hsl(var(--danger))" strokeDasharray="4 4" label={{ value: 'PM target', fontSize: 11, fill: 'hsl(var(--danger))' }} />}
                    <Line type="monotone" dataKey="trend" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                    <Scatter dataKey="inlierKm" fill="hsl(var(--primary))" />
                    <Scatter dataKey="outlierKm" fill="hsl(var(--danger))" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              {outlierCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {outlierCount} reading{outlierCount === 1 ? '' : 's'} excluded as statistical outliers (shown in red) —
                  likely a mistyped odometer value in the log.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

'use client';

import * as React from 'react';
import { Card, CardContent } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { useLanguage } from './LanguageProvider';
import { formatDate } from '@/lib/utils';
import type { FleetRow } from '@/lib/types';

/** "2026-10" style key, computed in UTC so it matches how predictedDate is stored. */
function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Replaces the old "Overdue / Due soon / Healthy" day-range summary cards
 * with a month picker: pick a month (e.g. October) and see exactly which
 * trucks are predicted to need their PM that month. Overdue trucks fall
 * into the current month automatically, since computeFleetRow() sets an
 * overdue truck's predictedDate to today.
 */
export function MonthDueBrowser({ fleet }: { fleet: FleetRow[] }) {
  const { t, lang } = useLanguage();

  const withDates = React.useMemo(() => fleet.filter((r) => r.predictedDate), [fleet]);

  const currentMonthKey = React.useMemo(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }, []);

  const months = React.useMemo(() => {
    const keys = new Set(withDates.map((r) => monthKey(r.predictedDate!)));
    keys.add(currentMonthKey);
    return Array.from(keys).sort();
  }, [withDates, currentMonthKey]);

  const [selected, setSelected] = React.useState<string>(currentMonthKey);

  // Derived, not stored: if the fleet changes (e.g. after a re-upload) and
  // the previously-picked month no longer exists, fall back to the first
  // available month instead of syncing state back in an effect.
  const effectiveSelected = months.includes(selected) ? selected : (months[0] ?? currentMonthKey);

  const monthFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    [lang]
  );

  const trucksDue = React.useMemo(
    () =>
      withDates
        .filter((r) => monthKey(r.predictedDate!) === effectiveSelected)
        .sort((a, b) => a.predictedDate!.localeCompare(b.predictedDate!)),
    [withDates, effectiveSelected]
  );

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t.monthBrowserTitle}</h2>
          <select
            value={effectiveSelected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          >
            {months.map((m) => {
              const parts = m.split('-').map(Number);
              const y = parts[0] ?? new Date().getUTCFullYear();
              const mo = parts[1] ?? 1;
              const label = monthFormatter.format(new Date(Date.UTC(y, mo - 1, 1)));
              return (
                <option key={m} value={m}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {trucksDue.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.noTrucksDueThisMonth}</p>
        ) : (
          <ul className="divide-y divide-border">
            {trucksDue.map((r) => (
              <li key={r.truckId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{r.truckId}</span>
                  {r.pmName && <span className="text-muted-foreground">{r.pmName}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-muted-foreground">{formatDate(r.predictedDate)}</span>
                  <StatusBadge status={r.status} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted-foreground">{t.ofTrucks(fleet.length)}</p>
      </CardContent>
    </Card>
  );
}

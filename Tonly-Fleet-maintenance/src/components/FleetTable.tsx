'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { Input } from './ui/input';
import { cn, formatDate, formatDays, formatKm } from '@/lib/utils';
import type { FleetRow } from '@/lib/types';

type SortKey = 'truckId' | 'currentOdometerKm' | 'avgDailyKm' | 'kmRemaining' | 'predictedDays' | 'status';

const STATUS_RANK: Record<string, number> = {
  OVERDUE: 0,
  DUE_SOON: 1,
  DUE_MEDIUM: 2,
  DUE_LATER: 3,
  CHECK_LOG: 4,
  INSUFFICIENT_DATA: 5,
  NO_DATA: 6,
  ENTER_TARGET: 7,
  OK: 8,
};

export function FleetTable({
  fleet,
  onUpdate,
  onSelectTruck,
}: {
  fleet: FleetRow[];
  onUpdate: (truckId: string, patch: { pmName?: string | null; pmTargetKm?: number | null }) => Promise<void>;
  onSelectTruck: (truckId: string) => void;
}) {
  const [sortKey, setSortKey] = React.useState<SortKey>('status');
  const [sortDir, setSortDir] = React.useState<1 | -1>(1);

  const sorted = React.useMemo(() => {
    const copy = [...fleet];
    copy.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'status') {
        av = STATUS_RANK[a.status] ?? 99;
        bv = STATUS_RANK[b.status] ?? 99;
      } else if (sortKey === 'truckId') {
        av = a.truckId;
        bv = b.truckId;
      } else {
        av = a[sortKey] ?? Number.POSITIVE_INFINITY;
        bv = b[sortKey] ?? Number.POSITIVE_INFINITY;
      }
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return a.truckId.localeCompare(b.truckId);
    });
    return copy;
  }, [fleet, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[1100px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <Th label="Truck ID" sortKey="truckId" active={sortKey} dir={sortDir} onClick={toggleSort} />
            <th className="px-4 py-3 font-medium">Next PM Name</th>
            <th className="px-4 py-3 font-medium">Next PM Target km</th>
            <Th label="Current Odometer" sortKey="currentOdometerKm" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
            <Th label="Avg Daily km" sortKey="avgDailyKm" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
            <Th label="km Remaining" sortKey="kmRemaining" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
            <Th label="Predicted Days" sortKey="predictedDays" active={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
            <th className="px-4 py-3 font-medium">Predicted PM Date</th>
            <Th label="Status" sortKey="status" active={sortKey} dir={sortDir} onClick={toggleSort} />
            <th className="px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <FleetRowLine key={row.truckId} row={row} onUpdate={onUpdate} onSelectTruck={onSelectTruck} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: 1 | -1;
  onClick: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === sortKey;
  return (
    <th
      className={cn('cursor-pointer select-none px-4 py-3 font-medium hover:text-foreground', align === 'right' && 'text-right')}
      onClick={() => onClick(sortKey)}
    >
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
        {label}
        {isActive ? dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}

function FleetRowLine({
  row,
  onUpdate,
  onSelectTruck,
}: {
  row: FleetRow;
  onUpdate: (truckId: string, patch: { pmName?: string | null; pmTargetKm?: number | null }) => Promise<void>;
  onSelectTruck: (truckId: string) => void;
}) {
  const [pmName, setPmName] = React.useState(row.pmName ?? '');
  const [pmTarget, setPmTarget] = React.useState(row.pmTargetKm != null ? String(row.pmTargetKm) : '');
  const [saving, setSaving] = React.useState(false);

  // Re-sync the editable inputs whenever the server-confirmed value changes
  // (after a save round-trip or a fleet refresh) — an intentional prop sync,
  // not a fetch-triggering effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setPmName(row.pmName ?? ''), [row.pmName]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setPmTarget(row.pmTargetKm != null ? String(row.pmTargetKm) : ''), [row.pmTargetKm]);

  async function saveName() {
    if (pmName === (row.pmName ?? '')) return;
    setSaving(true);
    await onUpdate(row.truckId, { pmName: pmName || null });
    setSaving(false);
  }

  async function saveTarget() {
    const num = pmTarget.trim() === '' ? null : Number(pmTarget);
    if (num != null && !Number.isFinite(num)) return;
    if (num === row.pmTargetKm) return;
    setSaving(true);
    await onUpdate(row.truckId, { pmTargetKm: num });
    setSaving(false);
  }

  const rowTint =
    row.status === 'OVERDUE' || row.status === 'DUE_SOON'
      ? 'bg-danger/5'
      : row.status === 'DUE_MEDIUM'
        ? 'bg-warning/5'
        : row.status === 'CHECK_LOG'
          ? 'bg-purple-500/5'
          : '';

  return (
    <tr className={cn('border-b border-border/60 transition-colors hover:bg-muted/40', rowTint, saving && 'opacity-60')}>
      <td className="px-4 py-2 font-semibold">{row.truckId}</td>
      <td className="px-4 py-2">
        <Input
          value={pmName}
          placeholder="e.g. PM3"
          onChange={(e) => setPmName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-8 w-28 bg-amber-50 dark:bg-amber-950/30"
        />
      </td>
      <td className="px-4 py-2">
        <Input
          type="number"
          inputMode="decimal"
          value={pmTarget}
          placeholder="km"
          onChange={(e) => setPmTarget(e.target.value)}
          onBlur={saveTarget}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="h-8 w-28 bg-amber-50 dark:bg-amber-950/30"
        />
      </td>
      <td className="px-4 py-2 text-right tabular-nums">{formatKm(row.currentOdometerKm, 1)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{formatKm(row.avgDailyKm, 1)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{formatKm(row.kmRemaining, 0)}</td>
      <td className="px-4 py-2 text-right tabular-nums">{formatDays(row.predictedDays)}</td>
      <td className="px-4 py-2">{formatDate(row.predictedDate)}</td>
      <td className="px-4 py-2">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-2 py-2">
        <button
          onClick={() => onSelectTruck(row.truckId)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="View trend chart"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import type { FleetRow } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Bucket {
  label: string;
  match: (r: FleetRow) => boolean;
  accent: string;
}

const BUCKETS: Bucket[] = [
  { label: 'Overdue / due ≤ 7 days', match: (r) => r.status === 'OVERDUE' || r.status === 'DUE_SOON', accent: 'text-danger' },
  { label: 'Due 8–14 days', match: (r) => r.status === 'DUE_MEDIUM', accent: 'text-warning' },
  { label: 'Due 15–30 days', match: (r) => r.status === 'DUE_LATER', accent: 'text-amber-600 dark:text-amber-400' },
  { label: 'Healthy (> 30 days)', match: (r) => r.status === 'OK', accent: 'text-success' },
  {
    label: 'Needs attention',
    match: (r) => r.status === 'CHECK_LOG' || r.status === 'NO_DATA' || r.status === 'ENTER_TARGET' || r.status === 'INSUFFICIENT_DATA',
    accent: 'text-muted-foreground',
  },
];

export function SummaryCards({ fleet }: { fleet: FleetRow[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {BUCKETS.map((b) => {
        const count = fleet.filter(b.match).length;
        return (
          <Card key={b.label}>
            <CardHeader className="pb-1">
              <CardTitle>{b.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn('text-3xl font-semibold tabular-nums', b.accent)}>{count}</div>
              <div className="mt-1 text-xs text-muted-foreground">of {fleet.length} trucks</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

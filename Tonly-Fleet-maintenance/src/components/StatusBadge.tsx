import { Badge } from './ui/badge';
import { STATUS_META, type StatusCode } from '@/lib/types';
import { AlertTriangle, CheckCircle2, Circle, Clock, HelpCircle } from 'lucide-react';

const ICONS: Record<StatusCode, React.ReactNode> = {
  ENTER_TARGET: <Circle className="h-3 w-3" />,
  NO_DATA: <HelpCircle className="h-3 w-3" />,
  CHECK_LOG: <AlertTriangle className="h-3 w-3" />,
  INSUFFICIENT_DATA: <HelpCircle className="h-3 w-3" />,
  OVERDUE: <AlertTriangle className="h-3 w-3" />,
  DUE_SOON: <Clock className="h-3 w-3" />,
  DUE_MEDIUM: <Clock className="h-3 w-3" />,
  DUE_LATER: <Clock className="h-3 w-3" />,
  OK: <CheckCircle2 className="h-3 w-3" />,
};

export function StatusBadge({ status }: { status: StatusCode }) {
  const meta = STATUS_META[status];
  return (
    <Badge color={meta.color}>
      {ICONS[status]}
      {meta.label}
    </Badge>
  );
}

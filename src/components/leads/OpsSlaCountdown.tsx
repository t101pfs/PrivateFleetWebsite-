import { useEffect, useState } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/lib/duration';

interface OpsSlaCountdownProps {
  submittedToOpsAt: string | null | undefined;
  slaSatisfiedAt: string | null | undefined;
  durationMinutes: number;
  /** Skip the internal "Operation Timeline" label when the parent already renders one. */
  hideLabel?: boolean;
}

export function OpsSlaCountdown({ submittedToOpsAt, slaSatisfiedAt, durationMinutes, hideLabel }: OpsSlaCountdownProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!submittedToOpsAt || slaSatisfiedAt) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [submittedToOpsAt, slaSatisfiedAt]);

  if (!submittedToOpsAt) {
    return (
      <div>
        {!hideLabel && <p className="text-sm text-muted-foreground">Operation Timeline</p>}
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          Not Submitted
        </div>
      </div>
    );
  }

  if (slaSatisfiedAt) {
    const elapsedMs = new Date(slaSatisfiedAt).getTime() - new Date(submittedToOpsAt).getTime();
    return (
      <div>
        {!hideLabel && <p className="text-sm text-muted-foreground">Operation Timeline</p>}
        <div className="flex items-center gap-1.5 text-lg font-bold text-success">
          <CheckCircle2 className="h-4 w-4" />
          Operations Timeline Met
        </div>
        <p className="text-xs text-muted-foreground">in {formatDuration(elapsedMs)}</p>
      </div>
    );
  }

  const deadline = new Date(new Date(submittedToOpsAt).getTime() + durationMinutes * 60_000);
  const remainingMs = deadline.getTime() - now.getTime();
  const overdue = remainingMs <= 0;

  return (
    <div>
      {!hideLabel && <p className="text-sm text-muted-foreground">Operation Timeline</p>}
      <div
        className={cn(
          'flex items-center gap-1.5 text-lg font-bold',
          overdue ? 'text-destructive' : 'text-foreground'
        )}
      >
        <Clock className="h-4 w-4" />
        {overdue ? `Overdue by ${formatDuration(remainingMs)}` : formatDuration(remainingMs)}
      </div>
      <p className="text-xs text-muted-foreground">{durationMinutes}-minute Operation Timeline</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const SLA_MINUTES = 60;

interface OpsSlaCountdownProps {
  opsAcceptedAt: string | null | undefined;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function OpsSlaCountdown({ opsAcceptedAt }: OpsSlaCountdownProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!opsAcceptedAt) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [opsAcceptedAt]);

  if (!opsAcceptedAt) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">Operations SLA</p>
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          Awaiting Ops
        </div>
      </div>
    );
  }

  const deadline = new Date(new Date(opsAcceptedAt).getTime() + SLA_MINUTES * 60_000);
  const remainingMs = deadline.getTime() - now.getTime();
  const overdue = remainingMs <= 0;

  return (
    <div>
      <p className="text-sm text-muted-foreground">Operations SLA</p>
      <div
        className={cn(
          'flex items-center gap-1.5 text-lg font-bold',
          overdue ? 'text-destructive' : 'text-foreground'
        )}
      >
        <Clock className="h-4 w-4" />
        {overdue ? `Overdue by ${formatDuration(remainingMs)}` : formatDuration(remainingMs)}
      </div>
      <p className="text-xs text-muted-foreground">{SLA_MINUTES}-minute Operations SLA</p>
    </div>
  );
}

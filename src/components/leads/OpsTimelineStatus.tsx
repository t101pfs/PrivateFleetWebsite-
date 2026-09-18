import { AlertTriangle } from 'lucide-react';
import { OpsSlaCountdown } from '@/components/leads/OpsSlaCountdown';
import { resolveSlaMinutes, type SlaSetting } from '@/components/leads/leadPipeline';

interface OpsTimelineStatusProps {
  submittedToOpsAt: string | null | undefined;
  opsAcceptedAt: string | null | undefined;
  opsLockoutAt: string | null | undefined;
  slaSatisfiedAt: string | null | undefined;
  slaSettings: SlaSetting[];
  serviceType: string | null | undefined;
  hideLabel?: boolean;
}

/** Two sequential clocks: Ops has a short window to accept a new request,
 * then — once accepted — a longer window to actually source and publish
 * aircraft options. Missing the accept window locks the request out of the
 * Ops queue and escalates it to Admin instead of starting the sourcing clock. */
export function OpsTimelineStatus({
  submittedToOpsAt,
  opsAcceptedAt,
  opsLockoutAt,
  slaSatisfiedAt,
  slaSettings,
  serviceType,
  hideLabel,
}: OpsTimelineStatusProps) {
  const acceptMinutes = resolveSlaMinutes(slaSettings, serviceType, 'accept');
  const sourceMinutes = resolveSlaMinutes(slaSettings, serviceType, 'source');

  if (opsLockoutAt && !opsAcceptedAt) {
    return (
      <div>
        {!hideLabel && <p className="text-sm text-muted-foreground">Operation Timeline</p>}
        <div className="flex items-center gap-1.5 text-lg font-bold text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Escalated to Admin
        </div>
        <p className="text-xs text-muted-foreground">No one accepted within {acceptMinutes} minutes</p>
      </div>
    );
  }

  if (!opsAcceptedAt) {
    return (
      <OpsSlaCountdown
        submittedToOpsAt={submittedToOpsAt}
        slaSatisfiedAt={null}
        durationMinutes={acceptMinutes}
        label="Time to Accept"
        hideLabel={hideLabel}
      />
    );
  }

  return (
    <OpsSlaCountdown
      submittedToOpsAt={opsAcceptedAt}
      slaSatisfiedAt={slaSatisfiedAt}
      durationMinutes={sourceMinutes}
      label="Time to Add Options"
      hideLabel={hideLabel}
    />
  );
}

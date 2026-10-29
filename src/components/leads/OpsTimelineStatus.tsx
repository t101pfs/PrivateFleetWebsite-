import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { OpsSlaCountdown } from '@/components/leads/OpsSlaCountdown';
import { resolveSlaMinutes, resolveSourceWindowMinutes, type SlaSetting } from '@/components/leads/leadPipeline';

interface OpsTimelineStatusProps {
  submittedToOpsAt: string | null | undefined;
  opsAcceptedAt: string | null | undefined;
  opsLockoutAt: string | null | undefined;
  slaSatisfiedAt: string | null | undefined;
  slaSettings: SlaSetting[];
  serviceType: string | null | undefined;
  /** Drives the sourcing window: short notice (within a week of departure)
   * keeps the tight 60-minute clock, further out gets 2 hours. */
  departureDate: string | null | undefined;
  /** Whoever submitted the flight - used to look up which Ops rep it's
   * routed to for the current shift, so Sales isn't left wondering who's
   * supposed to be picking it up while it's still waiting on Accept. */
  createdBy?: string | null;
  hideLabel?: boolean;
}

/** Who the flight is currently routed to for this shift, before anyone's
 * actually accepted it - same pairing lookup the routing notification
 * itself uses (get_paired_ops_ids), just surfaced in the UI too. */
function ExpectedOpsRep({ createdBy }: { createdBy: string | null | undefined }) {
  const { data: name } = useQuery({
    queryKey: ['expected-ops-rep', createdBy],
    queryFn: async () => {
      const { data: pairedIds } = await supabase.rpc('get_paired_ops_ids', { _submitter_id: createdBy });
      const ids = (pairedIds || []).map((p: { user_id: string }) => p.user_id);
      if (ids.length === 0) return null;
      const { data: profiles } = await supabase.from('profiles').select('full_name, email').in('user_id', ids);
      const names = (profiles || []).map((p) => p.full_name || p.email);
      return names.length > 0 ? names.join(' or ') : null;
    },
    enabled: !!createdBy,
  });

  if (!name) return null;
  return <p className="text-xs text-muted-foreground mt-0.5">Routed to: {name}</p>;
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
  departureDate,
  createdBy,
  hideLabel,
}: OpsTimelineStatusProps) {
  const acceptMinutes = resolveSlaMinutes(slaSettings, serviceType, 'accept');
  const sourceMinutes = resolveSourceWindowMinutes(departureDate);

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
      <div>
        <OpsSlaCountdown
          submittedToOpsAt={submittedToOpsAt}
          slaSatisfiedAt={null}
          durationMinutes={acceptMinutes}
          label="Time to Accept"
          hideLabel={hideLabel}
        />
        <ExpectedOpsRep createdBy={createdBy} />
      </div>
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

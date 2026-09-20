import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type ExtensionStage = 'client_confirmation' | 'client_contract' | 'operator_contract';

export const EXTENSION_STAGE_LABELS: Record<ExtensionStage, string> = {
  client_confirmation: 'Client Confirmation',
  client_contract: 'Client Contract',
  operator_contract: 'Operator Contract',
};

export interface DeadlineExtensionRow {
  id: string;
  flight_id: string;
  stage: ExtensionStage;
  reason: string;
  requested_by: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
  decision_notes: string | null;
  extension_minutes: number | null;
}

/** Extension requests for one flight, plus the helpers the Confirmation &
 * Contracts stages need: how many extra minutes an Admin has granted, whether
 * a request is already waiting, and the most recent decline. */
export function useDeadlineExtensions(flightId: string, requesterLabel: string, flightRef: string) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['deadline-extensions', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deadline_extension_requests')
        .select('id, flight_id, stage, reason, requested_by, requested_at, status, decided_at, decision_notes, extension_minutes')
        .eq('flight_id', flightId)
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return data as DeadlineExtensionRow[];
    },
  });

  // An Admin's decision should show up on the requester's open flight page
  // without them having to refresh.
  useEffect(() => {
    const channel = supabase
      .channel(`deadline-extensions-${flightId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deadline_extension_requests', filter: `flight_id=eq.${flightId}` },
        () => queryClient.invalidateQueries({ queryKey: ['deadline-extensions', flightId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [flightId, queryClient]);

  // How long the stage has, counted from when it started: its normal window,
  // or — if an Admin granted an extension — until N minutes after that
  // approval, whichever ends later. Approving means "N minutes from now", so
  // it works even when the original window lapsed long ago.
  const effectiveMinutes = (stage: ExtensionStage, startAt: string | null, baseMinutes: number) => {
    if (!startAt) return baseMinutes;
    const start = new Date(startAt).getTime();
    const latestGrantEnd = requests
      .filter((r) => r.stage === stage && r.status === 'approved' && r.decided_at && r.extension_minutes)
      .reduce((latest, r) => Math.max(latest, new Date(r.decided_at as string).getTime() + (r.extension_minutes as number) * 60_000), 0);
    return Math.max(baseMinutes, (latestGrantEnd - start) / 60_000);
  };

  const pendingFor = (stage: ExtensionStage) =>
    requests.find((r) => r.stage === stage && r.status === 'pending') || null;

  // Only worth surfacing if nothing newer (a pending or approved request)
  // has superseded it.
  const lastDeclineFor = (stage: ExtensionStage) => {
    const forStage = requests.filter((r) => r.stage === stage);
    const latest = forStage[forStage.length - 1];
    return latest && latest.status === 'rejected' ? latest : null;
  };

  const requestExtension = useMutation({
    mutationFn: async ({ stage, reason }: { stage: ExtensionStage; reason: string }) => {
      if (!supabaseUser) throw new Error('Not authenticated');
      if (!reason.trim()) throw new Error('Give a reason for the extension');

      const { error } = await supabase.from('deadline_extension_requests').insert({
        flight_id: flightId,
        stage,
        reason: reason.trim(),
        requested_by: supabaseUser.id,
      });
      if (error) throw error;

      const { data: admins } = await supabase.rpc('get_admin_user_ids');
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a: { user_id: string }) => ({
            user_id: a.user_id,
            type: 'status_update',
            title: 'Extension Requested',
            message: `${user?.name || requesterLabel} asked for more time on the ${EXTENSION_STAGE_LABELS[stage]} for ${flightRef}: "${reason.trim()}"`,
            flight_id: flightId,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser.id,
        action: 'deadline_extension_requested',
        entity_type: 'flight_request',
        entity_id: flightId,
        details: { stage, reason: reason.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadline-extensions', flightId] });
      queryClient.invalidateQueries({ queryKey: ['approvals-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      toast.success('Extension requested — an Admin will review it');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { requests, effectiveMinutes, pendingFor, lastDeclineFor, requestExtension };
}

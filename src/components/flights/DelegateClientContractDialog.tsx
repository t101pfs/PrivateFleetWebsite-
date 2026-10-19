import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DelegateClientContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  /** "Riyadh → Jeddah (PFS-123)" style label, used in the notification text. */
  reference: string;
  /** Noora reviews by default, Odai signs by default - either can be
   * handed off to someone else when they're unavailable. */
  role: 'reviewer' | 'signer';
  currentAssigneeId: string | null;
  onDelegated: () => void;
}

const ROLE_LABEL = {
  reviewer: 'review',
  signer: 'send and sign',
} as const;

/** Noora (review) and Odai (sign) are the default people on every Client
 * Contract, but neither should be a dead end if they're out - either can
 * delegate their part to someone else, with a reason, and that person is
 * notified and takes over from there. */
export function DelegateClientContractDialog({
  open,
  onOpenChange,
  flightId,
  reference,
  role,
  currentAssigneeId,
  onDelegated,
}: DelegateClientContractDialogProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');

  const { data: staff = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const eligible = staff.filter((s) => s.user_id !== currentAssigneeId);

  const delegate = useMutation({
    mutationFn: async () => {
      if (!targetId) throw new Error('Choose who to delegate to');
      if (!reason.trim()) throw new Error('Add a reason');

      const target = staff.find((s) => s.user_id === targetId);
      const { error } = await supabase
        .from('flight_requests')
        .update(
          role === 'reviewer'
            ? { client_contract_assigned_reviewer_id: targetId }
            : { client_contract_assigned_signer_id: targetId },
        )
        .eq('id', flightId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: targetId,
        type: 'status_update',
        title: 'Client Contract Delegated to You',
        message: `${user?.name || 'Someone'} delegated the Client Contract ${ROLE_LABEL[role]} for ${reference} to you: "${reason.trim()}"`,
        flight_id: flightId,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `client_contract_${role}_delegated`,
        entity_type: 'flight_request',
        entity_id: flightId,
        details: { to: targetId, reason: reason.trim() },
      });

      return target;
    },
    onSuccess: (target) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-client-contracts'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success(`Delegated to ${target?.full_name || target?.email || 'the selected person'}`);
      setTargetId('');
      setReason('');
      onOpenChange(false);
      onDelegated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delegate {role === 'reviewer' ? 'Review' : 'Signing'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Delegate to</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose who takes over" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((s) => (
                  <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delegateReason" className="text-xs">Reason</Label>
            <Textarea id="delegateReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it's being handed off" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => delegate.mutate()} disabled={!targetId || !reason.trim() || delegate.isPending}>
            {delegate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Delegate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

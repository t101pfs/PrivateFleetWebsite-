import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReassignFlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  currentOpsId: string | null;
  onReassigned: () => void;
}

/** Senior Operations / Admin only - hands a flight off to a different Ops
 * rep. Resets ops_accepted_at to now so the new assignee gets a full
 * sourcing window rather than inheriting however much time was left on
 * the previous person's clock, and notifies both sides the same way a
 * manual reassignment already did before this existed as a real feature. */
export function ReassignFlightDialog({ open, onOpenChange, flightId, currentOpsId, onReassigned }: ReassignFlightDialogProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: opsUsers = [] } = useQuery({
    queryKey: ['ops-users-for-reassign'],
    queryFn: async () => {
      const { data: roleRows, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['operations', 'senior_operations']);
      if (roleError) throw roleError;
      const ids = (roleRows || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids).order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const eligible = opsUsers.filter((o) => o.user_id !== currentOpsId);

  const handleReassign = async () => {
    if (!targetId) return;
    if (!reason.trim()) { toast.error('Add a reason for the reassignment'); return; }
    setIsSaving(true);
    try {
      const target = opsUsers.find((o) => o.user_id === targetId);
      const { error } = await supabase
        .from('flight_requests')
        .update({ assigned_ops_id: targetId, ops_accepted_at: new Date().toISOString() })
        .eq('id', flightId);
      if (error) throw error;

      const flightRef = flightId.slice(0, 8).toUpperCase();
      const notifications = [
        {
          user_id: targetId,
          type: 'flight_assigned' as const,
          title: 'Flight Reassigned to You',
          message: `${user?.name || 'Someone'} reassigned flight #${flightRef} to you: "${reason.trim()}"`,
          flight_id: flightId,
        },
      ];
      if (currentOpsId && currentOpsId !== targetId) {
        notifications.push({
          user_id: currentOpsId,
          type: 'status_update' as any,
          title: 'Flight Reassigned',
          message: `${user?.name || 'Someone'} reassigned flight #${flightRef} away from you to ${target?.full_name || target?.email || 'another Ops rep'}: "${reason.trim()}"`,
          flight_id: flightId,
        });
      }
      await supabase.from('notifications').insert(notifications);

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'flight_reassigned',
        entity_type: 'flight_request',
        entity_id: flightId,
        details: { to: targetId, from: currentOpsId, reason: reason.trim() },
      });

      toast.success(`Reassigned to ${target?.full_name || target?.email || 'the selected Ops rep'}`);
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['ops-queue'] });
      queryClient.invalidateQueries({ queryKey: ['ops-queue-my-active'] });
      queryClient.invalidateQueries({ queryKey: ['ops-flights-list'] });
      setTargetId('');
      setReason('');
      onOpenChange(false);
      onReassigned();
    } catch (e) {
      toast.error('Failed to reassign: ' + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reassign Flight</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label className="text-xs">New Ops owner</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger>
              <SelectValue placeholder={eligible.length ? 'Select an Ops rep' : 'No other Ops reps available'} />
            </SelectTrigger>
            <SelectContent>
              {eligible.map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Starts their sourcing window fresh and notifies both the new and previous owner.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reassignReason" className="text-xs">Reason</Label>
          <Textarea id="reassignReason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why it's being reassigned" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleReassign} disabled={!targetId || !reason.trim() || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Reassign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

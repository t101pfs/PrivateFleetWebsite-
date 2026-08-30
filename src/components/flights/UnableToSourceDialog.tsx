import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';

interface UnableToSourceDialogProps {
  flightId: string;
  createdBy: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnableToSourceDialog({ flightId, createdBy, open, onOpenChange }: UnableToSourceDialogProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const { user, supabaseUser } = useAuth();

  const flagUnableToSource = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error('A reason is required');

      const { error } = await supabase
        .from('flight_requests')
        .update({
          unable_to_source_at: new Date().toISOString(),
          unable_to_source_by: supabaseUser?.id,
          unable_to_source_reason: reason.trim(),
        })
        .eq('id', flightId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: createdBy,
        type: 'status_update',
        title: 'Unable to Source Aircraft',
        message: `Operations couldn't find an operator for #${flightId.slice(0, 8).toUpperCase()}: ${reason.trim()}. Edit the flight details and resubmit, or cancel it.`,
        flight_id: flightId,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: 'unable_to_source',
        entity_type: 'flight_request',
        entity_id: flightId,
        details: { reason: reason.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      toast.success('Sales notified');
      setReason('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to flag flight'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Unable to Source
          </DialogTitle>
          <DialogDescription>
            Let Sales know no operator can meet this request. They'll need to either change the flight details
            (date, route, or aircraft type) and resubmit, or cancel it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="unable-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="unable-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., No aircraft available for this route/date, requested category not in fleet..."
            rows={4}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => flagUnableToSource.mutate()}
            disabled={flagUnableToSource.isPending || !reason.trim()}
          >
            {flagUnableToSource.isPending ? 'Sending...' : 'Notify Sales'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

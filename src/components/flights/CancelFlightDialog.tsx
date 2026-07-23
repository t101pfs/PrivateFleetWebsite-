import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { XCircle } from 'lucide-react';

interface CancelFlightDialogProps {
  flightId: string;
  routeFrom: string;
  routeTo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelFlightDialog({ 
  flightId, 
  routeFrom, 
  routeTo, 
  open, 
  onOpenChange,
  onSuccess 
}: CancelFlightDialogProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const isSales = user?.role === 'sales';
  const isOperations = user?.role === 'operations';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const cancelFlight = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error('Cancellation reason is required');
      }

      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          status_sales: 'cancelled',
          status_ops: 'cancelled',
          cancellation_reason: reason.trim(),
        })
        .eq('id', flightId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      toast.success('Flight cancelled');
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      queryClient.invalidateQueries({ queryKey: ['flight-status-counts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-flights'] });
      
      const flightRef = data.id.slice(0, 8).toUpperCase();

      // Notify assigned ops if exists and Sales cancelled
      if (data.assigned_ops_id && isSales) {
        await supabase.from('notifications').insert({
          user_id: data.assigned_ops_id,
          type: 'status_update',
          title: 'Flight Cancelled',
          message: `Flight #${flightRef} (${data.route_from} → ${data.route_to}) has been cancelled`,
          flight_id: data.id,
        });
      }

      // Notify sales creator if Ops/Admin cancelled
      if (isOperations || isAdmin) {
        await supabase.from('notifications').insert({
          user_id: data.created_by,
          type: 'status_update',
          title: 'Flight Cancelled',
          message: `Your flight #${flightRef} (${data.route_from} → ${data.route_to}) has been cancelled`,
          flight_id: data.id,
        });
      }

      setReason('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel flight');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    cancelFlight.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Cancel Flight
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for cancelling the flight from {routeFrom} to {routeTo}. 
            This information helps track and manage flight cancellations.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              Reason for Cancellation <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              placeholder="e.g., Client request, Schedule conflict, Operational issues, Weather conditions..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[100px] resize-none"
              required
            />
            <p className="text-xs text-muted-foreground">
              This field is mandatory
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Go Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelFlight.isPending || !reason.trim()}
            >
              {cancelFlight.isPending ? 'Cancelling...' : 'Cancel Flight'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

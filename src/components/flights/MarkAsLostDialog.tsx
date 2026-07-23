import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Ban } from 'lucide-react';

interface MarkAsLostDialogProps {
  flightId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkAsLostDialog({ flightId, open, onOpenChange }: MarkAsLostDialogProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const markAsLost = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error('Lost reason is required');
      }

      const { error } = await supabase
        .from('flight_requests')
        .update({
          status_sales: 'lost',
          status_ops: 'lost',
          lost_reason: reason.trim(),
        })
        .eq('id', flightId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Flight marked as lost');
      queryClient.invalidateQueries({ queryKey: ['flight-requests'] });
      queryClient.invalidateQueries({ queryKey: ['flight-status-counts'] });
      setReason('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark flight as lost');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason for marking this flight as lost');
      return;
    }
    markAsLost.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-orange-500" />
            Mark Flight as Lost
          </DialogTitle>
          <DialogDescription>
            Please provide a reason why this flight was lost. This information helps track and analyze lost opportunities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lost-reason" className="text-sm font-medium">
              Reason for Loss <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="lost-reason"
              placeholder="e.g., Client chose competitor, Price too high, Schedule conflict, Client cancelled trip..."
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="bg-orange-500 hover:bg-orange-600"
              disabled={markAsLost.isPending || !reason.trim()}
            >
              {markAsLost.isPending ? 'Marking...' : 'Mark as Lost'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

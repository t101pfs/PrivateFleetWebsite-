import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Ban } from 'lucide-react';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { logLeadActivity } from './LeadActivityFeed';

interface MarkLeadAsLostDialogProps {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The Lead 360 page's own "Mark as Lost" button used to set status='lost'
// with no reason captured at all — unlike the flight-level version of this
// same action, which has always required one. Brings the same requirement
// here, on the page people actually use for this now.
export function MarkLeadAsLostDialog({ leadId, open, onOpenChange }: MarkLeadAsLostDialogProps) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const { user, supabaseUser } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const markAsLost = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) {
        throw new Error('Lost reason is required');
      }

      const { error } = await supabase
        .from('leads')
        .update({ status: 'lost', lost_reason: reason.trim() })
        .eq('id', leadId);
      if (error) throw error;

      await logLeadActivity(leadId, 'lost', `Lead marked as Lost: ${reason.trim()}`, supabaseUser?.id, user?.name);
    },
    onSuccess: async () => {
      toast.success('Lead marked as lost');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });

      const mentionedIds = extractMentionedUserIds(reason, profiles).filter((uid) => uid !== user?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you in a lost reason for a lead`,
          leadId,
          sourceTable: 'leads',
          sourceId: leadId,
        });
      }

      setReason('');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to mark lead as lost');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason for marking this lead as lost');
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
            Mark Lead as Lost
          </DialogTitle>
          <DialogDescription>
            Please provide a reason why this lead was lost. This information helps track and analyze lost opportunities.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-lost-reason" className="text-sm font-medium">
              Reason for Loss <span className="text-destructive">*</span>
            </Label>
            <MentionField
              value={reason}
              onChange={setReason}
              candidates={profiles}
              placeholder="e.g., Client chose competitor, Price too high, Schedule conflict, Client cancelled trip..."
              className="min-h-[100px] resize-none"
              rows={4}
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

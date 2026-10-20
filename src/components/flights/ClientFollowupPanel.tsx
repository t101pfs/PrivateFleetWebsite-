import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FollowupRow {
  id: string;
  comment: string;
  extended_minutes: number | null;
  extended_until: string | null;
  created_by: string;
  created_at: string;
}

interface ClientFollowupPanelProps {
  flightId: string;
  /** Sales / Admin only — Operations never sees what was said about the client. */
  canAct: boolean;
  /** The client hasn't confirmed yet, so follow-ups can still be logged. */
  awaitingClient: boolean;
  onUpdate: () => void;
}

/** Follow-up log for the client-confirmation stage: Sales notes each
 * follow-up with the client. There used to also be a "extend by an hour"
 * action here, tied to a confirmation deadline - removed along with that
 * deadline, since there's nothing left to extend. Older follow-ups that
 * were extended before that removal still show their extension for the
 * historical record. */
export function ClientFollowupPanel({ flightId, canAct, awaitingClient, onUpdate }: ClientFollowupPanelProps) {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');

  const { data: followups = [] } = useQuery({
    queryKey: ['option-followups', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('option_followups')
        .select('id, comment, extended_minutes, extended_until, created_by, created_at')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FollowupRow[];
    },
    enabled: canAct,
  });

  const { data: names = {} } = useQuery({
    queryKey: ['option-followup-names', followups.map((f) => f.created_by).sort().join(',')],
    queryFn: async () => {
      const ids = Array.from(new Set(followups.map((f) => f.created_by)));
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { map[p.user_id] = p.full_name || p.email; });
      return map;
    },
    enabled: followups.length > 0,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['option-followups', flightId] });
    onUpdate();
    setComment('');
    setOpen(false);
  };

  const commentOnly = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('option_followups')
        .insert({ flight_id: flightId, comment: comment.trim(), created_by: supabaseUser?.id as string });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success('Follow-up saved');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAct) return null;
  if (!awaitingClient && followups.length === 0) return null;

  const busy = commentOnly.isPending;

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold">Follow-ups with the client</p>
        {awaitingClient && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Follow up
          </Button>
        )}
      </div>

      {followups.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No follow-ups yet. Follow up with the client and add a comment to keep a record of what was said.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto">
          {followups.map((f) => (
            <li key={f.id} className="rounded-md bg-background border p-2 text-sm">
              <p className="whitespace-pre-wrap">{f.comment}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {names[f.created_by] || 'Sales'} · {format(new Date(f.created_at), 'MMM d, h:mm a')}
                {f.extended_until && ` · extended 1 hour, until ${format(new Date(f.extended_until), 'h:mm a')}`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Follow up with the client</DialogTitle>
            <DialogDescription>Note what the client said.</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="followupComment">Comment</Label>
            <Textarea
              id="followupComment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Spoke to the client's assistant — they are checking with the principal and will reply within the hour"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button onClick={() => commentOnly.mutate()} disabled={!comment.trim() || busy}>
              {commentOnly.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

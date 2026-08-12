import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';

export type LeadActivityType =
  | 'note'
  | 'stage_change'
  | 'quotation_sent'
  | 'assigned'
  | 'won'
  | 'lost'
  | 'converted';

export async function logLeadActivity(
  leadId: string,
  activityType: LeadActivityType,
  description: string,
  createdBy?: string | null,
  createdByName?: string | null
) {
  const { error } = await supabase.from('lead_activities').insert({
    lead_id: leadId,
    activity_type: activityType,
    description,
    created_by: createdBy || null,
    created_by_name: createdByName || null,
  });
  if (error) console.error('Failed to log lead activity:', error);
}

interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  created_by_name: string | null;
  created_at: string;
}

interface LeadActivityFeedProps {
  leadId: string;
}

export function LeadActivityFeed({ leadId }: LeadActivityFeedProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [note, setNote] = useState('');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadActivity[];
    },
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      await logLeadActivity(leadId, 'note', note.trim(), supabaseUser?.id, user?.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      setNote('');
      setIsAdding(false);
    },
    onError: () => toast.error('Failed to add activity'),
  });

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Activity</h3>
        <Button variant="outline" size="sm" onClick={() => setIsAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Activity
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What happened?"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!note.trim() || addActivity.isPending}
              onClick={() => addActivity.mutate()}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="h-[320px] pr-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-2">
                  <p className="text-sm">{activity.description}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(activity.created_at), 'h:mm a')}
                    {activity.created_by_name && ` • ${activity.created_by_name}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

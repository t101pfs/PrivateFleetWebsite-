import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { MentionField } from '@/components/mentions/MentionField';
import { MentionText } from '@/components/mentions/MentionText';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';

interface SourcingActivity {
  id: string;
  message: string;
  created_by_name: string | null;
  created_at: string;
}

interface SourcingActivityLogProps {
  flightId: string;
  leadId?: string | null;
  requestLabel?: string;
}

export function SourcingActivityLog({ flightId, leadId, requestLabel }: SourcingActivityLogProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['flight-sourcing-activities', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_sourcing_activities')
        .select('*')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SourcingActivity[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      const content = message.trim();
      const { data, error } = await supabase
        .from('flight_sourcing_activities')
        .insert({
          flight_id: flightId,
          message: content,
          created_by: supabaseUser?.id || null,
          created_by_name: user?.name || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      const mentionedIds = extractMentionedUserIds(content, profiles).filter((uid) => uid !== supabaseUser?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you in sourcing activity for ${requestLabel || 'a flight request'}: "${content}"`,
          leadId: leadId || undefined,
          flightId,
          sourceTable: 'flight_sourcing_activities',
          sourceId: data.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-activities', flightId] });
      setMessage('');
      setIsAdding(false);
    },
    onError: () => toast.error('Failed to log activity'),
  });

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Sourcing Activity</h3>
        <Button variant="outline" size="sm" onClick={() => setIsAdding((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Log Contact
        </Button>
      </div>

      {isAdding && (
        <div className="space-y-2">
          <MentionField
            value={message}
            onChange={setMessage}
            candidates={profiles}
            placeholder="e.g. Operator A contacted, awaiting availability... Use @ to mention a teammate"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!message.trim() || addActivity.isPending}
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

      <ScrollArea className="h-[280px] pr-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No sourcing activity yet</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-2">
                  <p className="text-sm"><MentionText text={activity.message} candidates={profiles} /></p>
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

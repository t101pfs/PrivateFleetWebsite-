import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { addLeadTeamMember } from '@/components/leads/leadTeamChat';

interface LogContactButtonProps {
  leadId: string | null;
  leadName?: string;
}

/** A quick way for Ops to log a sourcing note (e.g. "Operator A contacted,
 * awaiting availability") without leaving the sourcing workspace - it lands
 * in the same lead-level Activity feed everyone already checks on the Lead
 * page, rather than a second, flight-only activity log nobody but Ops ever
 * saw. */
export function LogContactButton({ leadId, leadName }: LogContactButtonProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [message, setMessage] = useState('');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAdding,
  });

  const logContact = useMutation({
    mutationFn: async () => {
      if (!leadId) throw new Error('No lead to log against');
      const content = message.trim();
      const activityId = await logLeadActivity(leadId, 'note', content, supabaseUser?.id, user?.name);
      if (!activityId) throw new Error('Your note could not be saved — please try again.');

      const mentionedIds = extractMentionedUserIds(content, profiles).filter((uid) => uid !== supabaseUser?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you in ${leadName || 'a flight'}'s Activity: "${content}"`,
          leadId,
          sourceTable: 'lead_activities',
          sourceId: activityId,
        });
        for (const uid of mentionedIds) {
          const mentioned = profiles.find((p) => p.user_id === uid);
          await addLeadTeamMember(
            leadId,
            uid,
            'Sales Support',
            undefined,
            supabaseUser?.id,
            user?.name,
            mentioned?.full_name || mentioned?.email
          );
        }
        queryClient.invalidateQueries({ queryKey: ['lead-team-members', leadId] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      setMessage('');
      setIsAdding(false);
      toast.success('Logged');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to log contact'),
  });

  if (!leadId) return null;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
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
            <Button size="sm" disabled={!message.trim() || logContact.isPending} onClick={() => logContact.mutate()}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

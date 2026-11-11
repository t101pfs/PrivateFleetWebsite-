import { supabase } from '@/integrations/supabase/client';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';

export async function addLeadTeamMember(
  leadId: string,
  userId: string,
  roleLabel: string,
  announceName?: string,
  addedBy?: string | null,
  addedByName?: string | null,
  memberDisplayName?: string | null
) {
  const { data: existing } = await supabase
    .from('lead_team_members')
    .select('id')
    .eq('lead_id', leadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase
    .from('lead_team_members')
    .insert({ lead_id: leadId, user_id: userId, role_label: roleLabel, added_by: addedBy || null });

  if (error) return; // idempotent best-effort; swallow (e.g. race on unique constraint)

  if (announceName) {
    await supabase.from('messages').insert({
      lead_id: leadId,
      sender_id: null,
      sender_name: 'System',
      sender_role: 'system',
      is_system: true,
      content: `${announceName} joined as ${roleLabel}.`,
    } as any);
  }

  if (addedBy) {
    await logLeadActivity(
      leadId,
      'team_member_added',
      `${addedByName || 'Someone'} added ${memberDisplayName || announceName || 'a member'} as ${roleLabel}`,
      addedBy,
      addedByName
    );
  }
}

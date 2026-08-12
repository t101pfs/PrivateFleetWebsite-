import { supabase } from '@/integrations/supabase/client';

export async function ensureLeadTeamChat(leadId: string, ownerId: string | null | undefined) {
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
    .eq('is_system', true);

  if (count && count > 0) return; // already initialized

  const { data: admins } = await supabase.rpc('get_admin_user_ids');

  const members: Array<{ lead_id: string; user_id: string; role_label: string }> = [];
  if (ownerId) members.push({ lead_id: leadId, user_id: ownerId, role_label: 'Lead Owner' });
  (admins || []).forEach((a: { user_id: string }) => {
    if (a.user_id !== ownerId) members.push({ lead_id: leadId, user_id: a.user_id, role_label: 'Management' });
  });

  if (members.length > 0) {
    await supabase.from('lead_team_members').upsert(members, { onConflict: 'lead_id,user_id', ignoreDuplicates: true });
  }

  await supabase.from('messages').insert({
    lead_id: leadId,
    sender_id: null,
    sender_name: 'System',
    sender_role: 'system',
    is_system: true,
    content: 'Lead moved to Qualified. Team chat created automatically and assigned members were added.',
  } as any);
}

export async function addLeadTeamMember(
  leadId: string,
  userId: string,
  roleLabel: string,
  announceName?: string
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
    .insert({ lead_id: leadId, user_id: userId, role_label: roleLabel });

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
}

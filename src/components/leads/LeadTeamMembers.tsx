import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PresenceStatus } from '@/hooks/useLeadPresence';

export interface TeamMemberDisplay {
  id: string;
  user_id: string;
  role_label: string | null;
  full_name: string | null;
  email: string | null;
}

interface LeadTeamMembersProps {
  leadId: string;
  members: TeamMemberDisplay[];
  presenceMap: Map<string, PresenceStatus>;
  canManage: boolean;
  isAddOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
}

const STATUS_STYLES: Record<'online' | 'away' | 'offline', { label: string; color: string }> = {
  online: { label: 'Online', color: 'bg-success text-success-foreground' },
  away: { label: 'Away', color: 'bg-warning text-warning-foreground' },
  offline: { label: 'Offline', color: 'bg-muted text-muted-foreground' },
};

export function LeadTeamMembers({ leadId, members, presenceMap, canManage, isAddOpen, onAddOpenChange }: LeadTeamMembersProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleLabel, setRoleLabel] = useState('Sales Support');

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: isAddOpen,
  });

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableProfiles = profiles.filter((p) => !memberIds.has(p.user_id));

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('lead_team_members')
        .insert({ lead_id: leadId, user_id: selectedUserId, role_label: roleLabel });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-team-members', leadId] });
      toast.success('Member added');
      setSelectedUserId('');
      onAddOpenChange(false);
    },
    onError: (error: Error) => toast.error('Failed to add member: ' + error.message),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('lead_team_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-team-members', leadId] });
      toast.success('Member removed');
    },
    onError: (error: Error) => toast.error('Failed to remove member: ' + error.message),
  });

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Assigned Team</h3>
          <p className="text-xs text-muted-foreground">Auto-synced with lead assignments</p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => onAddOpenChange(true)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => {
          const status = presenceMap.get(member.user_id) || 'offline';
          const style = STATUS_STYLES[status];
          return (
            <div key={member.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-xs font-semibold">
                  {(member.full_name || member.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                  <p className="text-xs text-muted-foreground">{member.role_label || 'Member'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', style.color)}>{style.label}</span>
                {canManage && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMember.mutate(member.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={isAddOpen} onOpenChange={onAddOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
              <SelectContent>
                {availableProfiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleLabel} onValueChange={setRoleLabel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales Support">Sales Support</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Management">Management</SelectItem>
              </SelectContent>
            </Select>
            <Button className="w-full" disabled={!selectedUserId || addMember.isPending} onClick={() => addMember.mutate()}>
              {addMember.isPending ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

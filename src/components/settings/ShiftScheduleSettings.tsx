import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ShiftRow {
  id: string;
  start_date: string;
  end_date: string;
  admin_id: string;
  ops_id_1: string;
  ops_id_2: string;
  notes: string | null;
}

interface PersonOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

const emptyForm = { start_date: '', end_date: '', admin_id: '', ops_id_1: '', ops_id_2: '', notes: '' };

function isCurrent(shift: ShiftRow) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return shift.start_date <= today && today <= shift.end_date;
}

export function ShiftScheduleSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRow | null>(null);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shift-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_schedules').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data as ShiftRow[];
    },
  });

  const { data: admins = [] } = useQuery({
    queryKey: ['profiles-for-shifts', 'admin'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').in('role', ['admin', 'super_admin']);
      const ids = (roleRows || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids).order('full_name');
      return (data || []) as PersonOption[];
    },
  });

  const { data: opsUsers = [] } = useQuery({
    queryKey: ['profiles-for-shifts', 'operations'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'operations');
      const ids = (roleRows || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids).order('full_name');
      return (data || []) as PersonOption[];
    },
  });

  const personLabel = (id: string, pool: PersonOption[]) => {
    const p = pool.find((x) => x.user_id === id);
    return p ? (p.full_name || p.email) : 'Unknown';
  };

  useEffect(() => {
    if (dialogOpen) {
      setForm(editing ? {
        start_date: editing.start_date,
        end_date: editing.end_date,
        admin_id: editing.admin_id,
        ops_id_1: editing.ops_id_1,
        ops_id_2: editing.ops_id_2,
        notes: editing.notes || '',
      } : emptyForm);
    }
  }, [dialogOpen, editing]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (shift: ShiftRow) => { setEditing(shift); setDialogOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.start_date || !form.end_date) throw new Error('Start and end date are required');
      if (form.end_date < form.start_date) throw new Error('End date must be on or after the start date');
      if (!form.admin_id) throw new Error('Choose the Admin overseeing this shift');
      if (!form.ops_id_1 || !form.ops_id_2) throw new Error('Choose both Ops reps for this shift');
      if (form.ops_id_1 === form.ops_id_2) throw new Error('The two Ops reps must be different people');

      const payload = {
        start_date: form.start_date,
        end_date: form.end_date,
        admin_id: form.admin_id,
        ops_id_1: form.ops_id_1,
        ops_id_2: form.ops_id_2,
        notes: form.notes.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from('shift_schedules').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('shift_schedules').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-schedules'] });
      toast.success(editing ? 'Shift updated' : 'Shift added');
      setDialogOpen(false);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to save shift';
      toast.error(message.includes('shift_schedules_no_overlap') ? 'This date range overlaps with an existing shift' : message);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-schedules'] });
      toast.success('Shift deleted');
      setDeleteTarget(null);
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to delete shift'),
  });

  const noEligiblePeople = admins.length === 0 || opsUsers.length < 2;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-lg">
          Each shift pairs one Admin with two Operations reps for a date range. When an Ops
          escalation needs an Admin's attention (an overdue Operator Contract, choosing who signs
          it), it now goes to whoever is on the current shift — or every Admin if no shift covers today.
        </p>
        <Button onClick={openAdd} disabled={noEligiblePeople}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

      {noEligiblePeople && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You need at least 1 Admin and 2 Operations users before a shift can be created — add them under Users first.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : shifts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No shifts scheduled yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {shifts.map((shift) => (
            <Card key={shift.id} className={isCurrent(shift) ? 'border-primary/50' : undefined}>
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {format(new Date(shift.start_date + 'T00:00:00'), 'MMM d, yyyy')} – {format(new Date(shift.end_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </span>
                    {isCurrent(shift) && <Badge className="bg-success text-success-foreground">Current</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Admin: <span className="text-foreground font-medium">{personLabel(shift.admin_id, admins)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {personLabel(shift.ops_id_1, opsUsers)} &amp; {personLabel(shift.ops_id_2, opsUsers)}
                  </p>
                  {shift.notes && <p className="text-xs text-muted-foreground italic">{shift.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(shift)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(shift)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="shift_start">Start Date *</Label>
              <Input id="shift_start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift_end">End Date *</Label>
              <Input id="shift_end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="shift_admin">Admin *</Label>
              <Select value={form.admin_id} onValueChange={(value) => setForm({ ...form, admin_id: value })}>
                <SelectTrigger id="shift_admin"><SelectValue placeholder="Choose an Admin" /></SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift_ops1">Ops Rep 1 *</Label>
              <Select value={form.ops_id_1} onValueChange={(value) => setForm({ ...form, ops_id_1: value })}>
                <SelectTrigger id="shift_ops1"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {opsUsers.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift_ops2">Ops Rep 2 *</Label>
              <Select value={form.ops_id_2} onValueChange={(value) => setForm({ ...form, ops_id_2: value })}>
                <SelectTrigger id="shift_ops2"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {opsUsers.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="shift_notes">Notes</Label>
              <Textarea id="shift_notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save Changes' : 'Add Shift'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this shift?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone. Escalations during this date range will fall back to notifying all Admins.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && remove.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

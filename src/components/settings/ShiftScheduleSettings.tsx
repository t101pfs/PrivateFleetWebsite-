import { useEffect, useMemo, useState } from 'react';
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
import { Loader2, Plus, Pencil, Trash2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface ShiftRow {
  id: string;
  shift_date: string;
  shift_type: 'day' | 'night';
  ops_id: string;
  paired_user_id_1: string | null;
  paired_user_id_2: string | null;
  notes: string | null;
}

interface PersonOption {
  user_id: string;
  full_name: string | null;
  email: string;
}

const emptyForm = { shift_date: '', shift_type: 'day' as 'day' | 'night', ops_id: '', paired_user_id_1: '', paired_user_id_2: '', notes: '' };

// KSA has no DST, but computing "today in KSA" from the browser's own clock
// still needs a real timezone conversion, not a fixed offset guess.
function getKsaNow(): { date: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutesOfDay: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

function isCurrentShift(shift: ShiftRow, ksaNow: { date: string; minutesOfDay: number }): boolean {
  if (shift.shift_type === 'day') {
    return shift.shift_date === ksaNow.date && ksaNow.minutesOfDay >= 8 * 60 && ksaNow.minutesOfDay < 22 * 60;
  }
  if (shift.shift_date === ksaNow.date && ksaNow.minutesOfDay >= 22 * 60) return true;
  const yesterday = format(subDays(new Date(ksaNow.date + 'T00:00:00'), 1), 'yyyy-MM-dd');
  return shift.shift_date === yesterday && ksaNow.minutesOfDay < 8 * 60;
}

export function ShiftScheduleSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ShiftRow | null>(null);
  const [now, setNow] = useState(() => getKsaNow());

  useEffect(() => {
    const interval = setInterval(() => setNow(getKsaNow()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['shift-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_schedules').select('*').order('shift_date', { ascending: false });
      if (error) throw error;
      return data as ShiftRow[];
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

  // Day-shift pairing pool: Sales and Admin/Super Admin combined.
  const { data: pairPool = [] } = useQuery({
    queryKey: ['profiles-for-shifts', 'pair-pool'],
    queryFn: async () => {
      const { data: roleRows } = await supabase.from('user_roles').select('user_id').in('role', ['sales', 'admin', 'super_admin']);
      const ids = (roleRows || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids).order('full_name');
      return (data || []) as PersonOption[];
    },
  });

  const allPeople = useMemo(() => [...opsUsers, ...pairPool], [opsUsers, pairPool]);
  const personLabel = (id: string | null) => {
    if (!id) return 'Unassigned';
    const p = allPeople.find((x) => x.user_id === id);
    return p ? (p.full_name || p.email) : 'Unknown';
  };

  useEffect(() => {
    if (dialogOpen) {
      setForm(editing ? {
        shift_date: editing.shift_date,
        shift_type: editing.shift_type,
        ops_id: editing.ops_id,
        paired_user_id_1: editing.paired_user_id_1 || '',
        paired_user_id_2: editing.paired_user_id_2 || '',
        notes: editing.notes || '',
      } : emptyForm);
    }
  }, [dialogOpen, editing]);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (shift: ShiftRow) => { setEditing(shift); setDialogOpen(true); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.shift_date) throw new Error('Pick a date');
      if (!form.ops_id) throw new Error('Choose the Operations person on shift');
      if (form.shift_type === 'day') {
        if (!form.paired_user_id_1 || !form.paired_user_id_2) throw new Error('Choose both people paired for the Day shift');
        if (form.paired_user_id_1 === form.paired_user_id_2) throw new Error('The two paired people must be different');
      }

      const payload = {
        shift_date: form.shift_date,
        shift_type: form.shift_type,
        ops_id: form.ops_id,
        paired_user_id_1: form.shift_type === 'day' ? form.paired_user_id_1 : null,
        paired_user_id_2: form.shift_type === 'day' ? form.paired_user_id_2 : null,
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
      toast.error(message.includes('shift_schedules_unique_entry') ? 'This person already has a shift of this type on this date' : message);
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

  const noEligiblePeople = opsUsers.length === 0 || pairPool.length < 2;

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, ShiftRow[]>();
    for (const shift of shifts) {
      const list = groups.get(shift.shift_date) || [];
      list.push(shift);
      groups.set(shift.shift_date, list);
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [shifts]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-lg">
          Each entry puts one Operations person on Day (08:00–22:00 KSA) or Night (22:00–08:00 KSA) shift for a date.
          A Day shift pairs 2 Sales/Admin people for escalations; a Night shift has no specific pair - it covers everyone.
          A new flight request is routed to whoever's on shift right now, falling back to all of Operations if nobody is scheduled.
        </p>
        <Button onClick={openAdd} disabled={noEligiblePeople}>
          <Plus className="h-4 w-4 mr-2" />
          Add Shift
        </Button>
      </div>

      {noEligiblePeople && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4 text-sm text-muted-foreground">
            You need at least 1 Operations user and 2 Sales/Admin users before a shift can be created — add them under Users first.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : groupedByDate.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No shifts scheduled yet.</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([date, dayShifts]) => (
            <div key={date} className="space-y-2">
              <p className="text-sm font-semibold">{format(new Date(date + 'T00:00:00'), 'EEEE, MMM d, yyyy')}</p>
              <div className="grid gap-3">
                {dayShifts.map((shift) => {
                  const current = isCurrentShift(shift, now);
                  return (
                    <Card key={shift.id} className={current ? 'border-primary/50' : undefined}>
                      <CardContent className="p-4 flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {shift.shift_type === 'day' ? <Sun className="h-3.5 w-3.5 text-warning" /> : <Moon className="h-3.5 w-3.5 text-primary" />}
                            <span className="font-medium text-sm">{shift.shift_type === 'day' ? 'Day · 08:00–22:00' : 'Night · 22:00–08:00'}</span>
                            {current && <Badge className="bg-success text-success-foreground">Current</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Operations: <span className="text-foreground font-medium">{personLabel(shift.ops_id)}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {shift.shift_type === 'day'
                              ? <>Paired: <span className="text-foreground font-medium">{personLabel(shift.paired_user_id_1)} &amp; {personLabel(shift.paired_user_id_2)}</span></>
                              : 'Covers all Admins & Sales'}
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
                  );
                })}
              </div>
            </div>
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
              <Label htmlFor="shift_date">Date *</Label>
              <Input id="shift_date" type="date" value={form.shift_date} onChange={(e) => setForm({ ...form, shift_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shift_type">Shift *</Label>
              <Select value={form.shift_type} onValueChange={(value) => setForm({ ...form, shift_type: value as 'day' | 'night' })}>
                <SelectTrigger id="shift_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day (08:00–22:00 KSA)</SelectItem>
                  <SelectItem value="night">Night (22:00–08:00 KSA)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="shift_ops">Operations Person *</Label>
              <Select value={form.ops_id} onValueChange={(value) => setForm({ ...form, ops_id: value })}>
                <SelectTrigger id="shift_ops"><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {opsUsers.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.shift_type === 'day' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shift_pair1">Paired With *</Label>
                  <Select value={form.paired_user_id_1} onValueChange={(value) => setForm({ ...form, paired_user_id_1: value })}>
                    <SelectTrigger id="shift_pair1"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {pairPool.map((o) => (
                        <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shift_pair2">And *</Label>
                  <Select value={form.paired_user_id_2} onValueChange={(value) => setForm({ ...form, paired_user_id_2: value })}>
                    <SelectTrigger id="shift_pair2"><SelectValue placeholder="Choose" /></SelectTrigger>
                    <SelectContent>
                      {pairPool.map((o) => (
                        <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="col-span-2 text-xs text-muted-foreground">
                Night shifts cover everyone — no specific pairing needed.
              </p>
            )}
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
            <AlertDialogDescription>This can't be undone. New flight requests during this window will fall back to notifying all of Operations.</AlertDialogDescription>
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

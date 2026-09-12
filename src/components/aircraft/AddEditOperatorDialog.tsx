import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface OperatorRow {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  aoc_number: string | null;
  insurance_expiry: string | null;
  status: string | null;
  notes: string | null;
}

interface AddEditOperatorDialogProps {
  operator: OperatorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = {
  name: '',
  contact_email: '',
  contact_phone: '',
  country: '',
  aoc_number: '',
  insurance_expiry: '',
  status: 'active',
  notes: '',
};

export function AddEditOperatorDialog({ operator, open, onOpenChange }: AddEditOperatorDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (open) {
      setForm({
        name: operator?.name || '',
        contact_email: operator?.contact_email || '',
        contact_phone: operator?.contact_phone || '',
        country: operator?.country || '',
        aoc_number: operator?.aoc_number || '',
        insurance_expiry: operator?.insurance_expiry || '',
        status: operator?.status || 'active',
        notes: operator?.notes || '',
      });
    }
  }, [operator, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Operator name is required');

      const payload = {
        name: form.name.trim(),
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        country: form.country.trim() || null,
        aoc_number: form.aoc_number.trim() || null,
        insurance_expiry: form.insurance_expiry || null,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (operator) {
        const { error } = await supabase.from('operators').update(payload).eq('id', operator.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('operators').insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators-list'] });
      queryClient.invalidateQueries({ queryKey: ['operators-list-active'] });
      toast.success(operator ? 'Operator updated' : 'Operator added');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to save operator');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{operator ? 'Edit Operator' : 'Add Operator'}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="space-y-2 col-span-2">
            <Label htmlFor="op_name">Operator Name *</Label>
            <Input id="op_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_email">Contact Email</Label>
            <Input id="op_email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_phone">Contact Phone</Label>
            <Input id="op_phone" type="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_country">Country</Label>
            <Input id="op_country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_aoc">AOC Number</Label>
            <Input id="op_aoc" value={form.aoc_number} onChange={(e) => setForm({ ...form, aoc_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_insurance">Insurance Expiry</Label>
            <Input id="op_insurance" type="date" value={form.insurance_expiry} onChange={(e) => setForm({ ...form, insurance_expiry: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="op_status">Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger id="op_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Partner</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="op_notes">Notes</Label>
            <Textarea id="op_notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {operator ? 'Save Changes' : 'Add Operator'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

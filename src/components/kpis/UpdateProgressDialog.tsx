import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UpdateProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  assignmentId: string;
  kpiName: string;
  metricType: string;
  currentValue: number;
}

export function UpdateProgressDialog({ 
  open, 
  onOpenChange, 
  onUpdated, 
  assignmentId,
  kpiName,
  metricType,
  currentValue
}: UpdateProgressDialogProps) {
  const [value, setValue] = useState(currentValue.toString());
  const [notes, setNotes] = useState('');
  const [recordedDate, setRecordedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) {
      toast.error('Please enter a value');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('kpi_progress').insert({
        assignment_id: assignmentId,
        current_value: parseFloat(value),
        recorded_date: recordedDate,
        notes: notes.trim() || null
      });

      if (error) throw error;

      toast.success('Progress updated successfully');
      setValue('');
      setNotes('');
      onOpenChange(false);
      onUpdated();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update progress');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Progress: {kpiName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="value">
              Current Value {metricType === 'currency' && '($)'}
              {metricType === 'percentage' && '(%)'}
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Enter current value"
              min="0"
              step={metricType === 'currency' ? '0.01' : '1'}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={recordedDate}
              onChange={(e) => setRecordedDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this update..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Progress'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

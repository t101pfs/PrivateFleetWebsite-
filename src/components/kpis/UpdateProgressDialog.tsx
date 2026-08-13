import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';

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
  const { user } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) {
      toast.error('Please enter a value');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kpi_progress')
        .insert({
          assignment_id: assignmentId,
          current_value: parseFloat(value),
          recorded_date: recordedDate,
          notes: notes.trim() || null
        })
        .select('id')
        .single();

      if (error) throw error;

      const mentionedIds = extractMentionedUserIds(notes, profiles).filter((uid) => uid !== user?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you in a progress note for "${kpiName}"`,
          sourceTable: 'kpi_progress',
          sourceId: data.id,
        });
      }

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
            <MentionField
              value={notes}
              onChange={setNotes}
              candidates={profiles}
              placeholder="Add any notes about this update... Use @ to mention a teammate"
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

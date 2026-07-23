import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';

interface KPIDefinition {
  id: string;
  name: string;
  metric_type: string;
  target_period: string;
}

interface UserProfile {
  user_id: string;
  full_name: string | null;
  email: string;
}

interface AssignKPIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
  kpiDefinitions: KPIDefinition[];
}

export function AssignKPIDialog({ open, onOpenChange, onAssigned, kpiDefinitions }: AssignKPIDialogProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedKPI, setSelectedKPI] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .order('full_name');
    
    if (!error && data) {
      setUsers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKPI || !selectedUser || !targetValue) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('kpi_assignments').insert({
        kpi_id: selectedKPI,
        user_id: selectedUser,
        target_value: parseFloat(targetValue),
        start_date: startDate,
        end_date: endDate,
        assigned_by: user?.id
      });

      if (error) throw error;

      toast.success('KPI assigned successfully');
      setSelectedKPI('');
      setSelectedUser('');
      setTargetValue('');
      onOpenChange(false);
      onAssigned();
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign KPI');
    } finally {
      setLoading(false);
    }
  };

  const selectedKPIDef = kpiDefinitions.find(k => k.id === selectedKPI);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign KPI to User</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select KPI</Label>
            <Select value={selectedKPI} onValueChange={setSelectedKPI}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a KPI..." />
              </SelectTrigger>
              <SelectContent>
                {kpiDefinitions.map((kpi) => (
                  <SelectItem key={kpi.id} value={kpi.id}>
                    {kpi.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assign To</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select user..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="target">
              Target Value {selectedKPIDef?.metric_type === 'currency' && '($)'}
              {selectedKPIDef?.metric_type === 'percentage' && '(%)'}
            </Label>
            <Input
              id="target"
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="Enter target value"
              min="0"
              step={selectedKPIDef?.metric_type === 'currency' ? '0.01' : '1'}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign KPI'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

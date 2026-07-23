import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Target, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreateKPIDialog } from '@/components/kpis/CreateKPIDialog';
import { AssignKPIDialog } from '@/components/kpis/AssignKPIDialog';
import { format } from 'date-fns';

interface KPIDefinition {
  id: string;
  name: string;
  description: string | null;
  metric_type: string;
  target_period: string;
  created_at: string;
}

interface KPIAssignment {
  id: string;
  kpi_id: string;
  user_id: string;
  target_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  kpi_definitions: {
    name: string;
    metric_type: string;
  };
  profiles: {
    full_name: string | null;
    email: string;
  };
}

export function KPIManagement() {
  const [definitions, setDefinitions] = useState<KPIDefinition[]>([]);
  const [assignments, setAssignments] = useState<KPIAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [defsResult, assignResult] = await Promise.all([
        supabase.from('kpi_definitions').select('*').order('created_at', { ascending: false }),
        supabase.from('kpi_assignments')
          .select(`
            *,
            kpi_definitions (name, metric_type),
            profiles!kpi_assignments_user_id_fkey (full_name, email)
          `)
          .order('created_at', { ascending: false })
      ]);

      if (defsResult.error) throw defsResult.error;
      if (assignResult.error) throw assignResult.error;

      setDefinitions(defsResult.data || []);
      setAssignments((assignResult.data as any) || []);
    } catch (error: any) {
      toast.error('Failed to load KPI data');
    } finally {
      setLoading(false);
    }
  };

  const deleteDefinition = async (id: string) => {
    if (!confirm('Are you sure? This will delete all assignments for this KPI.')) return;
    
    try {
      const { error } = await supabase.from('kpi_definitions').delete().eq('id', id);
      if (error) throw error;
      toast.success('KPI deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete KPI');
    }
  };

  const toggleAssignment = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('kpi_assignments')
        .update({ is_active: !currentActive })
        .eq('id', id);
      if (error) throw error;
      toast.success(currentActive ? 'Assignment deactivated' : 'Assignment activated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update assignment');
    }
  };

  const formatValue = (value: number, metricType: string) => {
    switch (metricType) {
      case 'currency':
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      case 'percentage':
        return `${value}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Definitions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            KPI Definitions
          </CardTitle>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create KPI
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : definitions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No KPIs defined yet. Create your first KPI to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {definitions.map((def) => (
                  <TableRow key={def.id}>
                    <TableCell className="font-medium">{def.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {def.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{def.metric_type}</Badge>
                    </TableCell>
                    <TableCell className="capitalize">{def.target_period}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDefinition(def.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* KPI Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            KPI Assignments
          </CardTitle>
          <Button 
            onClick={() => setAssignDialogOpen(true)} 
            disabled={definitions.length === 0}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Assign KPI
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No KPIs assigned yet. Assign a KPI to a user to track their progress.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>KPI</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell className="font-medium">
                      {assignment.profiles?.full_name || assignment.profiles?.email || 'Unknown'}
                    </TableCell>
                    <TableCell>{assignment.kpi_definitions?.name}</TableCell>
                    <TableCell>
                      {formatValue(assignment.target_value, assignment.kpi_definitions?.metric_type || 'count')}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(assignment.start_date), 'MMM d')} - {format(new Date(assignment.end_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={assignment.is_active ? 'default' : 'secondary'}>
                        {assignment.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAssignment(assignment.id, assignment.is_active)}
                      >
                        {assignment.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateKPIDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen}
        onCreated={fetchData}
      />
      
      <AssignKPIDialog 
        open={assignDialogOpen} 
        onOpenChange={setAssignDialogOpen}
        onAssigned={fetchData}
        kpiDefinitions={definitions}
      />
    </div>
  );
}

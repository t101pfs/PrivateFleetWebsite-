import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KPICard } from '@/components/kpis/KPICard';
import { KPIProgressChart } from '@/components/kpis/KPIProgressChart';
import { UpdateProgressDialog } from '@/components/kpis/UpdateProgressDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Target, TrendingUp, Calendar, Plus } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface KPIWithProgress {
  id: string;
  kpi_id: string;
  target_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  kpi_definitions: {
    id: string;
    name: string;
    description: string | null;
    metric_type: string;
    target_period: string;
  };
  progress: {
    current_value: number;
    recorded_date: string;
  }[];
}

export default function KPIs() {
  const { user } = useAuth();
  const [kpis, setKPIs] = useState<KPIWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKPI, setSelectedKPI] = useState<KPIWithProgress | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState('all');

  useEffect(() => {
    fetchKPIs();
  }, []);

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      const { data: assignments, error } = await supabase
        .from('kpi_assignments')
        .select(`
          *,
          kpi_definitions (id, name, description, metric_type, target_period)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch progress for each assignment
      const kpisWithProgress: KPIWithProgress[] = [];
      
      for (const assignment of assignments || []) {
        const { data: progress } = await supabase
          .from('kpi_progress')
          .select('current_value, recorded_date')
          .eq('assignment_id', assignment.id)
          .order('recorded_date', { ascending: true });

        kpisWithProgress.push({
          ...assignment,
          progress: progress || []
        } as KPIWithProgress);
      }

      setKPIs(kpisWithProgress);
    } catch (error: any) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentValue = (kpi: KPIWithProgress) => {
    if (kpi.progress.length === 0) return 0;
    return kpi.progress[kpi.progress.length - 1].current_value;
  };

  const filteredKPIs = kpis.filter(kpi => {
    if (periodFilter === 'all') return true;
    return kpi.kpi_definitions?.target_period === periodFilter;
  });

  const totalKPIs = kpis.length;
  const achievedKPIs = kpis.filter(kpi => getCurrentValue(kpi) >= kpi.target_value).length;
  const avgProgress = kpis.length > 0 
    ? Math.round(kpis.reduce((sum, kpi) => {
        const pct = kpi.target_value > 0 ? (getCurrentValue(kpi) / kpi.target_value) * 100 : 0;
        return sum + Math.min(pct, 100);
      }, 0) / kpis.length)
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">My KPIs</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Track your performance against assigned targets
            </p>
          </div>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Periods</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalKPIs}</p>
                  <p className="text-sm text-muted-foreground">Active KPIs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{achievedKPIs}</p>
                  <p className="text-sm text-muted-foreground">Targets Achieved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avgProgress}%</p>
                  <p className="text-sm text-muted-foreground">Avg Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading KPIs...</div>
        ) : filteredKPIs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No KPIs Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any active KPIs assigned yet. Contact your administrator to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredKPIs.map((kpi) => (
              <KPICard
                key={kpi.id}
                name={kpi.kpi_definitions?.name || ''}
                currentValue={getCurrentValue(kpi)}
                targetValue={kpi.target_value}
                metricType={kpi.kpi_definitions?.metric_type as 'count' | 'currency' | 'percentage'}
                targetPeriod={kpi.kpi_definitions?.target_period || ''}
                onClick={() => setSelectedKPI(kpi)}
              />
            ))}
          </div>
        )}

        {/* Selected KPI Detail */}
        {selectedKPI && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{selectedKPI.kpi_definitions?.name}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedKPI.kpi_definitions?.description || 'No description'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {selectedKPI.kpi_definitions?.target_period}
                </Badge>
                <Button onClick={() => setUpdateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Update Progress
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Period: {format(new Date(selectedKPI.start_date), 'MMM d, yyyy')} - {format(new Date(selectedKPI.end_date), 'MMM d, yyyy')}
                </p>
              </div>
              {selectedKPI.progress.length > 0 ? (
                <KPIProgressChart
                  data={selectedKPI.progress.map(p => ({ date: p.recorded_date, value: p.current_value }))}
                  targetValue={selectedKPI.target_value}
                  metricType={selectedKPI.kpi_definitions?.metric_type as 'count' | 'currency' | 'percentage'}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No progress recorded yet. Click "Update Progress" to log your first entry.
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {selectedKPI && (
        <UpdateProgressDialog
          open={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          onUpdated={fetchKPIs}
          assignmentId={selectedKPI.id}
          kpiName={selectedKPI.kpi_definitions?.name || ''}
          metricType={selectedKPI.kpi_definitions?.metric_type || 'count'}
          currentValue={getCurrentValue(selectedKPI)}
        />
      )}
    </DashboardLayout>
  );
}

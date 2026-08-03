import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { FlightRequestCard } from '@/components/dashboard/FlightRequestCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { KPICard } from '@/components/kpis/KPICard';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useDashboardFlights } from '@/hooks/useDashboardFlights';
import { Plane, Users, TrendingUp, Clock, Filter, Target, ArrowRight, CheckCircle2 } from 'lucide-react';

interface KPIWithProgress {
  id: string;
  target_value: number;
  kpi_definitions: {
    name: string;
    metric_type: string;
    target_period: string;
  };
  currentValue: number;
}

export default function Dashboard() {
  const { user, viewMode, setViewMode, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const isSales = effectiveRole === 'sales';
  const isOps = effectiveRole === 'operations';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: flightData, isLoading: flightsLoading } = useDashboardFlights();

  const [userKPIs, setUserKPIs] = useState<KPIWithProgress[]>([]);
  const [loadingKPIs, setLoadingKPIs] = useState(true);

  const activeFlights = flightData?.activeFlights || [];
  const confirmedFlights = flightData?.confirmedFlights || [];

  useEffect(() => {
    if (!isAdmin) {
      fetchUserKPIs();
    } else {
      setLoadingKPIs(false);
    }
  }, [isAdmin]);

  const fetchUserKPIs = async () => {
    try {
      const { data: assignments, error } = await supabase
        .from('kpi_assignments')
        .select(`
          id,
          target_value,
          kpi_definitions (name, metric_type, target_period)
        `)
        .eq('is_active', true)
        .limit(3);

      if (error) throw error;

      const kpisWithProgress: KPIWithProgress[] = [];
      
      for (const assignment of assignments || []) {
        const { data: progress } = await supabase
          .from('kpi_progress')
          .select('current_value')
          .eq('assignment_id', assignment.id)
          .order('recorded_date', { ascending: false })
          .limit(1);

        kpisWithProgress.push({
          ...assignment,
          currentValue: progress?.[0]?.current_value || 0
        } as KPIWithProgress);
      }

      setUserKPIs(kpisWithProgress);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoadingKPIs(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              Welcome back, {user?.name.split(' ')[0]}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              {isSales && "Here's what's happening with your charter requests today."}
              {isOps && "Here's your operations overview for today."}
              {isAdmin && "System overview and performance metrics."}
            </p>
          </div>
          {user?.role === 'super_admin' && (
            <ToggleGroup
              type="single"
              value={viewMode}
              onValueChange={(value) => value && setViewMode(value as typeof viewMode)}
              className="bg-muted/30 rounded-lg p-1"
            >
              <ToggleGroupItem value="default" className="text-xs px-3">Super Admin</ToggleGroupItem>
              <ToggleGroupItem value="sales" className="text-xs px-3">Sales View</ToggleGroupItem>
              <ToggleGroupItem value="ops" className="text-xs px-3">Ops View</ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isSales && (
            <>
              <StatsCard
                title="Active Requests"
                value={statsLoading ? '...' : stats?.activeRequests || 0}
                subtitle="Currently in progress"
                icon={Plane}
                variant="accent"
              />
              <StatsCard
                title="Total Clients"
                value={statsLoading ? '...' : stats?.totalClients || 0}
                icon={Users}
              />
              <StatsCard
                title="This Month"
                value={statsLoading ? '...' : formatCurrency(stats?.monthRevenue || 0)}
                subtitle="Revenue generated"
                icon={TrendingUp}
                variant="accent"
              />
              <StatsCard
                title="Confirmed Flights"
                value={flightsLoading ? '...' : confirmedFlights.length}
                subtitle="Ready for departure"
                icon={CheckCircle2}
              />
            </>
          )}
          {isOps && (
            <>
              <StatsCard
                title="Pending Requests"
                value={statsLoading ? '...' : stats?.pendingRequests || 0}
                subtitle="Awaiting assignment"
                icon={Plane}
                variant="accent"
              />
              <StatsCard
                title="In Sourcing"
                value={statsLoading ? '...' : stats?.inSourcing || 0}
                subtitle="Aircraft being sourced"
                icon={Clock}
                variant="accent"
              />
              <StatsCard
                title="Confirmed Today"
                value={statsLoading ? '...' : stats?.confirmedToday || 0}
                icon={TrendingUp}
              />
              <StatsCard
                title="Your Flights"
                value={statsLoading ? '...' : stats?.assignedFlights || 0}
                subtitle="This month"
                icon={Users}
              />
            </>
          )}
          {isAdmin && (
            <>
              <StatsCard
                title="Total Users"
                value={statsLoading ? '...' : stats?.totalUsers || 0}
                subtitle="Active users"
                icon={Users}
                variant="accent"
              />
              <StatsCard
                title="Active Flights"
                value={statsLoading ? '...' : stats?.activeRequests || 0}
                icon={Plane}
              />
              <StatsCard
                title="Revenue MTD"
                value={statsLoading ? '...' : formatCurrency(stats?.revenueMTD || 0)}
                icon={TrendingUp}
                variant="accent"
              />
              <StatsCard
                title="Fleet Size"
                value={statsLoading ? '...' : stats?.totalAircraft || 0}
                subtitle="Aircraft in system"
                icon={Clock}
              />
            </>
          )}
        </div>

        {/* Charts Section */}
        <DashboardCharts variant={isSales ? 'sales' : isOps ? 'ops' : 'admin'} />

        {/* KPIs Section (for non-admin users) */}
        {!isAdmin && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                My KPIs
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/kpis')} className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {loadingKPIs ? (
              <div className="text-muted-foreground">Loading KPIs...</div>
            ) : userKPIs.length === 0 ? (
              <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
                No KPIs assigned yet. Contact your administrator.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {userKPIs.map((kpi) => (
                  <KPICard
                    key={kpi.id}
                    name={kpi.kpi_definitions?.name || ''}
                    currentValue={kpi.currentValue}
                    targetValue={kpi.target_value}
                    metricType={kpi.kpi_definitions?.metric_type as 'count' | 'currency' | 'percentage'}
                    targetPeriod={kpi.kpi_definitions?.target_period || ''}
                    onClick={() => navigate('/kpis')}
                  />
                ))}
              </div>
            )}
          </div>
        )}


        {/* Confirmed Flights Section - for Sales and Admin only */}
        {!isOps && confirmedFlights.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Confirmed Flights
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/flights')} className="gap-1">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {confirmedFlights.slice(0, 3).map((flight) => (
                <div 
                  key={flight.id}
                  onClick={() => navigate('/flights')}
                  className="bg-card border border-success/20 rounded-xl p-4 cursor-pointer hover:border-success/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-sm font-medium">#{flight.id.slice(0, 8).toUpperCase()}</span>
                    <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full">Confirmed</span>
                  </div>
                  <div className="text-sm font-medium mb-1">
                    {flight.route.departure.split(' ')[0]} → {flight.route.arrival.split(' ')[0]}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{new Date(flight.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    <span>{flight.time}</span>
                    <span>{flight.passengers} pax</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">
              {isOps ? 'Your Active Flights' : 'Your Active Flight Requests'}
            </h2>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/flights')}>
              <Filter className="h-4 w-4" />
              View All
            </Button>
          </div>
          {flightsLoading ? (
            <div className="text-muted-foreground">Loading flights...</div>
          ) : activeFlights.length === 0 ? (
            <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
              No active flight requests.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeFlights.slice(0, 6).map((flight) => (
                <FlightRequestCard key={flight.id} flight={flight} />
              ))}
            </div>
          )}
        </div>

        {/* Activity Feed - Full Width Below */}
        <RecentActivity />
      </div>
    </DashboardLayout>
  );
}

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, BarChart3, PieChartIcon } from 'lucide-react';

const chartConfig = {
  flights: {
    label: 'Flights',
    color: 'hsl(var(--primary))',
  },
  revenue: {
    label: 'Revenue ($K)',
    color: 'hsl(var(--accent))',
  },
};

interface DashboardChartsProps {
  variant?: 'sales' | 'ops' | 'admin';
}

export function DashboardCharts({ variant = 'sales' }: DashboardChartsProps) {
  const { supabaseUser } = useAuth();
  
  // Fetch flight metrics for chart data
  const { data: flightMetrics = [] } = useQuery({
    queryKey: ['dashboard-flight-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_metrics')
        .select('*')
        .order('flight_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch quotes for revenue data
  const { data: quotes = [] } = useQuery({
    queryKey: ['dashboard-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('created_at, total_price, status')
        .in('status', ['accepted', 'converted'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: variant === 'sales' || variant === 'admin',
  });

  // Fetch flight requests for status distribution - filtered for ops users
  const { data: flightRequests = [] } = useQuery({
    queryKey: ['dashboard-flight-requests-status', variant, supabaseUser?.id],
    queryFn: async () => {
      let query = supabase
        .from('flight_requests')
        .select('status_sales, status_ops');
      
      // Filter to only assigned flights for operations users
      if (variant === 'ops' && supabaseUser?.id) {
        query = query.eq('assigned_ops_id', supabaseUser.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Generate monthly flight activity data
  const flightActivityData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return {
        month: date.toLocaleString('default', { month: 'short' }),
        year: date.getFullYear(),
        monthNum: date.getMonth(),
      };
    });

    return last6Months.map(({ month, year, monthNum }) => {
      // Count flights from flight_metrics
      const monthFlights = flightMetrics.filter(m => {
        const d = new Date(m.flight_date);
        return d.getMonth() === monthNum && d.getFullYear() === year;
      });

      // Calculate revenue from quotes
      const monthQuotes = quotes.filter(q => {
        const d = new Date(q.created_at);
        return d.getMonth() === monthNum && d.getFullYear() === year;
      });

      const revenue = monthQuotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);

      return {
        month,
        flights: monthFlights.length,
        revenue: Math.round(revenue / 1000), // Convert to thousands
      };
    });
  }, [flightMetrics, quotes]);

  // Calculate status distribution
  const statusDistribution = useMemo(() => {
    const statusCounts = {
      draft: 0,
      in_progress: 0,
      confirmed: 0,
      completed: 0,
    };

    flightRequests.forEach(f => {
      const status = f.status_sales;
      if (status === 'new') statusCounts.draft++;
      else if (status === 'in_progress') statusCounts.in_progress++;
      else if (status === 'confirmed') statusCounts.confirmed++;
      else if (status === 'completed') statusCounts.completed++;
    });

    return [
      { name: 'Draft/New', value: statusCounts.draft, color: 'hsl(var(--muted-foreground))' },
      { name: 'In Progress', value: statusCounts.in_progress, color: 'hsl(var(--warning))' },
      { name: 'Confirmed', value: statusCounts.confirmed, color: 'hsl(var(--success))' },
      { name: 'Completed', value: statusCounts.completed, color: 'hsl(var(--accent))' },
    ].filter(item => item.value > 0);
  }, [flightRequests]);

  const totalFlights = useMemo(() => 
    statusDistribution.reduce((sum, item) => sum + item.value, 0),
    [statusDistribution]
  );

  const hasFlightData = flightActivityData.some(d => d.flights > 0);
  const hasRevenueData = flightActivityData.some(d => d.revenue > 0);
  const hasStatusData = statusDistribution.length > 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Flight Activity Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" />
            {variant === 'ops' ? 'Your Active Flights' : 'Flight Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasFlightData ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <AreaChart data={flightActivityData}>
                <defs>
                  <linearGradient id="flightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={30}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="flights"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#flightGradient)"
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No flight activity data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Chart (Admin/Sales only) */}
      {(variant === 'admin' || variant === 'sales') && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-accent" />
              Monthly Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasRevenueData ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart data={flightActivityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="revenue"
                    fill="hsl(var(--accent))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Distribution (Ops view) */}
      {variant === 'ops' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Flight Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasStatusData ? (
              <div className="flex items-center gap-6">
                <ChartContainer config={chartConfig} className="h-[160px] w-[160px]">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex-1 space-y-2">
                  {statusDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-2.5 w-2.5 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 flex items-center justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span>{totalFlights}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-[160px] flex items-center justify-center text-muted-foreground text-sm">
                No flight status data available
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

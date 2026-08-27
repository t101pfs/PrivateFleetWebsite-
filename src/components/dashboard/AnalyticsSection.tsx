import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Plane,
  Users,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';

const COLORS = ['hsl(217, 91%, 53%)', 'hsl(211, 95%, 65%)', 'hsl(142, 76%, 36%)', 'hsl(0, 84%, 60%)', 'hsl(222, 70%, 14%)'];

/** Deeper business reporting (revenue, quotes, leads, fleet) — folded into
 * the Admin Dashboard rather than living on its own /analytics page. */
export function AnalyticsSection() {
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: aircraft = [] } = useQuery({
    queryKey: ['aircraft-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  const totalRevenue = quotes
    .filter((q) => q.status === 'accepted' || q.status === 'converted')
    .reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);

  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted' || q.status === 'converted').length;
  const winRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

  const activeAircraft = aircraft.filter((a) => a.status === 'available').length;
  const totalAircraft = aircraft.length;

  const newLeads = leads.filter((l) => l.status === 'new').length;
  const qualifiedLeads = leads.filter((l) => l.status === 'qualified').length;
  const convertedLeads = leads.filter((l) => l.status === 'converted').length;
  const lostLeads = leads.filter((l) => l.status === 'lost').length;

  const quoteStatusData = [
    { name: 'Draft', value: quotes.filter((q) => q.status === 'draft').length },
    { name: 'Sent', value: quotes.filter((q) => q.status === 'sent').length },
    { name: 'Accepted', value: quotes.filter((q) => q.status === 'accepted').length },
    { name: 'Rejected', value: quotes.filter((q) => q.status === 'rejected').length },
    { name: 'Expired', value: quotes.filter((q) => q.status === 'expired').length },
  ].filter((d) => d.value > 0);

  const leadStatusData = [
    { name: 'New', value: newLeads },
    { name: 'Qualified', value: qualifiedLeads },
    { name: 'Converted', value: convertedLeads },
    { name: 'Lost', value: lostLeads },
  ].filter((d) => d.value > 0);

  const monthlyRevenueData = Array.from({ length: 6 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - i));
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthQuotes = quotes.filter((q) => {
      const qDate = new Date(q.created_at || '');
      return qDate >= monthStart && qDate <= monthEnd &&
        (q.status === 'accepted' || q.status === 'converted');
    });

    return {
      month: date.toLocaleString('default', { month: 'short' }),
      revenue: monthQuotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0),
      quotes: monthQuotes.length,
    };
  });

  const aircraftStatusData = [
    { name: 'Available', value: aircraft.filter((a) => a.status === 'available').length },
    { name: 'In Flight', value: aircraft.filter((a) => a.status === 'in_flight').length },
    { name: 'Maintenance', value: aircraft.filter((a) => a.status === 'maintenance').length },
    { name: 'Reserved', value: aircraft.filter((a) => a.status === 'reserved').length },
  ].filter((d) => d.value > 0);

  const activeLeadsCount = leads.filter((l) => !['converted', 'lost'].includes(l.status || '')).length;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Business Analytics
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/10">
                <Target className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Win Rate</p>
                <p className="text-2xl font-bold">{winRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Leads</p>
                <p className="text-2xl font-bold">{activeLeadsCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Plane className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fleet Availability</p>
                <p className="text-2xl font-bold">{activeAircraft}/{totalAircraft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-xl font-bold">{clients.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Leads</p>
                <p className="text-xl font-bold">{newLeads + qualifiedLeads}</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Converted Leads</p>
                <p className="text-xl font-bold text-success">{convertedLeads}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lost Leads</p>
                <p className="text-xl font-bold text-destructive">{lostLeads}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => ['$' + value.toLocaleString(), 'Revenue']}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="hsl(217, 91%, 53%)"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(217, 91%, 53%)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Quote Count</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="quotes" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quote Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {quoteStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={quoteStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {quoteStatusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No quote data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Quote Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Total Quotes</span>
                    <span className="text-2xl font-bold">{totalQuotes}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                    <span className="text-sm font-medium">Accepted</span>
                    <span className="text-2xl font-bold text-success">{acceptedQuotes}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
                    <span className="text-sm font-medium">Conversion Rate</span>
                    <span className="text-2xl font-bold text-primary">{winRate}%</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10">
                    <span className="text-sm font-medium">Avg Quote Value</span>
                    <span className="text-2xl font-bold text-accent">
                      ${totalQuotes > 0
                        ? Math.round(quotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0) / totalQuotes).toLocaleString()
                        : 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leads">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {leadStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="hsl(217, 91%, 60%)" />
                          <Cell fill="hsl(211, 95%, 65%)" />
                          <Cell fill="hsl(142, 76%, 36%)" />
                          <Cell fill="hsl(0, 84%, 60%)" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No lead data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lead Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Total Leads</span>
                    <span className="text-2xl font-bold">{leads.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10">
                    <span className="text-sm font-medium">Active Leads</span>
                    <span className="text-2xl font-bold text-accent">{activeLeadsCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                    <span className="text-sm font-medium">Converted Leads</span>
                    <span className="text-2xl font-bold text-success">
                      {leads.filter((l) => l.status === 'converted').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
                    <span className="text-sm font-medium">Conversion Rate</span>
                    <span className="text-2xl font-bold text-primary">
                      {leads.filter((l) => ['converted', 'lost'].includes(l.status || '')).length > 0
                        ? Math.round((convertedLeads / leads.filter((l) => ['converted', 'lost'].includes(l.status || '')).length) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fleet">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fleet Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {aircraftStatusData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={aircraftStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {aircraftStatusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      No aircraft data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fleet Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Total Aircraft</span>
                    <span className="text-2xl font-bold">{totalAircraft}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                    <span className="text-sm font-medium">Available</span>
                    <span className="text-2xl font-bold text-success">{activeAircraft}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10">
                    <span className="text-sm font-medium">In Flight</span>
                    <span className="text-2xl font-bold text-accent">
                      {aircraft.filter((a) => a.status === 'in_flight').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-warning/10">
                    <span className="text-sm font-medium">In Maintenance</span>
                    <span className="text-2xl font-bold text-warning">
                      {aircraft.filter((a) => a.status === 'maintenance').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

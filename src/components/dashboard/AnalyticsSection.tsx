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
import { BarChart3 } from 'lucide-react';

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

  const totalQuotes = quotes.length;
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted' || q.status === 'converted').length;
  const winRate = totalQuotes > 0 ? Math.round((acceptedQuotes / totalQuotes) * 100) : 0;

  const activeAircraft = aircraft.filter((a) => a.status === 'available').length;

  const newLeads = leads.filter((l) => l.status === 'new').length;
  const qualifiedLeads = leads.filter((l) => l.status === 'qualified').length;
  // Conversion is tracked via converted_to_client_id, not a 'converted' status
  // value — no code path ever sets leads.status to 'converted', so filtering
  // on it here always returned 0 regardless of how many leads actually converted.
  const convertedLeads = leads.filter((l) => !!l.converted_to_client_id).length;
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

  const activeLeadsCount = leads.filter(
    (l) => l.status !== 'won' && l.status !== 'lost' && !l.converted_to_client_id
  ).length;

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl font-semibold flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        Business Analytics
      </h2>

      {/* The 5 KPI/stat cards that used to sit here (Win Rate, Active
          Flights, Total Clients, New & Qualified, Converted Flights) were
          removed - Active Flights and Converted Flights are already
          restated in the Flights tab's own summary panel below, and the
          rest were adding noise without adding information worth a whole
          extra row of cards. This section reads from the leads table (a
          flight can exist as a lead before it's ever formally a
          flight_request) but is labeled "Flights" throughout to match how
          the team actually refers to these - numbers here can legitimately
          differ from the Dashboard's own flight_requests-based stat cards
          above, different source, same name by design. */}

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="leads">Flights</TabsTrigger>
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
                <CardTitle>Flight Status</CardTitle>
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
                      No flight data available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Flight Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium">Total Flights</span>
                    <span className="text-2xl font-bold">{leads.length}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-accent/10">
                    <span className="text-sm font-medium">Active Flights</span>
                    <span className="text-2xl font-bold text-accent">{activeLeadsCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-success/10">
                    <span className="text-sm font-medium">Converted Flights</span>
                    <span className="text-2xl font-bold text-success">
                      {convertedLeads}
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

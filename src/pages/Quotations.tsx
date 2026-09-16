import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  DollarSign,
  Plane,
  Calendar,
  Clock,
} from 'lucide-react';

interface QuoteRow {
  id: string;
  quote_number: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  flight_hours: number | null;
  total_price: number | null;
  status: string | null;
  notes: string | null;
  aircraft: { tail_number: string; aircraft_type: string } | null;
}

export default function Quotations() {
  const { user, supabaseUser } = useAuth();
  const isOps = user?.role === 'operations';
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const channelNameRef = useRef(`quotations-realtime-${Math.random().toString(36).slice(2)}`);

  // Fetch quotes. Admin/Super Admin see everything; Operations only sees
  // quotes tied to flights assigned to them (quotes have no direct
  // assigned_ops column, so this goes through flight_requests.quotation_id).
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes', user?.role, supabaseUser?.id],
    queryFn: async () => {
      let quotationIds: string[] | null = null;
      if (isOps && supabaseUser) {
        const { data: myFlights, error: flightsError } = await supabase
          .from('flight_requests')
          .select('quotation_id')
          .eq('assigned_ops_id', supabaseUser.id)
          .not('quotation_id', 'is', null);
        if (flightsError) throw flightsError;
        quotationIds = (myFlights || []).map((f) => f.quotation_id as string);
        if (quotationIds.length === 0) return [];
      }

      let query = supabase
        .from('quotes')
        .select('*, aircraft(tail_number, aircraft_type)')
        .order('created_at', { ascending: false });
      if (quotationIds) query = query.in('id', quotationIds);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as QuoteRow[];
    },
    enabled: !isOps || !!supabaseUser,
  });

  // Live sync: a quote created/updated elsewhere (e.g. Sales issuing one
  // from the flight workspace) shows up here without a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['quotes'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      sent: 'bg-accent text-accent-foreground',
      accepted: 'bg-success text-success-foreground',
      rejected: 'bg-destructive text-destructive-foreground',
      expired: 'bg-warning text-warning-foreground',
      converted: 'bg-success text-success-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalQuoteValue = quotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const pendingQuotes = quotes.filter(q => q.status === 'sent').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quotations</h1>
            <p className="text-sm md:text-base text-muted-foreground">Create and manage charter quotes</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Quotes</p>
                  <p className="text-2xl font-bold">{quotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <DollarSign className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">${totalQuoteValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <FileText className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold">{acceptedQuotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Clock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingQuotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quotes */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search quotes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground max-w-xs text-right">
              Quotes are generated from the Sourcing Workspace once an option is approved — accept a request, add operator options, then Prepare Quotation.
            </p>
          </div>

          <div className="grid gap-4">
            {quotesLoading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : filteredQuotes.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No quotes found</CardContent></Card>
            ) : (
              filteredQuotes.map(quote => (
                <Card key={quote.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{quote.quote_number}</h3>
                          <p className="text-sm text-muted-foreground">
                            {quote.aircraft
                              ? `${quote.aircraft.tail_number} - ${quote.aircraft.aircraft_type}`
                              : quote.notes || 'Operator option'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="flex items-center gap-1">
                              <Plane className="h-3 w-3" />
                              {quote.route_from} → {quote.route_to}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(quote.departure_date).toLocaleDateString()}
                            </span>
                            {quote.flight_hours && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {quote.flight_hours}h
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getStatusColor(quote.status || 'draft')}>
                          {quote.status}
                        </Badge>
                        <p className="text-xl font-bold text-accent mt-2">
                          ${Number(quote.total_price).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

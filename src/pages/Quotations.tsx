import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useViewQuotationPdf } from '@/hooks/useViewQuotationPdf';
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
  Loader2,
  ChevronDown,
  ChevronUp,
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
  flight_id: string | null;
  aircraft: { tail_number: string; aircraft_type: string } | null;
}

function QuoteCard({
  quote,
  statusLabel,
  statusColor,
  isOpening,
  onClick,
  compact,
}: {
  quote: QuoteRow;
  statusLabel: string;
  statusColor: string;
  isOpening: boolean;
  onClick?: () => void;
  /** An earlier version shown under a flight group - same card, just
   * de-emphasized so the live quote above it stays the focal point. */
  compact?: boolean;
}) {
  return (
    <Card
      className={onClick ? 'hover:shadow-md transition-shadow cursor-pointer' + (compact ? ' opacity-70' : '') : 'opacity-70'}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              {isOpening ? <Loader2 className="h-6 w-6 text-primary animate-spin" /> : <FileText className="h-6 w-6 text-primary" />}
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
            <Badge className={statusColor}>{statusLabel}</Badge>
            <p className="text-xl font-bold text-accent mt-2">
              ${Number(quote.total_price).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Quotations() {
  const { user, supabaseUser } = useAuth();
  const { view: viewQuotationPdf, isLoading: isOpeningPdf } = useViewQuotationPdf();
  const [openingQuoteId, setOpeningQuoteId] = useState<string | null>(null);
  const [expandedFlightIds, setExpandedFlightIds] = useState<Set<string>>(new Set());
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

  // Which quotes are the one their flight currently points to -
  // quote.flight_id now groups a flight's quote history together, but
  // "live vs superseded" within that history still comes from
  // flight_requests.quotation_id, same signal this page always used.
  const { data: finalQuoteIds = new Set<string>() } = useQuery({
    queryKey: ['quote-final-ids', quotes.map((q) => q.id)],
    queryFn: async () => {
      const quoteIds = quotes.map((q) => q.id);
      if (quoteIds.length === 0) return new Set<string>();
      const { data, error } = await supabase
        .from('flight_requests')
        .select('quotation_id')
        .in('quotation_id', quoteIds);
      if (error) throw error;
      return new Set((data || []).map((f) => f.quotation_id as string));
    },
    enabled: quotes.length > 0,
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
      superseded: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  // A flight re-quoted after this one was sent leaves it stuck at status
  // 'sent' forever even though it's no longer the quote anyone's actually
  // waiting on - only the one the flight currently points to should still
  // read "sent". Other statuses (accepted/rejected/expired) stay as-is
  // regardless, since those are still true facts about that quote.
  const displayStatus = (quote: QuoteRow) =>
    quote.status === 'sent' && !finalQuoteIds.has(quote.id) ? 'superseded' : (quote.status || 'draft');

  const filteredQuotes = quotes.filter(quote =>
    quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // A flight re-quoted several times used to show as several disconnected
  // cards scattered through the list - group by flight_id so that history
  // reads together. A quote with no flight_id (couldn't be matched back to
  // one flight when this was backfilled) falls into "Other Quotes" instead
  // of being hidden. `quotes` is already newest-first, so each group's own
  // list - and the groups themselves, by first-seen order - stay newest-first too.
  const { flightGroups, otherQuotes } = useMemo(() => {
    const byFlight = new Map<string, QuoteRow[]>();
    const other: QuoteRow[] = [];
    for (const q of filteredQuotes) {
      if (!q.flight_id) { other.push(q); continue; }
      const list = byFlight.get(q.flight_id);
      if (list) list.push(q); else byFlight.set(q.flight_id, [q]);
    }
    const groups = Array.from(byFlight.entries()).map(([flightId, qs]) => ({ flightId, quotes: qs }));
    return { flightGroups: groups, otherQuotes: other };
  }, [filteredQuotes]);

  // Stats
  // A flight can be re-quoted many times (flight_requests.quotation_id just
  // gets overwritten each time), so most quote rows here are superseded
  // drafts, not live value - Total Value should only count whichever quote
  // is still the one a flight currently points to, one per flight, not
  // every quote ever generated for it.
  // "Issued" - excludes a draft still being built, not yet actually sent to
  // the client, on top of excluding superseded quotes above.
  const totalQuoteValue = quotes
    .filter((q) => finalQuoteIds.has(q.id) && q.status !== 'draft')
    .reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);
  // Same reasoning as Total Value above - an old, superseded quote can be
  // left sitting at status 'sent' or 'accepted' forever once a flight
  // moves on to a newer one, so these only count each flight's current quote too.
  const acceptedQuotes = quotes.filter((q) => finalQuoteIds.has(q.id) && q.status === 'accepted').length;
  const pendingQuotes = quotes.filter((q) => finalQuoteIds.has(q.id) && q.status === 'sent').length;

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
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-primary/10 shrink-0">
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Total Quotes</p>
                  <p className="text-xl md:text-2xl font-bold">{quotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-accent/10 shrink-0">
                  <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Total Value</p>
                  <p className="text-lg md:text-2xl font-bold break-words">${totalQuoteValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-success/10 shrink-0">
                  <FileText className="h-4 w-4 md:h-5 md:w-5 text-success" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Accepted</p>
                  <p className="text-xl md:text-2xl font-bold">{acceptedQuotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3">
                <div className="p-1.5 md:p-2 rounded-lg bg-accent/10 shrink-0">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs md:text-sm text-muted-foreground">Pending</p>
                  <p className="text-xl md:text-2xl font-bold">{pendingQuotes}</p>
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

          <div className="space-y-4">
            {quotesLoading ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
            ) : filteredQuotes.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No quotes found</CardContent></Card>
            ) : (
              <>
                {flightGroups.map(({ flightId, quotes: groupQuotes }) => {
                  const [current, ...older] = groupQuotes;
                  const isExpanded = expandedFlightIds.has(flightId);
                  const openQuote = (quote: QuoteRow) => {
                    if (isOpeningPdf) return;
                    setOpeningQuoteId(quote.id);
                    viewQuotationPdf(quote.id, flightId);
                  };
                  return (
                    <div key={flightId} className="space-y-2">
                      <QuoteCard
                        quote={current}
                        statusLabel={displayStatus(current)}
                        statusColor={getStatusColor(displayStatus(current))}
                        isOpening={isOpeningPdf && openingQuoteId === current.id}
                        onClick={() => openQuote(current)}
                      />
                      {older.length > 0 && (
                        <div className="pl-4">
                          <button
                            type="button"
                            onClick={() => setExpandedFlightIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(flightId)) next.delete(flightId); else next.add(flightId);
                              return next;
                            })}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            {older.length} earlier version{older.length === 1 ? '' : 's'}
                          </button>
                          {isExpanded && (
                            <div className="grid gap-2 mt-2">
                              {older.map((quote) => (
                                <QuoteCard
                                  key={quote.id}
                                  quote={quote}
                                  statusLabel={displayStatus(quote)}
                                  statusColor={getStatusColor(displayStatus(quote))}
                                  isOpening={isOpeningPdf && openingQuoteId === quote.id}
                                  onClick={() => openQuote(quote)}
                                  compact
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {otherQuotes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground pt-2">
                      Other Quotes — couldn't be matched to a single flight
                    </p>
                    <div className="grid gap-4">
                      {otherQuotes.map((quote) => (
                        <QuoteCard
                          key={quote.id}
                          quote={quote}
                          statusLabel={displayStatus(quote)}
                          statusColor={getStatusColor(displayStatus(quote))}
                          isOpening={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { isToday, isWithinInterval, startOfMonth, subDays, subMonths } from 'date-fns';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Target, Wallet, FileText, Percent } from 'lucide-react';
import { formatUSD, LeadRow, resolveListStage } from './leadPipeline';

interface QuoteRow {
  id: string;
  status: string | null;
}

interface LeadsStatsRowProps {
  leads: LeadRow[];
  quotes: QuoteRow[];
  /** Which quotes are the one each flight currently points to - a
   * superseded re-quote shouldn't count toward "pending". */
  finalQuoteIds?: Set<string>;
  /** Real quoted total per lead_id, from flight_requests.pricing_breakdown — takes priority over estimated_value when present. */
  flightValueByLeadId?: Map<string, number>;
  /** lead_id -> the flight's client_confirmed_at, when set - the signal
   * that moves a lead from Open to Active (see resolveListStage). */
  confirmedAtByLeadId?: Map<string, string>;
  isLoading?: boolean;
  /** Open Flights / Pipeline Value cards both mean "the open pipeline" — one handler for both. */
  onFilterOpen?: () => void;
  onFilterRecentClosed?: () => void;
}

export function LeadsStatsRow({ leads, quotes, finalQuoteIds, flightValueByLeadId, confirmedAtByLeadId, isLoading, onFilterOpen, onFilterRecentClosed }: LeadsStatsRowProps) {
  const navigate = useNavigate();
  const stats = useMemo(() => {
    const stageFor = (l: LeadRow) => resolveListStage(l, confirmedAtByLeadId?.get(l.id));
    const openLeads = leads.filter((l) => stageFor(l) === 'open');
    const dueToday = openLeads.filter((l) => l.next_action_date && isToday(new Date(l.next_action_date)));
    // "Pipeline" is everything still in play - Open and Active alike -
    // so a deal's value doesn't vanish from this card the moment the
    // client accepts the quotation and it moves to Active.
    const pipelineLeads = leads.filter((l) => {
      const s = stageFor(l);
      return s === 'open' || s === 'active';
    });

    // Prefer the actual quoted flight total once one exists; a manual
    // forecast is only a stand-in until real pricing is on the table.
    const valueFor = (l: LeadRow) => flightValueByLeadId?.get(l.id) ?? l.estimated_value ?? 0;

    const pipelineValue = pipelineLeads.reduce((sum, l) => sum + valueFor(l), 0);
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const thisMonthValue = pipelineLeads
      .filter((l) => l.created_at && new Date(l.created_at) >= thisMonthStart)
      .reduce((sum, l) => sum + valueFor(l), 0);
    const lastMonthValue = pipelineLeads
      .filter((l) => l.created_at && isWithinInterval(new Date(l.created_at), { start: lastMonthStart, end: thisMonthStart }))
      .reduce((sum, l) => sum + valueFor(l), 0);
    const monthTrend = lastMonthValue > 0 ? Math.round(((thisMonthValue - lastMonthValue) / lastMonthValue) * 100) : null;

    const liveQuotes = finalQuoteIds ? quotes.filter((q) => finalQuoteIds.has(q.id)) : quotes;
    const quotesPending = liveQuotes.filter((q) => q.status === 'draft' || q.status === 'sent').length;
    const quotesAwaitingReply = liveQuotes.filter((q) => q.status === 'sent').length;

    const thirtyDaysAgo = subDays(now, 30);
    const recentClosed = leads.filter(
      (l) => (l.status === 'won' || l.status === 'converted' || l.status === 'lost') &&
        l.updated_at && new Date(l.updated_at) >= thirtyDaysAgo
    );
    const recentWon = recentClosed.filter((l) => l.status === 'won' || l.status === 'converted').length;
    const recentLost = recentClosed.filter((l) => l.status === 'lost').length;
    const conversionRate = recentWon + recentLost > 0 ? Math.round((recentWon / (recentWon + recentLost)) * 100) : 0;

    return { openLeads, dueToday, pipelineValue, monthTrend, quotesPending, quotesAwaitingReply, conversionRate };
  }, [leads, quotes, finalQuoteIds, flightValueByLeadId, confirmedAtByLeadId]);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
      <StatsCard
        title="Open Flights"
        value={stats.openLeads.length}
        subtitle={`${stats.dueToday.length} due today`}
        icon={Target}
        isLoading={isLoading}
        onClick={onFilterOpen}
      />
      <StatsCard
        title="Pipeline Value"
        value={formatUSD(stats.pipelineValue)}
        icon={Wallet}
        trend={stats.monthTrend !== null ? { value: stats.monthTrend, isPositive: stats.monthTrend >= 0, label: 'this month' } : undefined}
        isLoading={isLoading}
        onClick={onFilterOpen}
      />
      <StatsCard
        title="Quotes Pending"
        value={stats.quotesPending}
        subtitle={`${stats.quotesAwaitingReply} awaiting reply`}
        icon={FileText}
        isLoading={isLoading}
        onClick={() => navigate('/quotations')}
      />
      <StatsCard
        title="Conversion Rate"
        value={`${stats.conversionRate}%`}
        subtitle="Last 30 days"
        icon={Percent}
        isLoading={isLoading}
        onClick={onFilterRecentClosed}
      />
    </div>
  );
}

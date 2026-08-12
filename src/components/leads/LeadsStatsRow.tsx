import { useMemo } from 'react';
import { isToday, isWithinInterval, startOfMonth, subDays, subMonths } from 'date-fns';
import { StatsCard } from '@/components/dashboard/StatsCard';
import { Target, Wallet, FileText, Percent } from 'lucide-react';
import { formatSAR, LeadRow } from './leadPipeline';

interface QuoteRow {
  status: string | null;
}

interface LeadsStatsRowProps {
  leads: LeadRow[];
  quotes: QuoteRow[];
  isLoading?: boolean;
}

const OPEN_STATUSES = ['new', 'qualified', 'pricing', 'quoted', 'negotiation'];

export function LeadsStatsRow({ leads, quotes, isLoading }: LeadsStatsRowProps) {
  const stats = useMemo(() => {
    const openLeads = leads.filter((l) => OPEN_STATUSES.includes(l.status || 'new'));
    const dueToday = openLeads.filter((l) => l.next_action_date && isToday(new Date(l.next_action_date)));

    const pipelineValue = openLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const now = new Date();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const thisMonthValue = openLeads
      .filter((l) => l.created_at && new Date(l.created_at) >= thisMonthStart)
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const lastMonthValue = openLeads
      .filter((l) => l.created_at && isWithinInterval(new Date(l.created_at), { start: lastMonthStart, end: thisMonthStart }))
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    const monthTrend = lastMonthValue > 0 ? Math.round(((thisMonthValue - lastMonthValue) / lastMonthValue) * 100) : null;

    const quotesPending = quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length;
    const quotesAwaitingReply = quotes.filter((q) => q.status === 'sent').length;

    const thirtyDaysAgo = subDays(now, 30);
    const recentClosed = leads.filter(
      (l) => (l.status === 'won' || l.status === 'converted' || l.status === 'lost') &&
        l.updated_at && new Date(l.updated_at) >= thirtyDaysAgo
    );
    const recentWon = recentClosed.filter((l) => l.status === 'won' || l.status === 'converted').length;
    const recentLost = recentClosed.filter((l) => l.status === 'lost').length;
    const conversionRate = recentWon + recentLost > 0 ? Math.round((recentWon / (recentWon + recentLost)) * 100) : 0;

    return { openLeads, dueToday, pipelineValue, monthTrend, quotesPending, quotesAwaitingReply, conversionRate };
  }, [leads, quotes]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Open Leads"
        value={stats.openLeads.length}
        subtitle={`${stats.dueToday.length} due today`}
        icon={Target}
        isLoading={isLoading}
      />
      <StatsCard
        title="Pipeline Value"
        value={formatSAR(stats.pipelineValue)}
        icon={Wallet}
        trend={stats.monthTrend !== null ? { value: stats.monthTrend, isPositive: stats.monthTrend >= 0, label: 'this month' } : undefined}
        isLoading={isLoading}
      />
      <StatsCard
        title="Quotes Pending"
        value={stats.quotesPending}
        subtitle={`${stats.quotesAwaitingReply} awaiting reply`}
        icon={FileText}
        isLoading={isLoading}
      />
      <StatsCard
        title="Conversion Rate"
        value={`${stats.conversionRate}%`}
        subtitle="Last 30 days"
        icon={Percent}
        isLoading={isLoading}
      />
    </div>
  );
}

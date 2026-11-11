import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isPast, isToday, isWithinInterval, addDays, subDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { LeadsStatsRow } from '@/components/leads/LeadsStatsRow';
import { LeadsFilterBar, DEFAULT_LEAD_FILTERS, LeadFilters } from '@/components/leads/LeadsFilterBar';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { getLeadDisplayName, LeadRow, resolveListStage, STAGE_FILTER_ACTIVE, STAGE_FILTER_OPEN, STAGE_FILTER_RECENT_CLOSED } from '@/components/leads/leadPipeline';

export default function Leads() {
  const { user, effectiveRole } = useAuth();
  // Operations never sees client identity - this page also lists leads/
  // flights no Sales-only filter was keeping them out of, so the same rule
  // applies here as everywhere else Ops can see a flight.
  const isOps = effectiveRole === 'operations' || effectiveRole === 'senior_operations';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);
  const channelNameRef = useRef(`leads-realtime-${Math.random().toString(36).slice(2)}`);

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      // Converted leads used to be excluded entirely — now that signing the
      // Client Contract auto-converts a lead, that made it vanish from the
      // board at the exact moment Sales would most want to see it land in
      // Won. They're included now and bucket into the Won column.
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes-pending'],
    queryFn: async () => {
      const { data, error } = await supabase.from('quotes').select('id, status');
      if (error) throw error;
      return data;
    },
  });

  // A flight re-quoted after this one was sent leaves it stuck at status
  // 'sent' forever even though it's no longer live - "Quotes Pending"
  // should only count whichever quote each flight currently points to,
  // same fix already applied on the Quotations page.
  const { data: finalQuoteIds = new Set<string>() } = useQuery({
    queryKey: ['final-quote-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_requests').select('quotation_id').not('quotation_id', 'is', null);
      if (error) throw error;
      return new Set((data || []).map((f) => f.quotation_id as string));
    },
  });

  // Pipeline Value should reflect what's actually been quoted, not just
  // Sales's manual forecast — pull each lead's real flight total(s) where
  // a quotation already exists, falling back to estimated_value otherwise.
  // Same query also surfaces client_confirmed_at per lead — the signal
  // that drives the Active stage (see resolveListStage) — so this stays
  // one round trip instead of two.
  const { data: leadFlightData } = useQuery({
    queryKey: ['lead-flight-values'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('lead_id, pricing_breakdown, client_confirmed_at')
        .not('lead_id', 'is', null);
      if (error) throw error;
      const valueByLeadId = new Map<string, number>();
      const confirmedAtByLeadId = new Map<string, string>();
      for (const row of data || []) {
        if (!row.lead_id) continue;
        const total = (row.pricing_breakdown as { final_total?: number } | null)?.final_total;
        if (typeof total === 'number') {
          valueByLeadId.set(row.lead_id, (valueByLeadId.get(row.lead_id) || 0) + total);
        }
        if (row.client_confirmed_at) {
          confirmedAtByLeadId.set(row.lead_id, row.client_confirmed_at);
        }
      }
      return { valueByLeadId, confirmedAtByLeadId };
    },
  });
  const flightValueByLeadId = leadFlightData?.valueByLeadId ?? new Map<string, number>();
  const confirmedAtByLeadId = leadFlightData?.confirmedAtByLeadId ?? new Map<string, string>();

  // Live sync: any lead/flight/quote change from another user's session
  // shows up here without needing a manual refresh.
  useEffect(() => {
    const channel = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flight_requests' }, () => {
        queryClient.invalidateQueries({ queryKey: ['lead-flight-values'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        queryClient.invalidateQueries({ queryKey: ['quotes-pending'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>();
    owners.forEach((o) => map.set(o.user_id, o.full_name || o.email || 'Unassigned'));
    return map;
  }, [owners]);

  const serviceOptions = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.service_type).filter((s): s is string => !!s))).sort();
  }, [leads]);

  const lostCount = useMemo(() => leads.filter((l) => l.status === 'lost').length, [leads]);
  const wonCount = useMemo(() => leads.filter((l) => l.status === 'won' || l.status === 'converted').length, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (!filters.includeLost && lead.status === 'lost') return false;
      if (!filters.includeWon && (lead.status === 'won' || lead.status === 'converted')) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          getLeadDisplayName(lead).toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.service_type?.toLowerCase().includes(term);
        if (!matches) return false;
      }

      if (filters.service !== 'all' && lead.service_type !== filters.service) return false;
      if (filters.stage === STAGE_FILTER_OPEN) {
        if (resolveListStage(lead, confirmedAtByLeadId.get(lead.id)) !== 'open') return false;
      } else if (filters.stage === STAGE_FILTER_ACTIVE) {
        if (resolveListStage(lead, confirmedAtByLeadId.get(lead.id)) !== 'active') return false;
      } else if (filters.stage === STAGE_FILTER_RECENT_CLOSED) {
        const isClosed = lead.status === 'won' || lead.status === 'converted' || lead.status === 'lost';
        const isRecent = !!lead.updated_at && new Date(lead.updated_at) >= subDays(new Date(), 30);
        if (!isClosed || !isRecent) return false;
      } else if (filters.stage === 'won') {
        // A lead that's already converted to a client still shows the same
        // "Won" badge as a plain won lead (see STAGE_BADGE in
        // LeadsTable.tsx) - the filter has to match both or a converted
        // lead silently vanishes from its own "Won" filter.
        if (lead.status !== 'won' && lead.status !== 'converted') return false;
      } else if (filters.stage !== 'all' && lead.status !== filters.stage) {
        return false;
      }
      if (filters.owner !== 'all' && lead.assigned_to !== filters.owner) return false;
      if (filters.priority !== 'all' && (lead.priority || 'medium') !== filters.priority) return false;

      if (filters.date !== 'all') {
        const dateStr = lead.next_action_date;
        if (filters.date === 'none') {
          if (dateStr) return false;
        } else if (!dateStr) {
          return false;
        } else {
          const date = new Date(dateStr);
          if (filters.date === 'overdue' && !(isPast(date) && !isToday(date))) return false;
          if (filters.date === 'today' && !isToday(date)) return false;
          if (filters.date === 'week' && !isWithinInterval(date, { start: new Date(), end: addDays(new Date(), 7) })) return false;
        }
      }

      return true;
    });
  }, [leads, searchTerm, filters, confirmedAtByLeadId]);

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Flights</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Commercial pipeline across all PFS service lines
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="h-9 w-9 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold">{initials}</span>
            </div>
            <Button onClick={() => navigate('/leads/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Flight
            </Button>
          </div>
        </div>

        <LeadsStatsRow
          leads={leads}
          quotes={quotes}
          finalQuoteIds={finalQuoteIds}
          flightValueByLeadId={flightValueByLeadId}
          confirmedAtByLeadId={confirmedAtByLeadId}
          isLoading={leadsLoading}
          onFilterOpen={() => setFilters((f) => ({ ...f, stage: STAGE_FILTER_OPEN }))}
          onFilterRecentClosed={() => setFilters((f) => ({ ...f, stage: STAGE_FILTER_RECENT_CLOSED, includeLost: true, includeWon: true }))}
        />

        <LeadsFilterBar
          filters={filters}
          onChange={setFilters}
          serviceOptions={serviceOptions}
          owners={owners}
          lostCount={lostCount}
          wonCount={wonCount}
        />

        <LeadsTable
          leads={filteredLeads}
          ownerNameById={ownerNameById}
          onRowClick={(lead) => navigate(`/leads/${lead.id}`)}
          isOps={isOps}
          confirmedAtByLeadId={confirmedAtByLeadId}
        />
      </div>
    </DashboardLayout>
  );
}

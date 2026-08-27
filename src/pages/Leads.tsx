import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { isPast, isToday, isWithinInterval, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { LeadsStatsRow } from '@/components/leads/LeadsStatsRow';
import { LeadsFilterBar, DEFAULT_LEAD_FILTERS, LeadFilters } from '@/components/leads/LeadsFilterBar';
import { LeadsPipelineBoard } from '@/components/leads/LeadsPipelineBoard';
import { getLeadDisplayName, LeadRow } from '@/components/leads/leadPipeline';

export default function Leads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_LEAD_FILTERS);

  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .is('converted_to_client_id', null)
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
      const { data, error } = await supabase.from('quotes').select('status');
      if (error) throw error;
      return data;
    },
  });

  const ownerNameById = useMemo(() => {
    const map = new Map<string, string>();
    owners.forEach((o) => map.set(o.user_id, o.full_name || o.email || 'Unassigned'));
    return map;
  }, [owners]);

  const serviceOptions = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.service_type).filter((s): s is string => !!s))).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matches =
          getLeadDisplayName(lead).toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.service_type?.toLowerCase().includes(term);
        if (!matches) return false;
      }

      if (filters.service !== 'all' && lead.service_type !== filters.service) return false;
      if (filters.stage !== 'all' && lead.status !== filters.stage) return false;
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
  }, [leads, searchTerm, filters]);

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

        <LeadsStatsRow leads={leads} quotes={quotes} isLoading={leadsLoading} />

        <LeadsFilterBar
          filters={filters}
          onChange={setFilters}
          serviceOptions={serviceOptions}
          owners={owners}
        />

        <LeadsPipelineBoard
          leads={filteredLeads}
          ownerNameById={ownerNameById}
          onCardClick={(lead) => navigate(`/leads/${lead.id}`)}
        />
      </div>
    </DashboardLayout>
  );
}

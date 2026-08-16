import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Pencil,
  Trophy,
  XCircle,
  UserCheck,
  Users,
  Wallet,
  Percent,
  Calendar,
  CheckCircle2,
  MessageSquare,
  FileText,
  Plane,
  ArrowRightLeft,
  Package,
} from 'lucide-react';
import { OpsSlaCountdown } from '@/components/leads/OpsSlaCountdown';
import { LeadActivityFeed, logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { FlightDocuments } from '@/components/flights/FlightDocuments';
import {
  formatSAR,
  getLeadDisplayName,
  resolveLeadStatusBadge,
  resolveSlaMinutes,
  LeadRow,
  SlaSetting,
} from '@/components/leads/leadPipeline';

interface FlightRequestRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  special_requests: string | null;
  status_sales: string;
  flight_type: string | null;
  flexibility_hours: number | null;
  preferred_aircraft_category: string | null;
  ops_accepted_at: string | null;
  submitted_to_ops_at: string | null;
  sla_satisfied_at: string | null;
  quotation_id: string | null;
  created_by: string;
  assigned_ops_id: string | null;
  created_at: string;
}

interface QuoteRow {
  id: string;
  quote_number: string;
  status: string | null;
  total_price: number | null;
  currency: string | null;
  valid_until: string | null;
  created_at: string | null;
}

const FLIGHT_TYPE_LABELS: Record<string, string> = {
  one_way: 'One Way',
  round_trip: 'Round Trip',
  multi_leg: 'Multi-Leg',
};

function TripRequirementPanel({ flight, lead }: { flight: FlightRequestRow | null; lead: LeadRow }) {
  if (!flight) {
    return (
      <div className="rounded-lg border p-4">
        <h3 className="font-semibold mb-2">Trip Requirement</h3>
        <p className="text-sm text-muted-foreground">
          No flight request yet for this lead — details will appear here once one is created.
        </p>
      </div>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Origin', value: flight.route_from },
    { label: 'Destination', value: flight.route_to },
    { label: 'Trip Type', value: FLIGHT_TYPE_LABELS[flight.flight_type || 'one_way'] || 'One Way' },
    { label: 'Departure', value: `${format(new Date(flight.departure_date), 'MMM d, yyyy')} • ${flight.departure_time}` },
    flight.cargo_weight_kg != null
      ? { label: 'Cargo Weight', value: `${flight.cargo_weight_kg} kg` }
      : { label: 'Passengers', value: String(flight.passengers) },
    { label: 'Aircraft', value: flight.preferred_aircraft_category || 'Not specified' },
    { label: 'Flexibility', value: flight.flexibility_hours ? `± ${flight.flexibility_hours} hours` : 'None' },
    { label: 'Special Requests', value: flight.special_requests || 'None' },
  ];

  return (
    <div className="rounded-lg border p-4">
      <h3 className="font-semibold mb-3">Trip Requirement</h3>
      <div className="space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: lead, isLoading: leadLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data as LeadRow;
    },
    enabled: !!id,
  });

  const { data: flightRequests = [] } = useQuery({
    queryKey: ['lead-flight-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FlightRequestRow[];
    },
    enabled: !!id,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const latestFlight = flightRequests[0] || null;
  const quotationIds = useMemo(
    () => flightRequests.map((f) => f.quotation_id).filter((v): v is string => !!v),
    [flightRequests]
  );

  const { data: quotes = [] } = useQuery({
    queryKey: ['lead-quotes', id, quotationIds.join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .in('id', quotationIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as QuoteRow[];
    },
    enabled: quotationIds.length > 0,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['lead-team-chat-unread', id, user?.id],
    queryFn: async () => {
      if (!id || !user) return 0;
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('lead_id', id)
        .neq('sender_id', user.id);
      const ids = (msgs || []).map((m) => m.id);
      if (ids.length === 0) return 0;
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', ids);
      const readIds = new Set((reads || []).map((r) => r.message_id));
      return ids.filter((mid) => !readIds.has(mid)).length;
    },
    enabled: !!id && !!user,
  });

  const { data: memberCount = 0 } = useQuery({
    queryKey: ['lead-team-members-count', id],
    queryFn: async () => {
      const { count } = await supabase
        .from('lead_team_members')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', id);
      return count || 0;
    },
    enabled: !!id,
  });

  const { data: slaSettings = [] } = useQuery({
    queryKey: ['sla-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sla_settings').select('service_type, stage, duration_minutes');
      if (error) throw error;
      return data as SlaSetting[];
    },
  });

  const ownerName = lead?.assigned_to
    ? owners.find((o) => o.user_id === lead.assigned_to)?.full_name ||
      owners.find((o) => o.user_id === lead.assigned_to)?.email
    : undefined;

  const setStatus = useMutation({
    mutationFn: async (status: 'won' | 'lost') => {
      if (!lead) return;
      const { error } = await supabase.from('leads').update({ status }).eq('id', lead.id);
      if (error) throw error;
      await logLeadActivity(lead.id, status, status === 'won' ? 'Lead marked as Won' : 'Lead marked as Lost', supabaseUser?.id, user?.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', id] });
      toast.success('Lead updated');
    },
    onError: (error: Error) => toast.error('Failed to update lead: ' + error.message),
  });

  const markDone = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase
        .from('leads')
        .update({ next_action_date: null, next_action_time: null, next_action_note: null })
        .eq('id', lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Next action cleared');
    },
    onError: (error: Error) => toast.error('Failed to update: ' + error.message),
  });

  const convertToClient = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { error } = await supabase.rpc('convert_lead_to_client', { p_lead_id: lead.id });
      if (error) throw error;
      await logLeadActivity(lead.id, 'converted', 'Lead converted to client', supabaseUser?.id, user?.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', id] });
      toast.success('Lead converted to client');
    },
    onError: (error: Error) => toast.error('Failed to convert lead: ' + error.message),
  });

  if (leadLoading) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Lead not found.</p>
        <Button variant="link" onClick={() => navigate('/leads')}>Back to Leads</Button>
      </DashboardLayout>
    );
  }

  const isClosed = lead.status === 'won' || lead.status === 'lost' || !!lead.converted_to_client_id;
  const badge = resolveLeadStatusBadge(lead, flightRequests, quotes);
  const subtitle = latestFlight
    ? `${lead.service_type || 'Charter'} • ${latestFlight.route_from} → ${latestFlight.route_to}`
    : lead.service_type || lead.deal_summary || 'New inquiry';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Leads
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-muted-foreground">{lead.reference_number}</span>
                <Badge className={badge.colorClass}>{badge.label}</Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight mt-1">{getLeadDisplayName(lead)}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <Button onClick={() => navigate(`/leads/${lead.id}/edit`)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Lead
            </Button>
          </div>

          {!isClosed && (
            <div className="flex items-center gap-2 mt-3">
              <Button variant="outline" size="sm" className="gap-2 text-success hover:text-success" onClick={() => setStatus.mutate('won')} disabled={setStatus.isPending}>
                <Trophy className="h-4 w-4" />
                Mark as Won
              </Button>
              <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive" onClick={() => setStatus.mutate('lost')} disabled={setStatus.isPending}>
                <XCircle className="h-4 w-4" />
                Mark as Lost
              </Button>
              {flightRequests.length > 0 && !lead.converted_to_client_id && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => convertToClient.mutate()} disabled={convertToClient.isPending}>
                  <UserCheck className="h-4 w-4" />
                  Convert to Client
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="rounded-lg border p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Departure</p>
            <p className="font-semibold">
              {latestFlight ? `${format(new Date(latestFlight.departure_date), 'MMM d')} • ${latestFlight.departure_time}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Passengers</p>
            <p className="font-semibold">{latestFlight?.passengers ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Owner</p>
            <p className="font-semibold">{ownerName || 'Unassigned'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Est. Revenue</p>
            <p className="font-semibold">{formatSAR(lead.estimated_value)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground flex items-center gap-1"><Percent className="h-3 w-3" />Probability</p>
            <p className="font-semibold">{lead.probability != null ? `${lead.probability}%` : '—'}</p>
          </div>
          <OpsSlaCountdown
            submittedToOpsAt={latestFlight?.submitted_to_ops_at}
            slaSatisfiedAt={latestFlight?.sla_satisfied_at}
            durationMinutes={resolveSlaMinutes(slaSettings, lead.service_type, lead.status)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/leads/${id}/handoff`)}>
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
            View Sales ↔ Ops Handoff
          </Button>
          {latestFlight && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => navigate(`/flights/${latestFlight.id}`)}>
              <Package className="h-3.5 w-3.5 mr-1" />
              Review Operations Options
            </Button>
          )}
        </div>

        {/* Next Action row */}
        <div className="rounded-lg border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{lead.next_action_note || 'No next action set'}</p>
              {lead.next_action_date && (
                <Badge variant="secondary" className="mt-1">
                  {format(new Date(lead.next_action_date), 'MMM d')}
                  {lead.next_action_time && ` • ${lead.next_action_time}`}
                </Badge>
              )}
            </div>
          </div>
          {lead.next_action_date && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => markDone.mutate()} disabled={markDone.isPending}>
              <CheckCircle2 className="h-4 w-4" />
              Mark Done
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requirement">Requirement</TabsTrigger>
              <TabsTrigger value="quotations">Quotations</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>
            <button
              onClick={() => navigate(`/leads/${id}/chat`)}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border hover:bg-secondary/50 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Team Chat
              {unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{unreadCount} unread</Badge>}
              <span className="text-muted-foreground">{memberCount} members</span>
            </button>
          </div>

          <TabsContent value="overview" className="grid md:grid-cols-2 gap-4 mt-4">
            <TripRequirementPanel flight={latestFlight} lead={lead} />
            <LeadActivityFeed leadId={lead.id} leadName={getLeadDisplayName(lead)} />
          </TabsContent>

          <TabsContent value="requirement" className="mt-4">
            <TripRequirementPanel flight={latestFlight} lead={lead} />
          </TabsContent>

          <TabsContent value="quotations" className="mt-4">
            {quotes.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground rounded-lg border">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No quotations yet
              </div>
            ) : (
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{quote.quote_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {quote.created_at && format(new Date(quote.created_at), 'MMM d, yyyy')}
                        {quote.valid_until && ` • Valid until ${format(new Date(quote.valid_until), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatSAR(quote.total_price)}</span>
                      <Badge variant="secondary" className="capitalize">{quote.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {latestFlight ? (
              <FlightDocuments flightId={latestFlight.id} />
            ) : (
              <div className="p-8 text-center text-muted-foreground rounded-lg border">
                <Plane className="h-8 w-8 mx-auto mb-2 opacity-50" />
                No flight request yet — documents become available once one is created for this lead.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

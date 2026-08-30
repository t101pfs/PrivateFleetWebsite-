import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsSlaCountdown } from '@/components/leads/OpsSlaCountdown';
import {
  formatSAR,
  getLeadDisplayName,
  PIPELINE_STAGES,
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
  preferred_aircraft_category: string | null;
  status_ops: string;
  options_status: string | null;
  quotation_id: string | null;
  assigned_ops_name: string | null;
  submitted_to_ops_at: string | null;
  ops_accepted_at: string | null;
  sla_satisfied_at: string | null;
}

function deriveCurrentStage(flight: FlightRequestRow | null, optionsCount: number): string {
  if (!flight || !flight.submitted_to_ops_at) return 'Not Submitted';
  if (flight.quotation_id || flight.options_status === 'quotation_issued') return 'Quotation Issued';
  if (flight.options_status === 'options_selected') return 'Options Selected';
  if (optionsCount > 0 || flight.options_status === 'options_prepared') return 'Options Ready';
  if (flight.ops_accepted_at) return 'Operations Sourcing';
  return 'Awaiting Ops Acceptance';
}

function deriveNextSalesAction(stage: string): string {
  switch (stage) {
    case 'Not Submitted': return 'Submit request to Operations';
    case 'Awaiting Ops Acceptance': return 'Wait for Operations to accept';
    case 'Operations Sourcing': return 'Wait for Operations options';
    case 'Options Ready': return 'Review & select options';
    case 'Options Selected': return 'Prepare client quotation';
    case 'Quotation Issued': return 'Send quotation to client';
    default: return '—';
  }
}

function StepDot({ done, current }: { done: boolean; current?: boolean }) {
  if (done) return <div className="h-2.5 w-2.5 rounded-full bg-success shrink-0" />;
  if (current) return <div className="h-2.5 w-2.5 rounded-full bg-warning shrink-0" />;
  return <div className="h-2.5 w-2.5 rounded-full bg-muted border shrink-0" />;
}

export default function LeadHandoff() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();

  const { data: lead } = useQuery({
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
  const flight = flightRequests[0] || null;

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: optionsCount = 0 } = useQuery({
    queryKey: ['flight-options-count', flight?.id],
    queryFn: async () => {
      if (!flight) return 0;
      const { count } = await supabase
        .from('flight_options')
        .select('id', { count: 'exact', head: true })
        .eq('flight_id', flight.id)
        .eq('is_draft', false);
      return count || 0;
    },
    enabled: !!flight,
  });

  const { data: slaSettings = [] } = useQuery({
    queryKey: ['sla-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sla_settings').select('service_type, stage, duration_minutes');
      if (error) throw error;
      return data as SlaSetting[];
    },
  });

  if (!lead) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Loading...</p>
      </DashboardLayout>
    );
  }

  const stageLabel = PIPELINE_STAGES.find((s) => s.value === lead.status)?.label || 'New';
  const ownerName = owners.find((o) => o.user_id === lead.assigned_to)?.full_name || 'Unassigned';
  const currentStage = deriveCurrentStage(flight, optionsCount);
  const nextAction = deriveNextSalesAction(currentStage);
  const durationMinutes = resolveSlaMinutes(slaSettings, lead.service_type, lead.status);

  const steps: Array<{ label: string; time: string | null | undefined; done: boolean; current?: boolean }> = [
    { label: 'Submitted', time: flight?.submitted_to_ops_at, done: !!flight?.submitted_to_ops_at },
    { label: 'Ops Notified', time: flight?.submitted_to_ops_at, done: !!flight?.submitted_to_ops_at },
    { label: flight?.assigned_ops_name ? `Accepted by ${flight.assigned_ops_name}` : 'Accepted', time: flight?.ops_accepted_at, done: !!flight?.ops_accepted_at },
    { label: currentStage, time: null, done: false, current: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate(`/leads/${id}`)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="uppercase">{effectiveRole === 'operations' ? 'Ops' : 'Sales'}</Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Handoff to Operations</h1>
          <p className="text-sm text-muted-foreground">Sales owns the client request; Operations owns aircraft sourcing under the Operations Timeline</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-sm text-muted-foreground">{lead.reference_number}</span>
            <Badge className="bg-success text-success-foreground uppercase">{stageLabel}</Badge>
            <Badge variant="secondary">{lead.service_type || 'N/A'}</Badge>
          </div>
        </div>

        {/* Timeline card */}
        <div className="rounded-lg border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{flight ? `${flight.route_from} → ${flight.route_to}` : getLeadDisplayName(lead)}</h2>
            <p className="text-sm text-muted-foreground">
              {flight
                ? `${format(new Date(flight.departure_date), 'MMM d, yyyy')} • ${flight.departure_time} • ${
                    flight.cargo_weight_kg != null ? `${flight.cargo_weight_kg} kg` : `${flight.passengers} passengers`
                  }${flight.preferred_aircraft_category ? ` • ${flight.preferred_aircraft_category}` : ''}`
                : 'No flight request yet'}
            </p>

            <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="text-center min-w-[90px]">
                    <div className="flex items-center gap-1.5 justify-center">
                      <StepDot done={step.done} current={step.current} />
                      <span className="text-xs font-medium whitespace-nowrap">{step.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {step.time ? format(new Date(step.time), 'HH:mm') : i === steps.length - 1 ? 'Now' : '—'}
                    </p>
                  </div>
                  {i < steps.length - 1 && <div className="h-px w-6 bg-border shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 min-w-[220px]">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wide mb-1">Operation Timeline</p>
            <OpsSlaCountdown
              submittedToOpsAt={flight?.submitted_to_ops_at}
              slaSatisfiedAt={flight?.sla_satisfied_at}
              durationMinutes={durationMinutes}
              hideLabel
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Sales View */}
          <div className="rounded-lg border p-4">
            <h3 className="font-semibold">Sales View</h3>
            <p className="text-xs text-muted-foreground mb-3">Visible but read-only Operations progress</p>
            <div className="space-y-2.5">
              {[
                ['Client', lead.company_name || '—'],
                ['Contact', lead.contact_name || '—'],
                ['Requirement', flight ? `${flight.route_from} → ${flight.route_to} • ${flight.cargo_weight_kg != null ? `${flight.cargo_weight_kg} kg` : `${flight.passengers} pax`}` : lead.deal_summary || '—'],
                ['Lead Owner', ownerName],
                ['Operations Owner', flight?.assigned_ops_name || 'Unassigned'],
                ['Current Stage', currentStage],
                ['Options Received', String(optionsCount)],
                ['Next Sales Action', nextAction],
                ['Est. Revenue', formatSAR(lead.estimated_value)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Sales Permissions */}
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-3">Sales Permissions</h3>
              <div className="space-y-2 text-sm">
                {[
                  ['Create / qualify request', true],
                  ['Submit to Operations', true],
                  ['View Operations progress', true],
                  ['Review & select options', true],
                  ['Edit supplier pricing', false],
                  ['Accept Operations request', false],
                ].map(([label, allowed]) => (
                  <div key={label as string} className="flex items-center gap-2">
                    {allowed ? (
                      <Check className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeDasharray="2 2" />
                    )}
                    <span className={cn(!allowed && 'text-muted-foreground')}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations Timeline Behavior */}
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold mb-3">Operations Timeline Behavior</h3>
              <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                <li>Timer starts when Sales submits to Operations.</li>
                <li>Acceptance does not pause or reset the timer.</li>
                <li>First valid (published) option satisfies the initial Operations Timeline.</li>
                <li>All timer events are stored in the audit log.</li>
                <li>Operations Timeline duration is configurable by service and stage.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

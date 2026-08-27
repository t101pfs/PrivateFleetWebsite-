import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightRequests } from '@/hooks/useFlightRequests';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { RotateCcw, Route, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ClientOption,
  getServiceFieldConfig,
  PRIORITIES,
  SERVICE_TYPES,
} from '@/components/leads/leadPipeline';
import { logLeadActivity } from '@/components/leads/LeadActivityFeed';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { addLeadTeamMember } from '@/components/leads/leadTeamChat';
import { AirportAutocomplete } from '@/components/flights/AirportAutocomplete';
import type { Json } from '@/integrations/supabase/types';

const SOURCES = ['Website', 'Referral', 'Phone Call', 'Email', 'Social Media', 'WhatsApp', 'Event', 'Other'];

interface LeadFormLeg {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
}

interface FlightRequestRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  special_requests: string | null;
  flight_type: string | null;
  preferred_aircraft_category: string | null;
  flight_legs: LeadFormLeg[] | null;
}

function deriveFlightType(legs: LeadFormLeg[]): 'one_way' | 'round_trip' | 'multi_leg' {
  if (legs.length === 2) {
    const isRoundTrip = legs[1].route_from === legs[0].route_to && legs[1].route_to === legs[0].route_from;
    return isRoundTrip ? 'round_trip' : 'multi_leg';
  }
  if (legs.length > 2) return 'multi_leg';
  return 'one_way';
}

function newLeg(overrides: Partial<LeadFormLeg> = {}): LeadFormLeg {
  return {
    id: crypto.randomUUID(),
    route_from: '',
    route_to: '',
    departure_date: '',
    departure_time: '',
    passengers: 1,
    ...overrides,
  };
}

export default function LeadForm() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const { createFlight } = useFlightRequests();

  // Client & Contact
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [derivedLeadType, setDerivedLeadType] = useState<string | null>(null);

  // Request
  const [serviceType, setServiceType] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [primaryDescriptorChoice, setPrimaryDescriptorChoice] = useState('');
  const [customPrimaryDescriptor, setCustomPrimaryDescriptor] = useState('');
  const [source, setSource] = useState('');

  // Dynamic route fields
  const [legs, setLegs] = useState<LeadFormLeg[]>([newLeg()]);
  const [cargoWeight, setCargoWeight] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [existingFlightId, setExistingFlightId] = useState<string | null>(null);

  // Dynamic custom fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  // Commercial Ownership
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState('medium');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('');
  const [nextActionNote, setNextActionNote] = useState('');
  const [notes, setNotes] = useState('');

  const resolvedServiceType = serviceType === 'Other' ? customServiceType : serviceType;
  const config = getServiceFieldConfig(resolvedServiceType);
  const primaryDescriptor = primaryDescriptorChoice === 'Other' ? customPrimaryDescriptor : primaryDescriptorChoice;

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-lead-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, client_type, company_website, mobile_number, email, address, department_name, title, first_name, middle_name, last_name, pa_name, pa_contact')
        .order('company_name');
      if (error) throw error;
      return data as ClientOption[];
    },
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: lead } = useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: isEdit,
  });

  const { data: leadFlightRequests = [] } = useQuery({
    queryKey: ['lead-flight-requests', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('lead_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as FlightRequestRow[];
    },
    enabled: isEdit,
  });

  const matchingClients = useMemo(() => {
    if (!companyName || selectedClientId || companyName.length < 2) return [];
    const term = companyName.toLowerCase();
    return clients.filter((c) => c.company_name?.toLowerCase().includes(term)).slice(0, 6);
  }, [clients, companyName, selectedClientId]);

  const handleSelectClient = (client: ClientOption) => {
    setSelectedClientId(client.id);
    setCompanyName(client.company_name || '');
    setContactName(client.contact_name || [client.first_name, client.last_name].filter(Boolean).join(' ') || '');
    setMobileNumber(client.mobile_number || '');
    setEmail(client.email || '');
    setDerivedLeadType(client.client_type || null);
  };

  const handleServiceChange = (value: string) => {
    setServiceType(value);
    if (value !== 'Other') setCustomServiceType('');
    // Reset dynamic fields when switching services so stale values don't leak through
    setPrimaryDescriptorChoice('');
    setCustomPrimaryDescriptor('');
    setLegs([newLeg()]);
    setCargoWeight('');
    setSpecialRequests('');
    setCustomFieldValues({});
  };

  const updateLeg = (index: number, field: keyof LeadFormLeg, value: string | number) => {
    setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, [field]: value } : leg)));
  };

  const addReturnLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs((prev) => [...prev, newLeg({ route_from: lastLeg.route_to, route_to: lastLeg.route_from, departure_date: lastLeg.departure_date, passengers: lastLeg.passengers })]);
  };

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs((prev) => [...prev, newLeg({ route_from: lastLeg.route_to, departure_date: lastLeg.departure_date, passengers: lastLeg.passengers })]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) setLegs((prev) => prev.filter((_, i) => i !== index));
  };

  // Prefill on edit
  useEffect(() => {
    if (!isEdit || !lead) return;
    setCompanyName(lead.company_name || '');
    setContactName(lead.contact_name || '');
    setMobileNumber(lead.mobile_number || '');
    setEmail(lead.email || '');
    setSelectedClientId(lead.client_id || '');
    setDerivedLeadType(lead.lead_type || null);

    const known = SERVICE_TYPES.find((s) => s === lead.service_type);
    setServiceType(known || (lead.service_type ? 'Other' : ''));
    setCustomServiceType(known ? '' : lead.service_type || '');

    setSource(lead.source || '');
    setOwnerId(lead.assigned_to || user?.id || '');
    setPriority(lead.priority || 'medium');
    setNextActionDate(lead.next_action_date || '');
    setNextActionTime(lead.next_action_time || '');
    setNextActionNote(lead.next_action_note || '');
    setNotes(lead.description || '');

    const flight = leadFlightRequests[0];
    if (flight) {
      setExistingFlightId(flight.id);
      if (flight.flight_legs && flight.flight_legs.length > 0) {
        setLegs(flight.flight_legs.map((leg) => newLeg({ ...leg, id: crypto.randomUUID() })));
      } else {
        setLegs([newLeg({
          route_from: flight.route_from,
          route_to: flight.route_to,
          departure_date: flight.departure_date,
          departure_time: flight.departure_time,
          passengers: flight.passengers ?? 1,
        })]);
      }
      setCargoWeight(flight.cargo_weight_kg != null ? String(flight.cargo_weight_kg) : '');
      setSpecialRequests(flight.special_requests || '');
      const svcConfig = getServiceFieldConfig(known || lead.service_type);
      const knownDescriptor = svcConfig.primaryDescriptorOptions.find((o) => o === flight.preferred_aircraft_category);
      setPrimaryDescriptorChoice(knownDescriptor || (flight.preferred_aircraft_category ? 'Other' : ''));
      setCustomPrimaryDescriptor(knownDescriptor ? '' : flight.preferred_aircraft_category || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, lead, leadFlightRequests]);

  useEffect(() => {
    if (!isEdit && user?.id && !ownerId) setOwnerId(user.id);
  }, [isEdit, user?.id, ownerId]);

  const isValid = () => {
    if (!companyName || !mobileNumber || !email) return false;
    if (!serviceType || (serviceType === 'Other' && !customServiceType)) return false;
    if (!source) return false;
    if (!ownerId) return false;
    if (!nextActionDate || !nextActionNote) return false;

    if (config.kind === 'route') {
      if (legs.some((leg) => !leg.route_from || !leg.route_to || !leg.departure_date || !leg.departure_time)) return false;
      if (config.useCargoWeight && !cargoWeight) return false;
    } else if (!primaryDescriptor) {
      return false;
    }

    return true;
  };

  const composeDealSummary = () => {
    if (config.kind === 'route') {
      const qty = config.useCargoWeight ? `${cargoWeight}kg` : `${legs[0].passengers} ${config.passengerLabel.toLowerCase()}`;
      const routePart = legs.length > 1
        ? `${legs[0].route_from} → ${legs[0].route_to} (+${legs.length - 1} leg${legs.length > 2 ? 's' : ''})`
        : `${legs[0].route_from} → ${legs[0].route_to}`;
      return `${routePart} • ${qty}`;
    }
    const extras = (config.customFields || [])
      .map((f) => customFieldValues[f.key])
      .filter(Boolean)
      .join(' • ');
    return [primaryDescriptor, extras].filter(Boolean).join(' • ');
  };

  const saveLead = useMutation({
    mutationFn: async () => {
      const leadPayload: Record<string, unknown> = {
        company_name: companyName,
        contact_name: contactName || null,
        mobile_number: mobileNumber,
        email,
        client_id: selectedClientId || null,
        lead_type: derivedLeadType,
        service_type: resolvedServiceType,
        deal_summary: composeDealSummary(),
        assigned_to: ownerId,
        priority,
        next_action_date: nextActionDate,
        next_action_time: nextActionTime || null,
        next_action_note: nextActionNote,
        source,
        description: notes || null,
      };

      let leadId: string;
      if (isEdit) {
        const { error } = await supabase.from('leads').update(leadPayload as any).eq('id', id);
        if (error) throw error;
        leadId = id as string;
      } else {
        leadPayload.status = 'new';
        leadPayload.created_by = user?.id;
        const { data, error } = await supabase.from('leads').insert(leadPayload as any).select('id').single();
        if (error) throw error;
        leadId = data.id;
      }

      if (config.kind === 'route') {
        const flightType = deriveFlightType(legs);
        const normalizedLegs = legs.map((leg) => ({
          route_from: leg.route_from,
          route_to: leg.route_to,
          departure_date: leg.departure_date,
          departure_time: leg.departure_time,
          passengers: config.useCargoWeight ? 1 : leg.passengers,
        }));
        const firstLeg = normalizedLegs[0];

        if (existingFlightId) {
          const { error } = await supabase.from('flight_requests').update({
            route_from: firstLeg.route_from,
            route_to: firstLeg.route_to,
            departure_date: firstLeg.departure_date,
            departure_time: firstLeg.departure_time,
            passengers: firstLeg.passengers,
            special_requests: specialRequests || null,
            flight_type: flightType,
            flight_legs: normalizedLegs.length > 1 ? (normalizedLegs as unknown as Json) : null,
            preferred_aircraft_category: primaryDescriptor || null,
            cargo_weight_kg: config.useCargoWeight && cargoWeight ? Number(cargoWeight) : null,
          }).eq('id', existingFlightId);
          if (error) throw error;
        } else {
          await createFlight.mutateAsync({
            client_id: selectedClientId || undefined,
            lead_id: leadId,
            client_name: companyName,
            legs: normalizedLegs,
            special_requests: specialRequests || undefined,
            flight_type: flightType,
            preferred_aircraft_category: primaryDescriptor || undefined,
            cargo_weight_kg: config.useCargoWeight && cargoWeight ? Number(cargoWeight) : undefined,
          });
        }
      }

      if (!isEdit) {
        const owner = owners.find((o) => o.user_id === ownerId);
        await logLeadActivity(
          leadId,
          'assigned',
          `Lead assigned to ${owner?.full_name || owner?.email || 'owner'}`,
          supabaseUser?.id,
          user?.name
        );
      }

      const mentionText = [notes, specialRequests].filter(Boolean).join(' ');
      const mentionedIds = extractMentionedUserIds(mentionText, owners).filter((uid) => uid !== supabaseUser?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you on lead "${companyName}"`,
          leadId,
          sourceTable: 'leads',
          sourceId: leadId,
        });
        for (const uid of mentionedIds) {
          await addLeadTeamMember(leadId, uid, 'Sales Support', undefined);
        }
        queryClient.invalidateQueries({ queryKey: ['lead-team-members', leadId] });
      }

      return leadId;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-flight-requests', leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      toast.success(isEdit ? 'Lead updated successfully' : 'Lead created successfully');
      navigate(`/leads/${leadId}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to ${isEdit ? 'update' : 'create'} lead: ` + error.message);
    },
  });

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Lead' : 'Create New Lead'}</h1>
          <p className="text-sm text-muted-foreground">Fast capture first; service-specific details appear dynamically</p>
        </div>

        <div className="rounded-lg border p-6 space-y-8">
          {/* 1. Client & Contact */}
          <div className="space-y-4">
            <h3 className="font-semibold">1. Client & Contact</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2 relative">
                <Label>Client *</Label>
                <Input
                  value={companyName}
                  onChange={(e) => { setCompanyName(e.target.value); setSelectedClientId(''); setDerivedLeadType(null); }}
                  placeholder="Company or individual name"
                />
                {matchingClients.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {matchingClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 flex items-center justify-between"
                      >
                        <span>{c.company_name}</span>
                        {c.client_type && <span className="text-xs text-muted-foreground">{c.client_type}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {selectedClientId && <p className="text-xs text-success">Linked to existing client</p>}
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-2 grid grid-cols-2 gap-2">
                <div>
                  <Label>Mobile *</Label>
                  <Input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder="+966 5X XXX XXXX" />
                </div>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Request */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold">2. Request</h3>
            <div className={cn('grid gap-4', config.kind === 'route' ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              <div className="space-y-2">
                <Label>Service *</Label>
                <Select value={serviceType} onValueChange={handleServiceChange}>
                  <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other…</SelectItem>
                  </SelectContent>
                </Select>
                {serviceType === 'Other' && (
                  <Input value={customServiceType} onChange={(e) => setCustomServiceType(e.target.value)} placeholder="Enter service type" />
                )}
              </div>
              {config.kind !== 'route' && (
                <div className="space-y-2">
                  <Label>Sub-Service *</Label>
                  <Select value={primaryDescriptorChoice} onValueChange={setPrimaryDescriptorChoice} disabled={!serviceType}>
                    <SelectTrigger><SelectValue placeholder={config.primaryDescriptorPlaceholder} /></SelectTrigger>
                    <SelectContent>
                      {config.primaryDescriptorOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="Other">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {primaryDescriptorChoice === 'Other' && (
                    <Input
                      value={customPrimaryDescriptor}
                      onChange={(e) => setCustomPrimaryDescriptor(e.target.value)}
                      placeholder="Enter details"
                    />
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue placeholder="How did they find us?" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {serviceType && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-4 space-y-4 animate-in fade-in-50">
                <p className="text-xs font-semibold text-warning uppercase tracking-wide">
                  {resolvedServiceType} Requirement
                </p>

                {config.kind === 'route' ? (
                  <>
                    <div className="space-y-3">
                      {legs.map((leg, index) => (
                        <div key={leg.id} className={cn('p-3 rounded-lg border space-y-3', index > 0 && 'bg-background/60')}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                              {legs.length > 1 ? `Leg ${index + 1}` : 'Flight Details'}
                            </span>
                            {index > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => removeLeg(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>From *</Label>
                              <AirportAutocomplete
                                value={leg.route_from}
                                onChange={(v) => updateLeg(index, 'route_from', v)}
                                placeholder="Search airport..."
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>To *</Label>
                              <AirportAutocomplete
                                value={leg.route_to}
                                onChange={(v) => updateLeg(index, 'route_to', v)}
                                placeholder="Search airport..."
                                required
                              />
                            </div>
                          </div>
                          <div className="grid sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label>Departure Date *</Label>
                              <Input type="date" value={leg.departure_date} onChange={(e) => updateLeg(index, 'departure_date', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                              <Label>Departure Time *</Label>
                              <Input type="time" value={leg.departure_time} onChange={(e) => updateLeg(index, 'departure_time', e.target.value)} />
                            </div>
                            {!config.useCargoWeight && (
                              <div className="space-y-2">
                                <Label>{config.passengerLabel}</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={leg.passengers}
                                  onChange={(e) => updateLeg(index, 'passengers', parseInt(e.target.value) || 1)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={addReturnLeg}
                        disabled={!legs[legs.length - 1].route_from || !legs[legs.length - 1].route_to}
                      >
                        <RotateCcw className="h-4 w-4" /> Add Return
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={addLeg}
                        disabled={!legs[legs.length - 1].route_to}
                      >
                        <Route className="h-4 w-4" /> Add Leg
                      </Button>
                    </div>

                    {config.useCargoWeight && (
                      <div className="space-y-2">
                        <Label>Cargo Weight (kg) *</Label>
                        <Input type="number" min="0" value={cargoWeight} onChange={(e) => setCargoWeight(e.target.value)} placeholder="e.g. 6200" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Special Requests</Label>
                      <MentionField
                        value={specialRequests}
                        onChange={setSpecialRequests}
                        candidates={owners}
                        multiline={false}
                        placeholder="VIP handling, catering... Use @ to mention a teammate"
                      />
                    </div>
                  </>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-4">
                    {(config.customFields || []).map((f) => (
                      <div key={f.key} className="space-y-2">
                        <Label>{f.label}</Label>
                        <Input
                          type={f.type === 'date' ? 'date' : 'text'}
                          value={customFieldValues[f.key] || ''}
                          onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Commercial Ownership */}
          <div className="space-y-4 border-t pt-6">
            <h3 className="font-semibold">3. Commercial Ownership</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Lead Owner *</Label>
                <Select value={ownerId} onValueChange={setOwnerId}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>
                    {owners.map((o) => (
                      <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Next Action *</Label>
                <Input value={nextActionNote} onChange={(e) => setNextActionNote(e.target.value)} placeholder="e.g. Prepare quotation" />
              </div>
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Next Action Date *</Label>
                <Input type="date" value={nextActionDate} onChange={(e) => setNextActionDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Next Action Time</Label>
                <Input type="time" value={nextActionTime} onChange={(e) => setNextActionTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <MentionField
                value={notes}
                onChange={setNotes}
                candidates={owners}
                rows={3}
                placeholder="Any additional notes... Use @ to mention a teammate"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-6">
            <Button variant="outline" onClick={() => navigate(isEdit ? `/leads/${id}` : '/leads')}>
              Cancel
            </Button>
            <Button onClick={() => saveLead.mutate()} disabled={!isValid() || saveLead.isPending}>
              {saveLead.isPending ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create Lead')}
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2, FileDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import { downloadBlob } from '@/lib/quotation-pdf';
import { generateFlightBriefingPdf, type BriefingLeg, type BriefingPassenger } from '@/lib/flight-briefing-pdf';

interface SlotPermitRow {
  label: string;
  status: string;
}

interface FlightBriefingRow {
  id: string;
  flight_id: string;
  briefing_number: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  flight_duration: string | null;
  handling_agents: string | null;
  terminals_dep_airport: string | null;
  terminals_dep_location: string | null;
  terminals_arr_airport: string | null;
  terminals_arr_location: string | null;
  slots_permits: SlotPermitRow[];
}

const emptyForm = {
  departure_time: '',
  arrival_time: '',
  flight_duration: '',
  handling_agents: '',
  terminals_dep_airport: '',
  terminals_dep_location: '',
  terminals_arr_airport: '',
  terminals_arr_location: '',
};

const CUSTOM_AIRPORT = '__custom__';

export function FlightBriefingPanel({ flightId }: { flightId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'operations' || user?.role === 'admin' || user?.role === 'super_admin';
  const [customDepAirport, setCustomDepAirport] = useState(false);
  const [customArrAirport, setCustomArrAirport] = useState(false);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [slots, setSlots] = useState<SlotPermitRow[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: flight } = useQuery({
    queryKey: ['flight-briefing-flight', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('route_from, route_to, departure_date, departure_time, passengers, flight_legs')
        .eq('id', flightId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const airportOptions = Array.from(new Set([flight?.route_from, flight?.route_to].filter((a): a is string => !!a)));

  const { data: selectedOption } = useQuery({
    queryKey: ['flight-briefing-option', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_options')
        .select('aircraft_type, aircraft_registration, estimated_duration')
        .eq('flight_id', flightId)
        .eq('is_selected', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: passengers = [] } = useQuery({
    queryKey: ['flight-passengers', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_passengers')
        .select('full_name, nationality, date_of_birth, passport_number, passport_expiry, is_vip')
        .eq('flight_id', flightId)
        .order('is_vip', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as BriefingPassenger[];
    },
  });

  const { data: briefing, isLoading } = useQuery({
    queryKey: ['flight-briefing', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.from('flight_briefings').select('*').eq('flight_id', flightId).maybeSingle();
      if (error) throw error;
      return data as unknown as FlightBriefingRow | null;
    },
  });

  useEffect(() => {
    if (briefing) {
      setForm({
        departure_time: briefing.departure_time || '',
        arrival_time: briefing.arrival_time || '',
        flight_duration: briefing.flight_duration || selectedOption?.estimated_duration || '',
        handling_agents: briefing.handling_agents || '',
        terminals_dep_airport: briefing.terminals_dep_airport || '',
        terminals_dep_location: briefing.terminals_dep_location || '',
        terminals_arr_airport: briefing.terminals_arr_airport || '',
        terminals_arr_location: briefing.terminals_arr_location || '',
      });
      setSlots(Array.isArray(briefing.slots_permits) ? briefing.slots_permits : []);
      setCustomDepAirport(!!briefing.terminals_dep_airport && !airportOptions.includes(briefing.terminals_dep_airport));
      setCustomArrAirport(!!briefing.terminals_arr_airport && !airportOptions.includes(briefing.terminals_arr_airport));
    } else if (flight) {
      setForm((f) => ({ ...f, departure_time: flight.departure_time || '', flight_duration: selectedOption?.estimated_duration || '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing, flight, selectedOption]);

  const save = useMutation({
    mutationFn: async () => {
      const briefingNumber = briefing?.briefing_number || `FB-${new Date().getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`;
      const payload = { flight_id: flightId, briefing_number: briefingNumber, ...form, slots_permits: slots as unknown as Json };
      const { error } = await supabase.from('flight_briefings').upsert(payload, { onConflict: 'flight_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-briefing', flightId] });
      toast.success('Flight briefing details saved');
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to save'),
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const legsRaw = flight?.flight_legs as Array<Record<string, string>> | null | undefined;
      const legs: BriefingLeg[] = Array.isArray(legsRaw) && legsRaw.length > 0
        ? legsRaw.map((l) => ({ date: l.date || l.departure_date || flight?.departure_date || '', from: l.from || l.route_from || flight?.route_from || '', to: l.to || l.route_to || flight?.route_to || '' }))
        : [{ date: flight?.departure_date || '', from: flight?.route_from || '', to: flight?.route_to || '' }];

      const briefingNumber = briefing?.briefing_number || `FB-${new Date().getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`;

      const blob = await generateFlightBriefingPdf({
        briefingNumber,
        date: flight?.departure_date || '',
        aircraftType: selectedOption?.aircraft_type || '',
        aircraftRegistration: selectedOption?.aircraft_registration || '',
        legs,
        departureTime: form.departure_time,
        arrivalTime: form.arrival_time,
        flightDuration: form.flight_duration,
        paxNumber: flight?.passengers || passengers.length,
        handlingAgents: form.handling_agents,
        terminalsDepAirport: form.terminals_dep_airport,
        terminalsDepLocation: form.terminals_dep_location,
        terminalsArrAirport: form.terminals_arr_airport,
        terminalsArrLocation: form.terminals_arr_location,
        slotsPermits: slots,
        passengers,
      });
      downloadBlob(blob, `${briefingNumber}.pdf`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate briefing');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Fill in the operational details below, then download the Flight Briefing document.'
            : 'Filled in by Operations — view only. You can still download the document below.'}
        </p>
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
          Download Flight Briefing
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Departure Time</Label>
              <Input placeholder="e.g. 09:00" value={form.departure_time} onChange={(e) => setForm({ ...form, departure_time: e.target.value })} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Arrival Time</Label>
              <Input placeholder="e.g. 10:30" value={form.arrival_time} onChange={(e) => setForm({ ...form, arrival_time: e.target.value })} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Flight Duration</Label>
              <Input placeholder="e.g. 1h 30m" value={form.flight_duration} onChange={(e) => setForm({ ...form, flight_duration: e.target.value })} disabled={!canEdit} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Handling Agents</Label>
            <Input placeholder="e.g. Jet Aviation Jeddah" value={form.handling_agents} onChange={(e) => setForm({ ...form, handling_agents: e.target.value })} disabled={!canEdit} />
          </div>

          <div>
            <Label className="mb-2 block">Terminals Location</Label>
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={customDepAirport ? CUSTOM_AIRPORT : form.terminals_dep_airport || undefined}
                  onValueChange={(v) => {
                    setCustomDepAirport(v === CUSTOM_AIRPORT);
                    setForm({ ...form, terminals_dep_airport: v === CUSTOM_AIRPORT ? '' : v });
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue placeholder="Departure Airport" /></SelectTrigger>
                  <SelectContent>
                    {airportOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    <SelectItem value={CUSTOM_AIRPORT}>Other (type manually)</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={customArrAirport ? CUSTOM_AIRPORT : form.terminals_arr_airport || undefined}
                  onValueChange={(v) => {
                    setCustomArrAirport(v === CUSTOM_AIRPORT);
                    setForm({ ...form, terminals_arr_airport: v === CUSTOM_AIRPORT ? '' : v });
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue placeholder="Arrival Airport" /></SelectTrigger>
                  <SelectContent>
                    {airportOptions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                    <SelectItem value={CUSTOM_AIRPORT}>Other (type manually)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(customDepAirport || customArrAirport) && (
                <div className="grid grid-cols-2 gap-3">
                  {customDepAirport ? (
                    <Input placeholder="Airport name" value={form.terminals_dep_airport} onChange={(e) => setForm({ ...form, terminals_dep_airport: e.target.value })} disabled={!canEdit} />
                  ) : <div />}
                  {customArrAirport ? (
                    <Input placeholder="Airport name" value={form.terminals_arr_airport} onChange={(e) => setForm({ ...form, terminals_arr_airport: e.target.value })} disabled={!canEdit} />
                  ) : <div />}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Departure Location" value={form.terminals_dep_location} onChange={(e) => setForm({ ...form, terminals_dep_location: e.target.value })} disabled={!canEdit} />
                <Input placeholder="Arrival Location" value={form.terminals_arr_location} onChange={(e) => setForm({ ...form, terminals_arr_location: e.target.value })} disabled={!canEdit} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Slots &amp; Permits Status</Label>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setSlots((prev) => [...prev, { label: '', status: '' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Row
                </Button>
              )}
            </div>
            {slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">No permit/slot rows added yet.</p>
            ) : (
              <div className="space-y-2">
                {slots.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Country or Airport / Type"
                      value={row.label}
                      onChange={(e) => setSlots((prev) => prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                      disabled={!canEdit}
                    />
                    <Input
                      placeholder="Status"
                      value={row.status}
                      onChange={(e) => setSlots((prev) => prev.map((r, j) => (j === i ? { ...r, status: e.target.value } : r)))}
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Details
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2, FileDown, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { friendlyError } from '@/lib/friendlyError';
import { downloadBlob } from '@/lib/quotation-pdf';
import { generateFlightBriefingPdf, type BriefingLeg, type BriefingPassenger } from '@/lib/flight-briefing-pdf';
import { BriefingPassengerGrid } from '@/components/flights/BriefingPassengerGrid';
import { BriefingDocumentsCard } from '@/components/flights/BriefingDocumentsCard';

interface SlotPermitRow {
  label: string;
  status: string;
}

interface TerminalRow {
  terminal: string;
  location: string;
}

interface FlightBriefingRow {
  id: string;
  flight_id: string;
  briefing_number: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  flight_duration: string | null;
  handling_agents: string | null;
  handling_agents_legs: string[] | null;
  terminals_dep_airport: string | null;
  terminals_dep_location: string | null;
  terminals_arr_airport: string | null;
  terminals_arr_location: string | null;
  terminals: TerminalRow[] | null;
  slots_permits: SlotPermitRow[];
}

const emptyForm = {
  departure_time: '',
  arrival_time: '',
  flight_duration: '',
  handling_agents_legs: [] as string[],
};

type AutoField = 'departure_time' | 'flight_duration' | 'arrival_time';
const noOverrides: Record<AutoField, boolean> = { departure_time: false, flight_duration: false, arrival_time: false };

// "13:18:00" -> "13:18"
const trimTime = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

// The ordered list of airports a route touches - departure of the first
// leg, then each leg's arrival - with immediate repeats collapsed (a leg
// that starts where the previous one ended only lists that airport once).
function routeStops(legs: Array<{ from: string; to: string }>): string[] {
  const stops = [legs[0]?.from, ...legs.map((l) => l.to)].filter((s): s is string => !!s && s.trim().length > 0);
  return stops.filter((s, i) => i === 0 || s !== stops[i - 1]);
}

// "2h 30m", "1h", "~2h", "2:30", "90 min" -> minutes (null if it can't tell)
function parseDurationMinutes(text: string): number | null {
  const clock = text.match(/^\s*~?\s*(\d{1,2}):(\d{2})\s*$/);
  if (clock) return parseInt(clock[1]) * 60 + parseInt(clock[2]);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*h/i);
  const mins = text.match(/(\d+)\s*m/i);
  if (!hours && !mins) return null;
  return Math.round((hours ? parseFloat(hours[1]) * 60 : 0) + (mins ? parseInt(mins[1]) : 0));
}

// Departure + duration. Not adjusted for time zones — Ops can overwrite it
// with the destination's local time when that differs.
function computeArrival(departure: string, duration: string): string {
  const dep = departure.match(/^(\d{1,2}):(\d{2})/);
  const durMins = parseDurationMinutes(duration);
  if (!dep || durMins === null) return '';
  const total = parseInt(dep[1]) * 60 + parseInt(dep[2]) + durMins;
  const wrapped = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}${total >= 1440 ? ' (+1)' : ''}`;
}

export function FlightBriefingPanel({ flightId }: { flightId: string }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'operations' || user?.role === 'senior_operations' || user?.role === 'admin' || user?.role === 'super_admin';
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  // A field only stops following the flight details once someone edits it.
  const [overridden, setOverridden] = useState(noOverrides);
  const [slots, setSlots] = useState<SlotPermitRow[]>([]);
  const [terminals, setTerminals] = useState<TerminalRow[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [passengersDirty, setPassengersDirty] = useState(false);

  const { data: flight } = useQuery({
    queryKey: ['flight-briefing-flight', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('route_from, route_to, departure_date, departure_time, passengers, flight_legs, client_selected_option_id')
        .eq('id', flightId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Sales can quote more than one aircraft, so more than one row can still
  // be marked is_selected here — prefer the one the client actually chose
  // (recorded once Sales confirms with the client) and only fall back to
  // "whichever selected option comes first" before that's been recorded.
  const { data: selectedOption } = useQuery({
    queryKey: ['flight-briefing-option', flightId, flight?.client_selected_option_id],
    queryFn: async () => {
      if (flight?.client_selected_option_id) {
        const { data, error } = await supabase
          .from('flight_options')
          .select('aircraft_type, aircraft_registration, estimated_duration')
          .eq('id', flight.client_selected_option_id)
          .maybeSingle();
        if (error) throw error;
        if (data) return data;
      }
      const { data, error } = await supabase
        .from('flight_options')
        .select('aircraft_type, aircraft_registration, estimated_duration')
        .eq('flight_id', flightId)
        .eq('is_selected', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!flight,
  });

  const { data: passengers = [] } = useQuery({
    queryKey: ['flight-passengers', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_passengers')
        .select('*')
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

  // Straight from the flight details: departure time from the request,
  // duration from the aircraft option; arrival is departure + duration.
  const autoDeparture = trimTime(flight?.departure_time);
  const autoDuration = selectedOption?.estimated_duration || '';

  // Same route list the document itself uses - shared here so the
  // per-leg handling agent inputs are labeled with the exact same routes.
  const legs: BriefingLeg[] = useMemo(() => {
    const legsRaw = flight?.flight_legs as Array<Record<string, string>> | null | undefined;
    return Array.isArray(legsRaw) && legsRaw.length > 0
      ? legsRaw.map((l) => ({ date: l.date || l.departure_date || flight?.departure_date || '', from: l.from || l.route_from || flight?.route_from || '', to: l.to || l.route_to || flight?.route_to || '' }))
      : [{ date: flight?.departure_date || '', from: flight?.route_from || '', to: flight?.route_to || '' }];
  }, [flight]);

  useEffect(() => {
    if (briefing) {
      const savedDeparture = trimTime(briefing.departure_time);
      const savedDuration = briefing.flight_duration || '';
      const savedArrival = briefing.arrival_time || '';
      const savedLegs = Array.isArray(briefing.handling_agents_legs) ? briefing.handling_agents_legs : [];
      setForm({
        departure_time: savedDeparture,
        arrival_time: savedArrival,
        flight_duration: savedDuration,
        handling_agents_legs: legs.map((_, i) => savedLegs[i] || ''),
      });
      // Something saved that differs from what the flight details give is
      // a deliberate edit and stays as typed; anything matching keeps following.
      const depValue = savedDeparture || autoDeparture;
      const durValue = savedDuration || autoDuration;
      setOverridden({
        departure_time: !!savedDeparture && savedDeparture !== autoDeparture,
        flight_duration: !!savedDuration && savedDuration !== autoDuration,
        arrival_time: !!savedArrival && savedArrival !== computeArrival(depValue, durValue),
      });
      setSlots(Array.isArray(briefing.slots_permits) ? briefing.slots_permits : []);

      // Prefer the new per-row data; fall back to converting the old fixed
      // departure/arrival pair into two rows; if neither has anything yet,
      // seed from the route so there's something to edit instead of blank.
      const savedTerminals = Array.isArray(briefing.terminals) ? briefing.terminals : [];
      const legacyTerminals: TerminalRow[] = [
        { terminal: briefing.terminals_dep_airport || '', location: briefing.terminals_dep_location || '' },
        { terminal: briefing.terminals_arr_airport || '', location: briefing.terminals_arr_location || '' },
      ].filter((r) => r.terminal || r.location);
      setTerminals(
        savedTerminals.length ? savedTerminals
        : legacyTerminals.length ? legacyTerminals
        : routeStops(legs).map((t) => ({ terminal: t, location: '' }))
      );
    } else {
      setOverridden(noOverrides);
      setTerminals(routeStops(legs).map((t) => ({ terminal: t, location: '' })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefing, flight, selectedOption, legs]);

  const departureValue = overridden.departure_time ? form.departure_time : autoDeparture || form.departure_time;
  const durationValue = overridden.flight_duration ? form.flight_duration : autoDuration || form.flight_duration;
  const arrivalValue = overridden.arrival_time ? form.arrival_time : computeArrival(departureValue, durationValue) || form.arrival_time;
  const anyOverridden = Object.values(overridden).some(Boolean);

  // Same padding the load effect applies, so a leg count that hasn't
  // changed doesn't look like an edit just because the saved array is a
  // different length (e.g. briefed before a leg was added/removed).
  const savedHandlingLegs = briefing
    ? legs.map((_, i) => (Array.isArray(briefing.handling_agents_legs) ? briefing.handling_agents_legs[i] : undefined) || '')
    : [];

  // Same resolution order the load effect uses (new rows, else the legacy
  // pair converted, else seeded from the route) so a freshly seeded/
  // converted list isn't mistaken for an unsaved edit.
  const savedTerminals: TerminalRow[] = briefing
    ? (() => {
        const saved = Array.isArray(briefing.terminals) ? briefing.terminals : [];
        if (saved.length) return saved;
        const legacy: TerminalRow[] = [
          { terminal: briefing.terminals_dep_airport || '', location: briefing.terminals_dep_location || '' },
          { terminal: briefing.terminals_arr_airport || '', location: briefing.terminals_arr_location || '' },
        ].filter((r) => r.terminal || r.location);
        return legacy.length ? legacy : routeStops(legs).map((t) => ({ terminal: t, location: '' }));
      })()
    : [];

  // The document is built from what's saved, so it can only be downloaded once
  // the details are saved and nothing typed since is waiting to be saved.
  const detailsUnsaved =
    !briefing ||
    departureValue !== trimTime(briefing.departure_time) ||
    arrivalValue !== (briefing.arrival_time || '') ||
    durationValue !== (briefing.flight_duration || '') ||
    JSON.stringify(form.handling_agents_legs) !== JSON.stringify(savedHandlingLegs) ||
    JSON.stringify(terminals) !== JSON.stringify(savedTerminals) ||
    JSON.stringify(slots) !== JSON.stringify(Array.isArray(briefing.slots_permits) ? briefing.slots_permits : []);
  const needsSave = canEdit ? detailsUnsaved || passengersDirty : !briefing;
  const saveHint = !briefing
    ? 'Save the details first — the download unlocks once they are saved.'
    : passengersDirty
    ? 'You have unsaved passenger changes — click Save Passengers first.'
    : 'You have unsaved changes — click Save Details first.';

  const editAuto = (field: AutoField, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setOverridden((o) => ({ ...o, [field]: true }));
  };

  const save = useMutation({
    mutationFn: async () => {
      const briefingNumber = briefing?.briefing_number || `FB-${new Date().getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`;
      const payload = {
        flight_id: flightId,
        briefing_number: briefingNumber,
        departure_time: departureValue,
        arrival_time: arrivalValue,
        flight_duration: durationValue,
        handling_agents_legs: form.handling_agents_legs as unknown as Json,
        terminals: terminals as unknown as Json,
        slots_permits: slots as unknown as Json,
      };
      const { error } = await supabase.from('flight_briefings').upsert(payload, { onConflict: 'flight_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-briefing', flightId] });
      toast.success('Flight briefing details saved');
    },
    onError: (error: unknown) => toast.error(friendlyError(error, 'Failed to save')),
  });

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const briefingNumber = briefing?.briefing_number || `FB-${new Date().getFullYear()}-${flightId.slice(0, 6).toUpperCase()}`;

      const blob = await generateFlightBriefingPdf({
        briefingNumber,
        date: flight?.departure_date || '',
        aircraftType: selectedOption?.aircraft_type || '',
        aircraftRegistration: selectedOption?.aircraft_registration || '',
        legs,
        departureTime: departureValue,
        arrivalTime: arrivalValue,
        flightDuration: durationValue,
        paxNumber: flight?.passengers || passengers.length,
        handlingAgents: briefing?.handling_agents || '',
        handlingAgentsLegs: form.handling_agents_legs,
        terminals,
        slotsPermits: slots,
        passengers,
      });
      downloadBlob(blob, `${briefingNumber}.pdf`);
    } catch (error: unknown) {
      toast.error(friendlyError(error, 'Failed to generate briefing'));
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? 'Times fill in from the flight details. Add the handling agents, permits and passengers, then download the Flight Briefing document.'
            : 'Filled in by Operations — view only. You can still download the document below.'}
        </p>
        <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
          <Button onClick={handleDownload} disabled={isDownloading || needsSave} title={needsSave ? saveHint : undefined} className="w-full sm:w-auto">
            {isDownloading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileDown className="h-4 w-4 mr-1.5" />}
            Download Flight Briefing
          </Button>
          {needsSave && <p className="text-[11px] text-muted-foreground sm:text-right max-w-56">{saveHint}</p>}
        </div>
      </div>

      {/* What Sales uploaded - Operations check this before filling anything in */}
      {canEdit && <BriefingDocumentsCard flightId={flightId} />}

      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Airports come straight from the flight's route in the document, so
              there's nothing to pick — the times below fill themselves in too. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Departure Time</Label>
              <Input placeholder="e.g. 09:00" value={departureValue} onChange={(e) => editAuto('departure_time', e.target.value)} disabled={!canEdit} />
              {!overridden.departure_time && autoDeparture && <p className="text-[11px] text-muted-foreground">From the flight</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Arrival Time</Label>
              <Input placeholder="e.g. 10:30" value={arrivalValue} onChange={(e) => editAuto('arrival_time', e.target.value)} disabled={!canEdit} />
              {!overridden.arrival_time && computeArrival(departureValue, durationValue) && (
                <p className="text-[11px] text-muted-foreground">Departure + duration</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Flight Duration</Label>
              <Input placeholder="e.g. 1h 30m" value={durationValue} onChange={(e) => editAuto('flight_duration', e.target.value)} disabled={!canEdit} />
              {!overridden.flight_duration && autoDuration && <p className="text-[11px] text-muted-foreground">From the aircraft option</p>}
            </div>
          </div>

          {canEdit && anyOverridden && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs -mt-2" onClick={() => setOverridden(noOverrides)}>
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset times to the flight details
            </Button>
          )}

          <div className="space-y-1.5">
            <Label>Handling Agents</Label>
            {briefing?.handling_agents && !form.handling_agents_legs.some(Boolean) && (
              <p className="text-[11px] text-muted-foreground">
                Previously entered as one line: "{briefing.handling_agents}" — split it into the route(s) below.
              </p>
            )}
            <div className="space-y-2">
              {legs.map((leg, i) => (
                <div key={i} className="space-y-1">
                  {legs.length > 1 && (
                    <p className="text-xs font-medium text-muted-foreground">
                      {leg.from || '—'} → {leg.to || '—'}
                    </p>
                  )}
                  <Input
                    placeholder="e.g. Jet Aviation Jeddah"
                    value={form.handling_agents_legs[i] || ''}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      handling_agents_legs: f.handling_agents_legs.map((v, j) => (j === i ? e.target.value : v)),
                    }))}
                    disabled={!canEdit}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Terminals Location</Label>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setTerminals((prev) => [...prev, { terminal: '', location: '' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Row
                </Button>
              )}
            </div>
            {terminals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No terminal rows added yet.</p>
            ) : (
              <div className="space-y-2">
                {terminals.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="Terminal (e.g. OEAB - Abha Airport)"
                      value={row.terminal}
                      onChange={(e) => setTerminals((prev) => prev.map((r, j) => (j === i ? { ...r, terminal: e.target.value } : r)))}
                      disabled={!canEdit}
                    />
                    <Input
                      placeholder="Location"
                      value={row.location}
                      onChange={(e) => setTerminals((prev) => prev.map((r, j) => (j === i ? { ...r, location: e.target.value } : r)))}
                      disabled={!canEdit}
                    />
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-destructive" onClick={() => setTerminals((prev) => prev.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
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
                      <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-destructive" onClick={() => setSlots((prev) => prev.filter((_, j) => j !== i))}>
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

      {canEdit && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-base">Passengers</Label>
            <BriefingPassengerGrid flightId={flightId} onDirtyChange={setPassengersDirty} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

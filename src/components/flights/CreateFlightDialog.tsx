import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RotateCcw, Route, Trash2, UserPlus } from 'lucide-react';
import { useFlightRequests } from '@/hooks/useFlightRequests';
import { cn } from '@/lib/utils';
import { ClientTypeForm } from '@/components/clients/ClientTypeForm';
import { LeadTypeForm } from '@/components/leads/LeadTypeForm';
import { AirportAutocomplete } from '@/components/flights/AirportAutocomplete';

interface FlightLeg {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
}

interface CreateFlightDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateFlightDialog({ open, onOpenChange }: CreateFlightDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogOpen = open ?? isOpen;
  const setDialogOpen = onOpenChange ?? setIsOpen;
  
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  const [requestorType, setRequestorType] = useState<'lead' | 'client'>('lead');

  const { createFlight } = useFlightRequests();
  
  const [selectedId, setSelectedId] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [legs, setLegs] = useState<FlightLeg[]>([
    { id: crypto.randomUUID(), route_from: '', route_to: '', departure_date: '', departure_time: '', passengers: 1 }
  ]);

  // Fetch clients for dropdown
  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, contact_name')
        .order('company_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads for dropdown (only unconverted leads)
  const { data: leads = [] } = useQuery({
    queryKey: ['leads-for-flight'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, company_name, first_name, last_name, lead_type')
        .is('converted_to_client_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleClientCreated = (newClientId: string) => {
    setSelectedId(newClientId);
    setRequestorType('client');
  };

  const handleLeadCreated = (newLeadId: string) => {
    setSelectedId(newLeadId);
    setRequestorType('lead');
  };

  const updateLeg = (index: number, field: keyof FlightLeg, value: string | number) => {
    setLegs(prev => prev.map((leg, i) => 
      i === index ? { ...leg, [field]: value } : leg
    ));
  };

  const addReturnLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs(prev => [...prev, {
      id: crypto.randomUUID(),
      route_from: lastLeg.route_to,
      route_to: lastLeg.route_from,
      departure_date: lastLeg.departure_date,
      departure_time: '',
      passengers: lastLeg.passengers,
    }]);
  };

  const addLeg = () => {
    const lastLeg = legs[legs.length - 1];
    setLegs(prev => [...prev, {
      id: crypto.randomUUID(),
      route_from: lastLeg.route_to,
      route_to: '',
      departure_date: lastLeg.departure_date,
      departure_time: '',
      passengers: lastLeg.passengers,
    }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length > 1) {
      setLegs(prev => prev.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setSelectedId('');
    setSpecialRequests('');
    setRequestorType('lead');
    setLegs([{ id: crypto.randomUUID(), route_from: '', route_to: '', departure_date: '', departure_time: '', passengers: 1 }]);
  };

  const getDisplayName = () => {
    if (requestorType === 'client') {
      const client = clients.find(c => c.id === selectedId);
      return client?.company_name || client?.contact_name || 'Unknown';
    } else {
      const lead = leads.find(l => l.id === selectedId);
      if (lead?.company_name) return lead.company_name;
      return [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || 'Unknown';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const displayName = getDisplayName();
    
    // Determine flight type
    let flightType: 'one_way' | 'round_trip' | 'multi_leg' = 'one_way';
    if (legs.length === 2) {
      // Check if it's a round trip (second leg returns to first origin)
      const isRoundTrip = legs[1].route_from === legs[0].route_to && 
                          legs[1].route_to === legs[0].route_from;
      flightType = isRoundTrip ? 'round_trip' : 'multi_leg';
    } else if (legs.length > 2) {
      flightType = 'multi_leg';
    }
    
    // Create single flight request with all legs
    await createFlight.mutateAsync({
      client_id: requestorType === 'client' ? selectedId : undefined,
      lead_id: requestorType === 'lead' ? selectedId : undefined,
      client_name: displayName,
      legs: legs.map(leg => ({
        route_from: leg.route_from,
        route_to: leg.route_to,
        departure_date: leg.departure_date,
        departure_time: leg.departure_time,
        passengers: leg.passengers,
      })),
      special_requests: specialRequests || undefined,
      flight_type: flightType,
    });
    
    resetForm();
    setDialogOpen(false);
  };

  const isValid = selectedId && legs.every(leg => 
    leg.route_from && leg.route_to && leg.departure_date && leg.departure_time
  );

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => {
      if (!open) resetForm();
      setDialogOpen(open);
    }}>
      <DialogTrigger asChild>
        <Button variant="gold" size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          New Flight Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Flight Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Requestor Type Tabs */}
          <div className="space-y-3">
            <Label>Request For *</Label>
            <Tabs value={requestorType} onValueChange={(v) => {
              setRequestorType(v as 'lead' | 'client');
              setSelectedId('');
            }}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="lead">Lead (Potential)</TabsTrigger>
                <TabsTrigger value="client">Client (Existing)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Lead/Client Selection */}
          <div className="space-y-2">
            <Label>{requestorType === 'lead' ? 'Lead' : 'Client'} *</Label>
            <div className="flex gap-2">
              <Select value={selectedId} onValueChange={setSelectedId} required>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={`Select a ${requestorType}`} />
                </SelectTrigger>
                <SelectContent>
                  {requestorType === 'lead' ? (
                    leads.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.company_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed Lead'}
                        <span className="ml-2 text-muted-foreground text-xs">({lead.lead_type || 'N/A'})</span>
                      </SelectItem>
                    ))
                  ) : (
                    clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name} {client.contact_name && `(${client.contact_name})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => requestorType === 'lead' ? setCreateLeadOpen(true) : setCreateClientOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
              </Button>
              <ClientTypeForm 
                open={createClientOpen} 
                onOpenChange={setCreateClientOpen}
                onSuccess={handleClientCreated}
              />
              <LeadTypeForm 
                open={createLeadOpen} 
                onOpenChange={setCreateLeadOpen}
                onSuccess={handleLeadCreated}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {requestorType === 'lead' 
                ? 'Leads are potential customers. They will be converted to clients upon flight confirmation.'
                : 'Clients are confirmed customers with previous completed flights.'}
            </p>
          </div>

          {/* Flight Legs */}
          <div className="space-y-4">
            {legs.map((leg, index) => (
              <div 
                key={leg.id} 
                className={cn(
                  "p-4 rounded-lg border border-border space-y-3",
                  index > 0 && "bg-secondary/20"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    {legs.length > 1 ? `Leg ${index + 1}` : 'Flight Details'}
                  </span>
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeLeg(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Departure *</Label>
                    <AirportAutocomplete
                      value={leg.route_from}
                      onChange={(value) => updateLeg(index, 'route_from', value)}
                      placeholder="Search airport..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Arrival *</Label>
                    <AirportAutocomplete
                      value={leg.route_to}
                      onChange={(value) => updateLeg(index, 'route_to', value)}
                      placeholder="Search airport..."
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input 
                      type="date" 
                      value={leg.departure_date}
                      onChange={(e) => updateLeg(index, 'departure_date', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Time *</Label>
                    <Input 
                      type="time" 
                      value={leg.departure_time}
                      onChange={(e) => updateLeg(index, 'departure_time', e.target.value)}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Passengers *</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      value={leg.passengers}
                      onChange={(e) => updateLeg(index, 'passengers', parseInt(e.target.value) || 1)}
                      required 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Leg Buttons */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addReturnLeg}
              disabled={!legs[legs.length - 1].route_from || !legs[legs.length - 1].route_to}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Add Return
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLeg}
              disabled={!legs[legs.length - 1].route_to}
              className="gap-2"
            >
              <Route className="h-4 w-4" />
              Add Leg
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_requests">Special Requests</Label>
            <Textarea 
              id="special_requests" 
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              placeholder="Catering preferences, ground transport, etc."
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={createFlight.isPending || !isValid}
          >
            {createFlight.isPending ? 'Creating...' : `Create Flight Request${legs.length > 1 ? ` (${legs.length} legs)` : ''}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

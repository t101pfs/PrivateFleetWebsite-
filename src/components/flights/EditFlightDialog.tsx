import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AirportAutocomplete } from '@/components/flights/AirportAutocomplete';
import type { FlightRequest, FlightLeg } from '@/hooks/useFlightRequests';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';

interface LocalFlightLeg extends FlightLeg {
  id: string;
}

interface EditFlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flight: FlightRequest;
  onSave: (data: {
    legs: FlightLeg[];
    special_requests?: string;
    flight_type: 'one_way' | 'round_trip' | 'multi_leg';
  }) => Promise<void>;
  isPending?: boolean;
}

export function EditFlightDialog({ 
  open, 
  onOpenChange, 
  flight, 
  onSave,
  isPending 
}: EditFlightDialogProps) {
  const [specialRequests, setSpecialRequests] = useState(flight.special_requests || '');
  const [legs, setLegs] = useState<LocalFlightLeg[]>([]);
  const { user } = useAuth();

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Initialize legs from flight data
  useEffect(() => {
    if (open) {
      if (flight.flight_legs && Array.isArray(flight.flight_legs) && flight.flight_legs.length > 0) {
        setLegs(flight.flight_legs.map((leg, index) => ({
          id: `leg-${index}`,
          route_from: leg.route_from,
          route_to: leg.route_to,
          departure_date: leg.departure_date,
          departure_time: leg.departure_time,
          passengers: leg.passengers,
        })));
      } else {
        setLegs([{
          id: 'leg-0',
          route_from: flight.route_from,
          route_to: flight.route_to,
          departure_date: flight.departure_date,
          departure_time: flight.departure_time,
          passengers: flight.passengers,
        }]);
      }
      setSpecialRequests(flight.special_requests || '');
    }
  }, [open, flight]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Determine flight type
    let flightType: 'one_way' | 'round_trip' | 'multi_leg' = 'one_way';
    if (legs.length === 2) {
      const isRoundTrip = legs[1].route_from === legs[0].route_to && 
                          legs[1].route_to === legs[0].route_from;
      flightType = isRoundTrip ? 'round_trip' : 'multi_leg';
    } else if (legs.length > 2) {
      flightType = 'multi_leg';
    }
    
    await onSave({
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

    const mentionedIds = extractMentionedUserIds(specialRequests, profiles).filter((uid) => uid !== user?.id);
    if (mentionedIds.length > 0) {
      await notifyMentionedUsers(mentionedIds, {
        title: 'You were mentioned',
        message: `${user?.name || 'Someone'} mentioned you in special requests for flight ${flight.route_from} → ${flight.route_to}`,
        flightId: flight.id,
        sourceTable: 'flight_requests',
        sourceId: flight.id,
      });
    }

    onOpenChange(false);
  };

  const isValid = legs.every(leg => 
    leg.route_from && leg.route_to && leg.departure_date && leg.departure_time
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Flight Details</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {legs.length > 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addReturnLeg}
                disabled={!legs[legs.length - 1]?.route_from || !legs[legs.length - 1]?.route_to}
              >
                Add Return
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLeg}
                disabled={!legs[legs.length - 1]?.route_to}
              >
                Add Leg
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="special_requests">Special Requests</Label>
            <MentionField
              value={specialRequests}
              onChange={setSpecialRequests}
              candidates={profiles}
              placeholder="Catering preferences, ground transport, etc. Use @ to mention a teammate"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1" 
              disabled={isPending || !isValid}
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

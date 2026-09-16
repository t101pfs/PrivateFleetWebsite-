import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plane, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CUISINES, CUISINE_OPTIONS, OTHER_CUISINE, OTHER_COURSE } from '@/data/cuisines';
import pfLogo from '@/assets/pf-logo.png';

const NEW_PERSON = '__new__';

interface DinerEntry {
  key: string;
  passengerId: string; // NEW_PERSON or an existing passenger id
  customName: string;
  cuisine: string;
  course: string;
  customCourse: string;
  customRequest: string;
  appetizer: string;
  drink: string;
  dessert: string;
  hasAllergies: boolean;
  allergyDetails: string;
}

function newEntry(): DinerEntry {
  return {
    key: crypto.randomUUID(),
    passengerId: '',
    customName: '',
    cuisine: '',
    course: '',
    customCourse: '',
    customRequest: '',
    appetizer: '',
    drink: '',
    dessert: '',
    hasAllergies: false,
    allergyDetails: '',
  };
}

export default function PublicCateringForm() {
  const { flightId } = useParams<{ flightId: string }>();
  const [entries, setEntries] = useState<DinerEntry[]>([newEntry()]);
  const [submitted, setSubmitted] = useState(false);

  const { data: flight, isLoading: flightLoading } = useQuery({
    queryKey: ['catering-flight-summary', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_catering_flight_summary', { _flight_id: flightId! });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!flightId,
  });

  const { data: passengers = [] } = useQuery({
    queryKey: ['catering-passenger-names', flightId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_catering_passenger_names', { _flight_id: flightId! });
      if (error) throw error;
      return data || [];
    },
    enabled: !!flightId,
  });

  const updateEntry = (key: string, patch: Partial<DinerEntry>) => {
    setEntries((prev) => prev.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  };

  const submit = useMutation({
    mutationFn: async () => {
      const rows = entries.map((e) => {
        const name = e.passengerId === NEW_PERSON || !e.passengerId
          ? e.customName.trim()
          : passengers.find((p) => p.id === e.passengerId)?.full_name || e.customName.trim();
        if (!name) throw new Error('Enter a name for each passenger');

        if (e.hasAllergies && !e.allergyDetails.trim()) throw new Error(`Please specify ${name}'s allergies`);
        const common = {
          flight_id: flightId,
          passenger_id: e.passengerId && e.passengerId !== NEW_PERSON ? e.passengerId : null,
          diner_name: name,
          appetizer: e.appetizer.trim() || null,
          drink: e.drink.trim() || null,
          dessert: e.dessert.trim() || null,
          has_allergies: e.hasAllergies,
          allergy_details: e.hasAllergies ? e.allergyDetails.trim() : null,
        };

        if (e.cuisine === OTHER_CUISINE) {
          if (!e.customRequest.trim()) throw new Error(`Describe ${name}'s meal request`);
          return { ...common, cuisine: null, course: null, custom_request: e.customRequest.trim() };
        }
        if (!e.cuisine) throw new Error(`Choose a cuisine for ${name}`);
        const course = e.course === OTHER_COURSE ? e.customCourse.trim() : e.course;
        if (!course) throw new Error(`Choose a dish for ${name}`);
        return { ...common, cuisine: e.cuisine, course, custom_request: null };
      });

      const { error } = await supabase.from('catering_requests').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => setSubmitted(true),
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'Failed to submit'),
  });

  if (flightLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!flight) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <p className="text-muted-foreground">This catering link is invalid or has expired. Please contact Private Fleet Services directly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-3">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h1 className="text-lg font-semibold">Thank you</h1>
            <p className="text-sm text-muted-foreground">Your catering preferences have been received. Our team will take care of the rest.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 flex items-start justify-center">
      <div className="max-w-2xl w-full space-y-6 py-8">
        <div className="flex flex-col items-center text-center gap-2">
          <img src={pfLogo} alt="Private Fleet Services" className="h-16 object-contain" />
          <h1 className="text-xl font-semibold">Catering Preferences</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Plane className="h-4 w-4" />
            {flight.route_from} → {flight.route_to} · {format(new Date(flight.departure_date + 'T00:00:00'), 'MMM d, yyyy')}
          </p>
        </div>

        <div className="space-y-4">
          {entries.map((entry, idx) => {
            const courseOptions = entry.cuisine && entry.cuisine !== OTHER_CUISINE ? CUISINES[entry.cuisine] || [] : [];
            return (
              <Card key={entry.key}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Passenger {idx + 1}</CardTitle>
                    {entries.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEntries((prev) => prev.filter((e) => e.key !== entry.key))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <CardDescription>Who is this catering request for?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Select value={entry.passengerId || undefined} onValueChange={(v) => updateEntry(entry.key, { passengerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select your name" /></SelectTrigger>
                      <SelectContent>
                        {passengers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                        ))}
                        <SelectItem value={NEW_PERSON}>Someone not listed</SelectItem>
                      </SelectContent>
                    </Select>
                    {entry.passengerId === NEW_PERSON && (
                      <Input placeholder="Full name" value={entry.customName} onChange={(e) => updateEntry(entry.key, { customName: e.target.value })} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Cuisine</Label>
                    <Select value={entry.cuisine || undefined} onValueChange={(v) => updateEntry(entry.key, { cuisine: v, course: '', customCourse: '' })}>
                      <SelectTrigger><SelectValue placeholder="Choose a cuisine" /></SelectTrigger>
                      <SelectContent>
                        {CUISINE_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {entry.cuisine === OTHER_CUISINE ? (
                    <div className="space-y-2">
                      <Label>Your meal request</Label>
                      <Textarea
                        placeholder="Tell us what you'd like"
                        value={entry.customRequest}
                        onChange={(e) => updateEntry(entry.key, { customRequest: e.target.value })}
                      />
                    </div>
                  ) : entry.cuisine ? (
                    <div className="space-y-2">
                      <Label>Dish</Label>
                      <Select value={entry.course || undefined} onValueChange={(v) => updateEntry(entry.key, { course: v })}>
                        <SelectTrigger><SelectValue placeholder="Choose a dish" /></SelectTrigger>
                        <SelectContent>
                          {courseOptions.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {entry.course === OTHER_COURSE && (
                        <Input placeholder="Specify the dish" value={entry.customCourse} onChange={(e) => updateEntry(entry.key, { customCourse: e.target.value })} />
                      )}
                    </div>
                  ) : null}

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Appetizer</Label>
                      <Input placeholder="Optional" value={entry.appetizer} onChange={(e) => updateEntry(entry.key, { appetizer: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Drink</Label>
                      <Input placeholder="Optional" value={entry.drink} onChange={(e) => updateEntry(entry.key, { drink: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Dessert</Label>
                      <Input placeholder="Optional" value={entry.dessert} onChange={(e) => updateEntry(entry.key, { dessert: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <Checkbox
                        checked={entry.hasAllergies}
                        onCheckedChange={(c) => updateEntry(entry.key, { hasAllergies: c === true, allergyDetails: c === true ? entry.allergyDetails : '' })}
                      />
                      Any allergies?
                    </label>
                    {entry.hasAllergies && (
                      <Input
                        placeholder="Please specify the allergy"
                        value={entry.allergyDetails}
                        onChange={(e) => updateEntry(entry.key, { allergyDetails: e.target.value })}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button variant="outline" className="w-full" onClick={() => setEntries((prev) => [...prev, newEntry()])}>
          <Plus className="h-4 w-4 mr-2" />
          Add another passenger's request
        </Button>

        <Button className="w-full" size="lg" onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Catering Preferences
        </Button>
      </div>
    </div>
  );
}

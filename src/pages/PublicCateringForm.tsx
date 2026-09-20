import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Plane, Search, X, Check, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { WHOLE_FLIGHT_DINER } from '@/data/cuisines';
import { MENU_SECTIONS, type MenuSectionId } from '@/data/menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import pfLogo from '@/assets/pf-logo.png';

const EMPTY_SELECTION: Record<MenuSectionId, string[]> = { appetizer: [], main: [], dessert: [], drink: [] };

export default function PublicCateringForm() {
  const { flightId } = useParams<{ flightId: string }>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Record<MenuSectionId, string[]>>(EMPTY_SELECTION);
  const [activeSection, setActiveSection] = useState<MenuSectionId>('appetizer');
  const [extraRequest, setExtraRequest] = useState('');
  const [hasAllergies, setHasAllergies] = useState(false);
  const [allergyDetails, setAllergyDetails] = useState('');
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

  // While searching, look across every section; otherwise show the open one.
  const term = search.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!term) return MENU_SECTIONS.filter((section) => section.id === activeSection);
    return MENU_SECTIONS
      .map((section) => ({ ...section, items: section.items.filter((item) => item.toLowerCase().includes(term)) }))
      .filter((section) => section.items.length > 0);
  }, [term, activeSection]);

  const toggleDish = (section: MenuSectionId, dish: string) =>
    setSelected((prev) => ({
      ...prev,
      [section]: prev[section].includes(dish) ? prev[section].filter((d) => d !== dish) : [...prev[section], dish],
    }));

  const totalSelected = Object.values(selected).reduce((sum, list) => sum + list.length, 0);

  const submit = useMutation({
    mutationFn: async () => {
      const extra = extraRequest.trim();
      if (totalSelected === 0 && !extra) {
        throw new Error('Pick something from the menu, or tell us what you would like');
      }
      if (hasAllergies && !allergyDetails.trim()) throw new Error('Please specify the allergies');

      const { error } = await supabase.from('catering_requests').insert({
        flight_id: flightId!,
        passenger_id: null,
        diner_name: WHOLE_FLIGHT_DINER,
        cuisine: null,
        course: selected.main.length > 0 ? selected.main.join(', ') : null,
        custom_request: extra || null,
        appetizer: selected.appetizer.length > 0 ? selected.appetizer.join(', ') : null,
        drink: selected.drink.length > 0 ? selected.drink.join(', ') : null,
        dessert: selected.dessert.length > 0 ? selected.dessert.join(', ') : null,
        has_allergies: hasAllergies,
        allergy_details: hasAllergies ? allergyDetails.trim() : null,
      });
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
    <div className="min-h-screen bg-background p-4 sm:p-6 flex items-start justify-center">
      <div className="max-w-2xl w-full space-y-6 py-6 sm:py-8">
        <div className="flex flex-col items-center text-center gap-2">
          <img src={pfLogo} alt="Private Fleet Services" className="h-16 object-contain" />
          <h1 className="text-xl font-semibold">Catering Preferences</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Plane className="h-4 w-4" />
            {flight.route_from} → {flight.route_to} · {format(new Date(flight.departure_date + 'T00:00:00'), 'MMM d, yyyy')}
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Menu</CardTitle>
            <CardDescription>One request for everyone on the flight. Pick from each section, or search the whole menu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Search the menu"
                placeholder="Search the whole menu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {!term && (
              <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as MenuSectionId)}>
                <TabsList className="w-full">
                  {MENU_SECTIONS.map((section) => (
                    <TabsTrigger key={section.id} value={section.id} className="flex-1 gap-1 px-1.5 sm:px-3 text-[13px] sm:text-sm">
                      {section.label}
                      {selected[section.id].length > 0 && (
                        <span className="rounded-full bg-primary/15 text-primary px-1.5 text-xs">{selected[section.id].length}</span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {totalSelected > 0 && (
              <div className="space-y-2 rounded-lg bg-secondary/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Your selection</p>
                {MENU_SECTIONS.filter((section) => selected[section.id].length > 0).map((section) => (
                  <div key={section.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold w-full sm:w-auto sm:min-w-24">{section.label}</span>
                    {selected[section.id].map((dish) => (
                      <button
                        key={dish}
                        type="button"
                        onClick={() => toggleDish(section.id, dish)}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-3 py-1 text-sm"
                        aria-label={`Remove ${dish}`}
                      >
                        {dish}
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border max-h-72 overflow-y-auto">
              {visibleSections.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">
                  Nothing on the menu matches "{search}" — describe it in the box below.
                </p>
              ) : (
                visibleSections.map((section) => (
                  <div key={section.id}>
                    {term && (
                      <p className="sticky top-0 bg-secondary/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {section.label}
                      </p>
                    )}
                    <div className="divide-y">
                      {section.items.map((dish) => {
                        const isSelected = selected[section.id].includes(dish);
                        return (
                          <button
                            key={dish}
                            type="button"
                            onClick={() => toggleDish(section.id, dish)}
                            className={cn(
                              'w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-secondary/60',
                              isSelected && 'bg-primary/5 font-medium'
                            )}
                          >
                            {dish}
                            {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra-request">Anything else you'd like?</Label>
              <Textarea
                id="extra-request"
                placeholder="Tell us about any dish that isn't on the menu"
                value={extraRequest}
                onChange={(e) => setExtraRequest(e.target.value)}
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <Checkbox
                  checked={hasAllergies}
                  onCheckedChange={(c) => {
                    setHasAllergies(c === true);
                    if (c !== true) setAllergyDetails('');
                  }}
                />
                Any allergies?
              </label>
              {hasAllergies && (
                <Input
                  placeholder="Please specify the allergy"
                  value={allergyDetails}
                  onChange={(e) => setAllergyDetails(e.target.value)}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Catering Preferences
        </Button>
      </div>
    </div>
  );
}

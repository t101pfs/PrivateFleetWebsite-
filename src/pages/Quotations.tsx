import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Search,
  DollarSign,
  Plane,
  Calendar,
  Clock,
} from 'lucide-react';

interface QuoteRow {
  id: string;
  quote_number: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  flight_hours: number | null;
  total_price: number | null;
  status: string | null;
  notes: string | null;
  aircraft: { tail_number: string; aircraft_type: string } | null;
}

export default function Quotations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRateCardDialogOpen, setIsRateCardDialogOpen] = useState(false);

  // Fetch quotes
  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, aircraft(tail_number, aircraft_type), rate_cards(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as QuoteRow[];
    },
  });

  // Fetch rate cards
  const { data: rateCards = [], isLoading: rateCardsLoading } = useQuery({
    queryKey: ['rate_cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Create rate card mutation
  const createRateCard = useMutation({
    mutationFn: async (rateCardData: {
      name: string;
      aircraft_type: string;
      hourly_rate: number;
      minimum_hours: number;
      repositioning_fee: number;
      crew_overnight_rate: number;
      fuel_surcharge_percent: number;
      landing_fee_estimate: number;
      handling_fee_estimate: number;
    }) => {
      const { data, error } = await supabase
        .from('rate_cards')
        .insert([{ ...rateCardData, created_by: user?.id }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rate_cards'] });
      setIsRateCardDialogOpen(false);
      toast.success('Rate card created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create rate card: ' + error.message);
    },
  });

  const handleCreateRateCard = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createRateCard.mutate({
      name: formData.get('name') as string,
      aircraft_type: formData.get('aircraft_type') as string,
      hourly_rate: Number(formData.get('hourly_rate')),
      minimum_hours: Number(formData.get('minimum_hours')) || 2,
      repositioning_fee: Number(formData.get('repositioning_fee')) || 0,
      crew_overnight_rate: Number(formData.get('crew_overnight_rate')) || 0,
      fuel_surcharge_percent: Number(formData.get('fuel_surcharge_percent')) || 0,
      landing_fee_estimate: Number(formData.get('landing_fee_estimate')) || 0,
      handling_fee_estimate: Number(formData.get('handling_fee_estimate')) || 0,
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      sent: 'bg-accent text-accent-foreground',
      accepted: 'bg-success text-success-foreground',
      rejected: 'bg-destructive text-destructive-foreground',
      expired: 'bg-warning text-warning-foreground',
      converted: 'bg-success text-success-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const filteredQuotes = quotes.filter(quote =>
    quote.quote_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_from?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.route_to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const totalQuoteValue = quotes.reduce((sum, q) => sum + (Number(q.total_price) || 0), 0);
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted').length;
  const pendingQuotes = quotes.filter(q => q.status === 'sent').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Quotations</h1>
            <p className="text-sm md:text-base text-muted-foreground">Create and manage charter quotes</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Quotes</p>
                  <p className="text-2xl font-bold">{quotes.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <DollarSign className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">${totalQuoteValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <FileText className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold">{acceptedQuotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Clock className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingQuotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="quotes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="rate_cards">Rate Cards</TabsTrigger>
          </TabsList>

          {/* Quotes Tab */}
          <TabsContent value="quotes" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search quotes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-right">
                Quotes are generated from the Sourcing Workspace once an option is approved — accept a request, add operator options, then Prepare Quotation.
              </p>
            </div>

            <div className="grid gap-4">
              {quotesLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredQuotes.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No quotes found</CardContent></Card>
              ) : (
                filteredQuotes.map(quote => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <FileText className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{quote.quote_number}</h3>
                            <p className="text-sm text-muted-foreground">
                              {quote.aircraft
                                ? `${quote.aircraft.tail_number} - ${quote.aircraft.aircraft_type}`
                                : quote.notes || 'Operator option'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span className="flex items-center gap-1">
                                <Plane className="h-3 w-3" />
                                {quote.route_from} → {quote.route_to}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(quote.departure_date).toLocaleDateString()}
                              </span>
                              {quote.flight_hours && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {quote.flight_hours}h
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(quote.status || 'draft')}>
                            {quote.status}
                          </Badge>
                          <p className="text-xl font-bold text-accent mt-2">
                            ${Number(quote.total_price).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Rate Cards Tab */}
          <TabsContent value="rate_cards" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isRateCardDialogOpen} onOpenChange={setIsRateCardDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rate Card
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add New Rate Card</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateRateCard} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" name="name" required placeholder="e.g., G650 Standard" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aircraft_type">Aircraft Type</Label>
                        <Input id="aircraft_type" name="aircraft_type" placeholder="e.g., G650" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hourly_rate">Hourly Rate ($) *</Label>
                        <Input id="hourly_rate" name="hourly_rate" type="number" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minimum_hours">Minimum Hours</Label>
                        <Input id="minimum_hours" name="minimum_hours" type="number" defaultValue={2} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="repositioning_fee">Repositioning Fee ($)</Label>
                        <Input id="repositioning_fee" name="repositioning_fee" type="number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="crew_overnight_rate">Crew Overnight ($)</Label>
                        <Input id="crew_overnight_rate" name="crew_overnight_rate" type="number" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fuel_surcharge_percent">Fuel Surcharge (%)</Label>
                        <Input id="fuel_surcharge_percent" name="fuel_surcharge_percent" type="number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="landing_fee_estimate">Landing Fee ($)</Label>
                        <Input id="landing_fee_estimate" name="landing_fee_estimate" type="number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="handling_fee_estimate">Handling Fee ($)</Label>
                        <Input id="handling_fee_estimate" name="handling_fee_estimate" type="number" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={createRateCard.isPending}>
                      {createRateCard.isPending ? 'Creating...' : 'Create Rate Card'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rateCardsLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : rateCards.length === 0 ? (
                <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No rate cards found</CardContent></Card>
              ) : (
                rateCards.map(rc => (
                  <Card key={rc.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{rc.name}</CardTitle>
                        <Badge variant={rc.is_active ? 'default' : 'secondary'}>
                          {rc.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {rc.aircraft_type && (
                        <p className="text-sm text-muted-foreground">{rc.aircraft_type}</p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Hourly Rate</span>
                          <span className="font-semibold text-accent">${Number(rc.hourly_rate).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Min Hours</span>
                          <span>{rc.minimum_hours}h</span>
                        </div>
                        {Number(rc.repositioning_fee) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Repositioning</span>
                            <span>${Number(rc.repositioning_fee).toLocaleString()}</span>
                          </div>
                        )}
                        {Number(rc.fuel_surcharge_percent) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Fuel Surcharge</span>
                            <span>{rc.fuel_surcharge_percent}%</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

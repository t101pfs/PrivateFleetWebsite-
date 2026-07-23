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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Plane, 
  Plus, 
  Search,
  Building2,
  Calendar,
  MapPin,
  Users,
  Gauge,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function AircraftCatalog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAircraftDialogOpen, setIsAircraftDialogOpen] = useState(false);
  const [isOperatorDialogOpen, setIsOperatorDialogOpen] = useState(false);
  const [expandedOperatorId, setExpandedOperatorId] = useState<string | null>(null);

  // Fetch aircraft
  const { data: aircraft = [], isLoading: aircraftLoading } = useQuery({
    queryKey: ['aircraft'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('aircraft')
        .select('*, operators(name)')
        .order('tail_number');
      if (error) throw error;
      return data;
    },
  });

  // Fetch operators
  const { data: operators = [], isLoading: operatorsLoading } = useQuery({
    queryKey: ['operators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('operators')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });


  // Create aircraft mutation
  const createAircraft = useMutation({
    mutationFn: async (aircraftData: {
      operator_id?: string;
      tail_number: string;
      aircraft_type: string;
      manufacturer?: string;
      model?: string;
      year_of_manufacture?: number;
      seating_capacity?: number;
      max_range_nm?: number;
      cruise_speed_kts?: number;
      base_airport?: string;
      home_base_icao?: string;
      hourly_rate?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('aircraft')
        .insert([aircraftData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aircraft'] });
      setIsAircraftDialogOpen(false);
      toast.success('Aircraft added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add aircraft: ' + error.message);
    },
  });

  // Create operator mutation
  const createOperator = useMutation({
    mutationFn: async (operatorData: {
      name: string;
      aoc_number?: string;
      country?: string;
      contact_email?: string;
      contact_phone?: string;
      insurance_expiry?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('operators')
        .insert([operatorData])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operators'] });
      setIsOperatorDialogOpen(false);
      toast.success('Operator added successfully');
    },
    onError: (error) => {
      toast.error('Failed to add operator: ' + error.message);
    },
  });


  const handleCreateAircraft = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAircraft.mutate({
      operator_id: formData.get('operator_id') as string || undefined,
      tail_number: formData.get('tail_number') as string,
      aircraft_type: formData.get('aircraft_type') as string,
      manufacturer: formData.get('manufacturer') as string || undefined,
      model: formData.get('model') as string || undefined,
      year_of_manufacture: formData.get('year_of_manufacture') ? Number(formData.get('year_of_manufacture')) : undefined,
      seating_capacity: formData.get('seating_capacity') ? Number(formData.get('seating_capacity')) : undefined,
      max_range_nm: formData.get('max_range_nm') ? Number(formData.get('max_range_nm')) : undefined,
      cruise_speed_kts: formData.get('cruise_speed_kts') ? Number(formData.get('cruise_speed_kts')) : undefined,
      base_airport: formData.get('base_airport') as string || undefined,
      home_base_icao: formData.get('home_base_icao') as string || undefined,
      hourly_rate: formData.get('hourly_rate') ? Number(formData.get('hourly_rate')) : undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };

  const handleCreateOperator = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createOperator.mutate({
      name: formData.get('name') as string,
      aoc_number: formData.get('aoc_number') as string || undefined,
      country: formData.get('country') as string || undefined,
      contact_email: formData.get('contact_email') as string || undefined,
      contact_phone: formData.get('contact_phone') as string || undefined,
      insurance_expiry: formData.get('insurance_expiry') as string || undefined,
      notes: formData.get('notes') as string || undefined,
    });
  };


  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: 'bg-success text-success-foreground',
      in_flight: 'bg-accent text-accent-foreground',
      maintenance: 'bg-warning text-warning-foreground',
      reserved: 'bg-primary text-primary-foreground',
      inactive: 'bg-muted text-muted-foreground',
      active: 'bg-success text-success-foreground',
      pending: 'bg-warning text-warning-foreground',
      scheduled: 'bg-accent text-accent-foreground',
      in_progress: 'bg-warning text-warning-foreground',
      completed: 'bg-success text-success-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const filteredAircraft = aircraft.filter(ac =>
    ac.tail_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ac.aircraft_type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const availableAircraft = aircraft.filter(a => a.status === 'available').length;
  const activeOperators = operators.filter(o => o.status === 'active').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Aircraft Catalog</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage aircraft and operators</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Aircraft</p>
                  <p className="text-2xl font-bold">{aircraft.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Plane className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{availableAircraft}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Building2 className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Operators</p>
                  <p className="text-2xl font-bold">{activeOperators}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="aircraft" className="space-y-4">
          <TabsList>
            <TabsTrigger value="aircraft">Aircraft</TabsTrigger>
            <TabsTrigger value="operators">Operators</TabsTrigger>
          </TabsList>

          {/* Aircraft Tab */}
          <TabsContent value="aircraft" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search aircraft..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={isAircraftDialogOpen} onOpenChange={setIsAircraftDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Aircraft
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Aircraft</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateAircraft} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="tail_number">Tail Number *</Label>
                        <Input id="tail_number" name="tail_number" required placeholder="N123AB" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aircraft_type">Aircraft Type *</Label>
                        <Input id="aircraft_type" name="aircraft_type" required placeholder="G650" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="operator_id">Operator</Label>
                      <Select name="operator_id">
                        <SelectTrigger>
                          <SelectValue placeholder="Select operator" />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map(op => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="manufacturer">Manufacturer</Label>
                        <Input id="manufacturer" name="manufacturer" placeholder="Gulfstream" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="model">Model</Label>
                        <Input id="model" name="model" placeholder="G650ER" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="year_of_manufacture">Year</Label>
                        <Input id="year_of_manufacture" name="year_of_manufacture" type="number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="seating_capacity">Seats</Label>
                        <Input id="seating_capacity" name="seating_capacity" type="number" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_range_nm">Range (NM)</Label>
                        <Input id="max_range_nm" name="max_range_nm" type="number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cruise_speed_kts">Speed (KTS)</Label>
                        <Input id="cruise_speed_kts" name="cruise_speed_kts" type="number" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="base_airport">Base Airport</Label>
                        <Input id="base_airport" name="base_airport" placeholder="Dubai" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="home_base_icao">Base ICAO</Label>
                        <Input id="home_base_icao" name="home_base_icao" placeholder="OMDB" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                      <Input id="hourly_rate" name="hourly_rate" type="number" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea id="notes" name="notes" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createAircraft.isPending}>
                      {createAircraft.isPending ? 'Adding...' : 'Add Aircraft'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {aircraftLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredAircraft.length === 0 ? (
                <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">No aircraft found</CardContent></Card>
              ) : (
                filteredAircraft.map(ac => (
                  <Card key={ac.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Plane className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{ac.tail_number}</CardTitle>
                            <p className="text-sm text-muted-foreground">{ac.aircraft_type}</p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(ac.status || 'available')}>
                          {ac.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {(ac.operators as any)?.name && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            {(ac.operators as any).name}
                          </div>
                        )}
                        {ac.home_base_icao && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {ac.base_airport || ac.home_base_icao}
                          </div>
                        )}
                        <div className="flex items-center gap-4 pt-2">
                          {ac.seating_capacity && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {ac.seating_capacity} seats
                            </span>
                          )}
                          {ac.max_range_nm && (
                            <span className="flex items-center gap-1">
                              <Gauge className="h-3 w-3" />
                              {ac.max_range_nm} NM
                            </span>
                          )}
                        </div>
                        {ac.hourly_rate && (
                          <p className="font-semibold text-accent pt-2">
                            ${Number(ac.hourly_rate).toLocaleString()}/hr
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Operators Tab */}
          <TabsContent value="operators" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isOperatorDialogOpen} onOpenChange={setIsOperatorDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Operator
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Operator</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateOperator} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="op_name">Company Name *</Label>
                      <Input id="op_name" name="name" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="aoc_number">AOC Number</Label>
                        <Input id="aoc_number" name="aoc_number" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input id="country" name="country" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="contact_email">Email</Label>
                        <Input id="contact_email" name="contact_email" type="email" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="contact_phone">Phone</Label>
                        <Input id="contact_phone" name="contact_phone" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="insurance_expiry">Insurance Expiry</Label>
                      <Input id="insurance_expiry" name="insurance_expiry" type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="op_notes">Notes</Label>
                      <Textarea id="op_notes" name="notes" />
                    </div>
                    <Button type="submit" className="w-full" disabled={createOperator.isPending}>
                      {createOperator.isPending ? 'Adding...' : 'Add Operator'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {operatorsLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : operators.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No operators found</CardContent></Card>
              ) : (
                operators.map(op => {
                  const operatorAircraft = aircraft.filter(ac => ac.operator_id === op.id);
                  const isExpanded = expandedOperatorId === op.id;
                  return (
                    <Card key={op.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div
                          className="flex items-start justify-between cursor-pointer"
                          onClick={() => setExpandedOperatorId(isExpanded ? null : op.id)}
                        >
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-accent/10">
                              <Building2 className="h-6 w-6 text-accent" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{op.name}</h3>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                {op.aoc_number && <span>AOC: {op.aoc_number}</span>}
                                {op.country && <span>{op.country}</span>}
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {op.contact_email && <span>{op.contact_email}</span>}
                                {op.contact_phone && <span>{op.contact_phone}</span>}
                              </div>
                              {op.insurance_expiry && (
                                <div className="flex items-center gap-1 mt-2 text-sm">
                                  <Calendar className="h-3 w-3" />
                                  Insurance expires: {new Date(op.insurance_expiry).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Plane className="h-3 w-3 mr-1" />
                              {operatorAircraft.length} aircraft
                            </Badge>
                            <Badge className={getStatusColor(op.status || 'active')}>
                              {op.status}
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Fleet Section */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-border">
                            <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                              <Plane className="h-4 w-4" />
                              Fleet ({operatorAircraft.length})
                            </h4>
                            {operatorAircraft.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No aircraft linked to this operator yet.
                              </p>
                            ) : (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {operatorAircraft.map(ac => (
                                  <div
                                    key={ac.id}
                                    className="p-3 rounded-lg border border-border bg-secondary/30 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-sm font-semibold">{ac.tail_number}</span>
                                      <Badge className={getStatusColor(ac.status || 'available')} variant="secondary">
                                        {ac.status?.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-foreground">{ac.aircraft_type}</p>
                                    {(ac.manufacturer || ac.model) && (
                                      <p className="text-xs text-muted-foreground">
                                        {[ac.manufacturer, ac.model].filter(Boolean).join(' ')}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                                      {ac.seating_capacity && (
                                        <span className="flex items-center gap-1">
                                          <Users className="h-3 w-3" /> {ac.seating_capacity}
                                        </span>
                                      )}
                                      {ac.base_airport && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" /> {ac.base_airport}
                                        </span>
                                      )}
                                      {ac.max_range_nm && (
                                        <span className="flex items-center gap-1">
                                          <Gauge className="h-3 w-3" /> {ac.max_range_nm} NM
                                        </span>
                                      )}
                                    </div>
                                    {ac.hourly_rate && (
                                      <p className="text-sm font-semibold text-accent">
                                        ${Number(ac.hourly_rate).toLocaleString()}/hr
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}

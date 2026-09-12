import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AddEditAircraftDialog, type AircraftRow } from '@/components/aircraft/AddEditAircraftDialog';
import { AddEditOperatorDialog, type OperatorRow } from '@/components/aircraft/AddEditOperatorDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Plane,
  MapPin,
  Users,
  Building2,
  Mail,
  Phone,
  Pencil,
} from 'lucide-react';

const AIRCRAFT_STATUS_BADGE: Record<string, string> = {
  available: 'bg-success/10 text-success',
  maintenance: 'bg-warning/10 text-warning',
  unavailable: 'bg-muted text-muted-foreground',
};

const OPERATOR_STATUS_BADGE: Record<string, string> = {
  active: 'bg-success/10 text-success',
  inactive: 'bg-muted text-muted-foreground',
};

export default function Aircraft() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewAircraft, setViewAircraft] = useState<AircraftRow | null>(null);
  const [editAircraft, setEditAircraft] = useState<AircraftRow | null>(null);
  const [aircraftDialogOpen, setAircraftDialogOpen] = useState(false);
  const [editOperator, setEditOperator] = useState<OperatorRow | null>(null);
  const [operatorDialogOpen, setOperatorDialogOpen] = useState(false);

  const { data: aircraft = [], isLoading: aircraftLoading } = useQuery({
    queryKey: ['aircraft-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('aircraft').select('*').order('tail_number');
      if (error) throw error;
      return data as AircraftRow[];
    },
  });

  const { data: operators = [], isLoading: operatorsLoading } = useQuery({
    queryKey: ['operators-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operators').select('*').order('name');
      if (error) throw error;
      return data as OperatorRow[];
    },
  });

  const operatorById = useMemo(() => new Map(operators.map((op) => [op.id, op])), [operators]);
  const aircraftCountByOperator = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ac of aircraft) {
      if (!ac.operator_id) continue;
      counts.set(ac.operator_id, (counts.get(ac.operator_id) || 0) + 1);
    }
    return counts;
  }, [aircraft]);

  const filteredAircraft = aircraft.filter((ac) =>
    [ac.tail_number, ac.model, ac.manufacturer, ac.aircraft_type].some((v) => v?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredOperators = operators.filter((op) =>
    [op.name, op.contact_email, op.country].some((v) => v?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAddAircraft = () => { setEditAircraft(null); setAircraftDialogOpen(true); };
  const openEditAircraft = (ac: AircraftRow) => { setEditAircraft(ac); setAircraftDialogOpen(true); };
  const openAddOperator = () => { setEditOperator(null); setOperatorDialogOpen(true); };
  const openEditOperator = (op: OperatorRow) => { setEditOperator(op); setOperatorDialogOpen(true); };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Aircraft & Operators</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage your fleet and operator partnerships
            </p>
          </div>
        </div>

        <Tabs defaultValue="aircraft" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <TabsList className="bg-secondary w-full md:w-auto overflow-x-auto">
              <TabsTrigger value="aircraft" className="gap-2">
                <Plane className="h-4 w-4" />
                Aircraft
              </TabsTrigger>
              <TabsTrigger value="operators" className="gap-2">
                <Building2 className="h-4 w-4" />
                Operators
              </TabsTrigger>
            </TabsList>
            <div className="flex gap-2 md:gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <TabsContent value="aircraft" className="mt-0 space-y-4">
            <div className="flex justify-end">
              <Button onClick={openAddAircraft} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
                <Plus className="h-5 w-5" />
                Add Aircraft
              </Button>
            </div>

            {aircraftLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading fleet...</div>
            ) : filteredAircraft.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {aircraft.length === 0 ? 'No aircraft on file yet — add your first one.' : 'No aircraft match your search.'}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAircraft.map((ac) => {
                  const operator = ac.operator_id ? operatorById.get(ac.operator_id) : undefined;
                  return (
                    <div
                      key={ac.id}
                      className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all duration-300 hover:border-primary/20"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs text-muted-foreground">{ac.tail_number}</span>
                            <Badge variant="outline" className="text-xs">{ac.aircraft_type}</Badge>
                          </div>
                          <h3 className="font-display font-semibold text-lg text-foreground">
                            {ac.model || 'Unnamed model'}
                          </h3>
                        </div>
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          {ac.images?.[0] ? (
                            <img src={ac.images[0]} alt={ac.tail_number} className="h-full w-full object-cover rounded-xl" />
                          ) : (
                            <Plane className="h-6 w-6 text-primary" />
                          )}
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        {ac.base_airport && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span>Base: <span className="text-foreground font-medium">{ac.base_airport}</span></span>
                          </div>
                        )}
                        {ac.seating_capacity != null && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>Capacity: <span className="text-foreground font-medium">{ac.seating_capacity} passengers</span></span>
                          </div>
                        )}
                        {operator && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-4 w-4" />
                            <span>Operator: <span className="text-foreground font-medium">{operator.name}</span></span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                        <Badge variant="secondary" className={`text-xs border-0 ${AIRCRAFT_STATUS_BADGE[ac.status || 'available']}`}>
                          {ac.status === 'maintenance' ? 'In Maintenance' : ac.status === 'unavailable' ? 'Unavailable' : 'Available'}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setViewAircraft(ac)}>View Details</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditAircraft(ac)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="operators" className="mt-0 space-y-4">
            <div className="flex justify-end">
              <Button onClick={openAddOperator} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
                <Plus className="h-5 w-5" />
                Add Operator
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden overflow-x-auto">
              {operatorsLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading operators...</div>
              ) : filteredOperators.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {operators.length === 0 ? 'No operators on file yet — add your first one.' : 'No operators match your search.'}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operator</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aircraft</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOperators.map((operator) => (
                      <tr key={operator.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="h-5 w-5 text-primary" />
                            </div>
                            <span className="font-semibold text-foreground">{operator.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {operator.contact_email && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {operator.contact_email}
                              </span>
                            )}
                            {operator.contact_phone && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {operator.contact_phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-lg font-bold text-foreground">{aircraftCountByOperator.get(operator.id) || 0}</span>
                          <span className="text-sm text-muted-foreground ml-1">aircraft</span>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="secondary" className={`border-0 ${OPERATOR_STATUS_BADGE[operator.status || 'active']}`}>
                            {operator.status === 'inactive' ? 'Inactive' : 'Active Partner'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditOperator(operator)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Aircraft Detail Dialog */}
        <Dialog open={!!viewAircraft} onOpenChange={(open) => !open && setViewAircraft(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                {viewAircraft?.model || viewAircraft?.tail_number}
              </DialogTitle>
            </DialogHeader>
            {viewAircraft && (
              <div className="space-y-4">
                {viewAircraft.images && viewAircraft.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {viewAircraft.images.map((url) => (
                      <img key={url} src={url} alt={viewAircraft.tail_number} className="h-24 w-32 object-cover rounded-md border border-border shrink-0" />
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Tail Number</p>
                    <p className="font-mono font-medium">{viewAircraft.tail_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{viewAircraft.aircraft_type}</p>
                  </div>
                  {viewAircraft.base_airport && (
                    <div>
                      <p className="text-sm text-muted-foreground">Base Airport</p>
                      <p className="font-medium">{viewAircraft.base_airport}</p>
                    </div>
                  )}
                  {viewAircraft.seating_capacity != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Capacity</p>
                      <p className="font-medium">{viewAircraft.seating_capacity} passengers</p>
                    </div>
                  )}
                  {viewAircraft.cruise_speed_kts != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Cruise Speed</p>
                      <p className="font-medium">{viewAircraft.cruise_speed_kts} kts</p>
                    </div>
                  )}
                  {viewAircraft.max_range_nm != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Max Range</p>
                      <p className="font-medium">{viewAircraft.max_range_nm} nm</p>
                    </div>
                  )}
                  {viewAircraft.hourly_rate != null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Hourly Rate</p>
                      <p className="font-medium">${viewAircraft.hourly_rate.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                {viewAircraft.notes && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{viewAircraft.notes}</p>
                  </div>
                )}
                {viewAircraft.operator_id && operatorById.get(viewAircraft.operator_id) && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Operator</p>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{operatorById.get(viewAircraft.operator_id)!.name}</p>
                        {operatorById.get(viewAircraft.operator_id)!.contact_email && (
                          <p className="text-sm text-muted-foreground">{operatorById.get(viewAircraft.operator_id)!.contact_email}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AddEditAircraftDialog aircraft={editAircraft} open={aircraftDialogOpen} onOpenChange={setAircraftDialogOpen} />
        <AddEditOperatorDialog operator={editOperator} open={operatorDialogOpen} onOpenChange={setOperatorDialogOpen} />
      </div>
    </DashboardLayout>
  );
}

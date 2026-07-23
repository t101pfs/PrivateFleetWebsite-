import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { mockAircraft, mockOperators } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Filter, 
  Plane, 
  MapPin, 
  Users,
  Building2,
  Phone,
  Mail,
  MoreHorizontal
} from 'lucide-react';

export default function Aircraft() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAircraft, setSelectedAircraft] = useState<typeof mockAircraft[0] | null>(null);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Aircraft & Operators</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage your fleet and operator partnerships
            </p>
          </div>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 w-full sm:w-auto" size="lg">
            <Plus className="h-5 w-5" />
            Add Aircraft
          </Button>
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
              <Button variant="outline" size="icon" className="shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <TabsContent value="aircraft" className="mt-0">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mockAircraft.map((aircraft) => {
                const operator = mockOperators.find(op => op.id === aircraft.operatorId);
                return (
                  <div
                    key={aircraft.id}
                    className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-all duration-300 hover:border-primary/20"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {aircraft.registration}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {aircraft.type}
                          </Badge>
                        </div>
                        <h3 className="font-display font-semibold text-lg text-foreground">
                          {aircraft.model}
                        </h3>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Plane className="h-6 w-6 text-primary" />
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>Base: <span className="text-foreground font-medium">{aircraft.baseLocation}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Capacity: <span className="text-foreground font-medium">{aircraft.capacity} passengers</span></span>
                      </div>
                      {operator && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Building2 className="h-4 w-4" />
                          <span>Operator: <span className="text-foreground font-medium">{operator.name}</span></span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                      <Badge variant="secondary" className="text-xs bg-success/10 text-success border-0">
                        Available
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedAircraft(aircraft)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="operators" className="mt-0">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Operator
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Aircraft
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mockOperators.map((operator) => (
                    <tr 
                      key={operator.id}
                      className="hover:bg-secondary/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <span className="font-semibold text-foreground">{operator.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-foreground">{operator.contactName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {operator.contactEmail}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-lg font-bold text-foreground">{operator.aircraftCount}</span>
                        <span className="text-sm text-muted-foreground ml-1">aircraft</span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="bg-success/10 text-success border-0">
                          Active Partner
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Aircraft Detail Dialog */}
        <Dialog open={!!selectedAircraft} onOpenChange={(open) => !open && setSelectedAircraft(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                {selectedAircraft?.model}
              </DialogTitle>
            </DialogHeader>
            {selectedAircraft && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Registration</p>
                    <p className="font-mono font-medium">{selectedAircraft.registration}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedAircraft.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Base Location</p>
                    <p className="font-medium">{selectedAircraft.baseLocation}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Capacity</p>
                    <p className="font-medium">{selectedAircraft.capacity} passengers</p>
                  </div>
                </div>
                {(() => {
                  const operator = mockOperators.find(op => op.id === selectedAircraft.operatorId);
                  return operator ? (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Operator</p>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{operator.name}</p>
                          <p className="text-sm text-muted-foreground">{operator.contactEmail}</p>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

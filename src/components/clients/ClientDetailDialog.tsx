import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Plane, 
  Calendar,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';

interface Client {
  id: string;
  company_name: string;
  client_type?: string;
  email?: string;
  phone?: string;
  mobile_number?: string;
  company_website?: string;
  address?: string;
  contact_name?: string;
  title?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  pa_name?: string;
  pa_contact?: string;
  status?: string;
  created_at?: string;
}

interface ClientDetailDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientDetailDialog({ client, open, onOpenChange }: ClientDetailDialogProps) {
  // Fetch flight requests for this client
  const { data: flightRequests = [] } = useQuery({
    queryKey: ['client-flights', client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  // Fetch original lead if this client was converted from a lead
  const { data: originalLead } = useQuery({
    queryKey: ['client-lead-origin', client?.id],
    queryFn: async () => {
      if (!client?.id) return null;
      const { data, error } = await supabase
        .from('leads')
        .select('*, flight_requests:flight_requests(count)')
        .eq('converted_to_client_id', client.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id && open,
  });

  if (!client) return null;

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-success text-success-foreground',
      completed: 'bg-success text-success-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
      new: 'bg-accent text-accent-foreground',
      in_progress: 'bg-warning text-warning-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const confirmedFlights = flightRequests.filter(f => 
    f.status_sales === 'confirmed' || f.status_sales === 'completed'
  );
  const lostFlights = flightRequests.filter(f => f.status_sales === 'cancelled');
  const activeFlights = flightRequests.filter(f => 
    !['confirmed', 'completed', 'cancelled'].includes(f.status_sales)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {client.client_type === 'B-C' ? (
              <User className="h-5 w-5 text-primary" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
            {client.company_name}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Client Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{client.client_type || 'N/A'}</Badge>
                <Badge className={getStatusBadge(client.status || 'active')}>
                  {client.status || 'active'}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {client.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {client.email}
                  </div>
                )}
                {(client.mobile_number || client.phone) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {client.mobile_number || client.phone}
                  </div>
                )}
                {client.company_website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    {client.company_website}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {client.address}
                  </div>
                )}
              </div>

              {client.pa_name && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">PA:</span> {client.pa_name} 
                  {client.pa_contact && ` • ${client.pa_contact}`}
                </div>
              )}
            </div>

            <Separator />

            {/* Flight Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-2xl font-bold">{confirmedFlights.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-2xl font-bold">{activeFlights.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Active</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-2xl font-bold">{lostFlights.length}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Lost</p>
                </CardContent>
              </Card>
            </div>

            {/* Lead Origin Info */}
            {originalLead && (
              <>
                <Separator />
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      Converted from lead on {format(new Date(originalLead.converted_at), 'MMM d, yyyy')}
                      {originalLead.source && ` • Source: ${originalLead.source}`}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            <Separator />

            {/* Flight History */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Plane className="h-4 w-4" />
                Flight Request History ({flightRequests.length})
              </h3>
              
              {flightRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No flight requests yet
                </p>
              ) : (
                <div className="space-y-2">
                  {flightRequests.map((flight) => (
                    <Card key={flight.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="text-sm font-medium">
                              {flight.route_from} → {flight.route_to}
                            </div>
                            <Badge className={getStatusBadge(flight.status_sales)} variant="secondary">
                              {flight.status_sales}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(flight.departure_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {flight.passengers} pax • Created {format(new Date(flight.created_at), 'MMM d, yyyy')}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

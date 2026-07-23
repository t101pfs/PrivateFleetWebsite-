import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { 
  Building2, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  Plane, 
  Calendar,
  UserCheck,
  Clock,
  FileText
} from 'lucide-react';

interface Lead {
  id: string;
  company_name?: string;
  lead_type?: string;
  email?: string;
  phone?: string;
  mobile_number?: string;
  company_website?: string;
  address?: string;
  title?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  pa_name?: string;
  pa_contact?: string;
  source?: string;
  description?: string;
  status?: string;
  created_at?: string;
  converted_to_client_id?: string;
  converted_at?: string;
}

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailDialog({ lead, open, onOpenChange }: LeadDetailDialogProps) {
  const queryClient = useQueryClient();
  
  // Fetch flight requests for this lead
  const { data: flightRequests = [] } = useQuery({
    queryKey: ['lead-flights', lead?.id],
    queryFn: async () => {
      if (!lead?.id) return [];
      const { data, error } = await supabase
        .from('flight_requests')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!lead?.id && open,
  });

  // Convert lead to client mutation
  const convertToClient = useMutation({
    mutationFn: async () => {
      if (!lead?.id) throw new Error('No lead selected');
      
      const { data, error } = await supabase
        .rpc('convert_lead_to_client', { p_lead_id: lead.id });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Lead converted to client successfully!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to convert lead: ' + error.message);
    },
  });

  if (!lead) return null;

  const isConverted = !!lead.converted_to_client_id;
  const displayName = lead.company_name || 
    [lead.title, lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ');

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-success text-success-foreground',
      completed: 'bg-success text-success-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
      new: 'bg-accent text-accent-foreground',
      in_progress: 'bg-warning text-warning-foreground',
      converted: 'bg-success text-success-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lead.lead_type === 'B-C' ? (
              <User className="h-5 w-5 text-accent" />
            ) : (
              <Building2 className="h-5 w-5 text-accent" />
            )}
            {displayName}
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Lead Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{lead.lead_type || 'N/A'}</Badge>
                <Badge className={getStatusBadge(lead.status || 'new')}>
                  {lead.status || 'new'}
                </Badge>
                {lead.source && (
                  <Badge variant="secondary">Source: {lead.source}</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                {lead.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {lead.email}
                  </div>
                )}
                {lead.mobile_number && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {lead.mobile_number}
                  </div>
                )}
                {lead.company_website && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    {lead.company_website}
                  </div>
                )}
                {lead.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {lead.address}
                  </div>
                )}
              </div>

              {lead.pa_name && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">PA:</span> {lead.pa_name} 
                  {lead.pa_contact && ` • ${lead.pa_contact}`}
                </div>
              )}

              {lead.description && (
                <div className="text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <FileText className="h-4 w-4" />
                    Notes
                  </div>
                  <p className="text-muted-foreground pl-6">{lead.description}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Request Stats */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Plane className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-semibold text-lg">{flightRequests.length}</div>
                      <div className="text-xs text-muted-foreground">
                        Flight request{flightRequests.length !== 1 ? 's' : ''} received
                      </div>
                    </div>
                  </div>
                  {!isConverted && flightRequests.length > 0 && (
                    <Button 
                      onClick={() => convertToClient.mutate()}
                      disabled={convertToClient.isPending}
                      className="gap-2"
                    >
                      <UserCheck className="h-4 w-4" />
                      {convertToClient.isPending ? 'Converting...' : 'Convert to Client'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {isConverted && lead.converted_at && (
              <Card className="bg-success/10 border-success/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-success">
                    <UserCheck className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Converted to client on {format(new Date(lead.converted_at), 'MMMM d, yyyy')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Flight Request History */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Request History
              </h3>
              
              {flightRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No flight requests yet from this lead
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

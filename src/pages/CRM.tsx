import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientTypeForm } from '@/components/clients/ClientTypeForm';
import { ClientDetailDialog } from '@/components/clients/ClientDetailDialog';
import { LeadTypeForm } from '@/components/leads/LeadTypeForm';
import { LeadDetailDialog } from '@/components/leads/LeadDetailDialog';
import { 
  Users, 
  Plus, 
  Search, 
  Building2, 
  Mail, 
  Phone, 
  Target,
  User,
  Plane
} from 'lucide-react';

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // Fetch clients
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch leads with request counts
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .is('converted_to_client_id', null) // Only show non-converted leads
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch flight request counts per lead
  const { data: leadRequestCounts = {} } = useQuery({
    queryKey: ['lead-request-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('lead_id')
        .not('lead_id', 'is', null);
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data.forEach(req => {
        if (req.lead_id) {
          counts[req.lead_id] = (counts[req.lead_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-accent text-accent-foreground',
      contacted: 'bg-warning text-warning-foreground',
      qualified: 'bg-success text-success-foreground',
      proposal: 'bg-primary text-primary-foreground',
      won: 'bg-success text-success-foreground',
      lost: 'bg-destructive text-destructive-foreground',
      converted: 'bg-success text-success-foreground',
      active: 'bg-success text-success-foreground',
      inactive: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getLeadTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'B-B': 'bg-blue-100 text-blue-800 border-blue-200',
      'B-G': 'bg-amber-100 text-amber-800 border-amber-200',
      'B-C': 'bg-purple-100 text-purple-800 border-purple-200',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  const filteredClients = clients.filter(client => 
    client.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLeads = leads.filter(lead => 
    lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const activeLeads = leads.filter(l => !['converted', 'lost'].includes(l.status || '')).length;
  const totalRequests = Object.values(leadRequestCounts).reduce((a, b) => a + b, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">CRM</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage clients and leads</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <p className="text-2xl font-bold">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Leads</p>
                  <p className="text-2xl font-bold">{activeLeads}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Plane className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lead Requests</p>
                  <p className="text-2xl font-bold">{totalRequests}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="clients" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setIsClientDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
              <ClientTypeForm 
                open={isClientDialogOpen} 
                onOpenChange={setIsClientDialogOpen}
              />
            </div>

            <div className="grid gap-4">
              {clientsLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredClients.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No clients found</CardContent></Card>
              ) : (
                filteredClients.map(client => (
                  <Card 
                    key={client.id} 
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-lg bg-primary/10">
                            {client.client_type === 'B-C' ? (
                              <User className="h-6 w-6 text-primary" />
                            ) : (
                              <Building2 className="h-6 w-6 text-primary" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{client.company_name}</h3>
                            {client.contact_name && (
                              <p className="text-sm text-muted-foreground">{client.contact_name}</p>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              {client.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {client.email}
                                </span>
                              )}
                              {(client.mobile_number || client.phone) && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {client.mobile_number || client.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {client.client_type && (
                            <Badge variant="outline" className={getLeadTypeColor(client.client_type)}>
                              {client.client_type}
                            </Badge>
                          )}
                          <Badge className={getStatusColor(client.status || 'active')}>
                            {client.status || 'active'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Leads Tab */}
          <TabsContent value="leads" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setIsLeadDialogOpen(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
              <LeadTypeForm 
                open={isLeadDialogOpen} 
                onOpenChange={setIsLeadDialogOpen}
              />
            </div>

            <div className="grid gap-4">
              {leadsLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredLeads.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No leads found</CardContent></Card>
              ) : (
                filteredLeads.map(lead => {
                  const requestCount = leadRequestCounts[lead.id] || 0;
                  const displayName = lead.company_name || 
                    [lead.title, lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ');
                  
                  return (
                    <Card 
                      key={lead.id} 
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-accent/10">
                              {lead.lead_type === 'B-C' ? (
                                <User className="h-6 w-6 text-accent" />
                              ) : (
                                <Building2 className="h-6 w-6 text-accent" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{displayName}</h3>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                {lead.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {lead.email}
                                  </span>
                                )}
                                {lead.mobile_number && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {lead.mobile_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-sm">
                                {lead.source && (
                                  <span className="text-muted-foreground">
                                    Source: {lead.source}
                                  </span>
                                )}
                                {requestCount > 0 && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Plane className="h-3 w-3" />
                                    {requestCount} request{requestCount !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {lead.lead_type && (
                              <Badge variant="outline" className={getLeadTypeColor(lead.lead_type)}>
                                {lead.lead_type}
                              </Badge>
                            )}
                            <Badge className={getStatusColor(lead.status || 'new')}>
                              {lead.status || 'new'}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Detail Dialogs */}
        <ClientDetailDialog 
          client={selectedClient}
          open={!!selectedClient}
          onOpenChange={(open) => !open && setSelectedClient(null)}
        />
        <LeadDetailDialog 
          lead={selectedLead}
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
        />
      </div>
    </DashboardLayout>
  );
}

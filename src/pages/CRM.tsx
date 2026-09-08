import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClientTypeForm } from '@/components/clients/ClientTypeForm';
import { ClientDetailDialog, type Client } from '@/components/clients/ClientDetailDialog';
import { getLeadDisplayName, LeadRow } from '@/components/leads/leadPipeline';
import {
  Users,
  UserPlus,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  User,
} from 'lucide-react';

const STAGE_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualified', className: 'bg-accent/15 text-accent' },
  pricing: { label: 'Pricing', className: 'bg-warning/15 text-warning' },
  quoted: { label: 'Quoted', className: 'bg-primary/10 text-primary' },
  negotiation: { label: 'Negotiation', className: 'bg-warning/20 text-warning' },
  won: { label: 'Won', className: 'bg-success/15 text-success' },
};

export default function CRM() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Fetch active clients — already converted, real accounts
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

  // Fetch potential clients — any lead not yet converted, any pipeline stage
  const { data: potentialClients = [], isLoading: potentialLoading } = useQuery({
    queryKey: ['potential-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .is('converted_to_client_id', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
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

  const filteredPotential = potentialClients.filter((lead) =>
    getLeadDisplayName(lead).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="text-sm md:text-base text-muted-foreground">Active client accounts and leads still being worked</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Clients</p>
                  <p className="text-2xl font-bold">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <UserPlus className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Potential Clients</p>
                  <p className="text-2xl font-bold">{potentialClients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="active">Active Clients</TabsTrigger>
              <TabsTrigger value="potential">Potential Clients</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button onClick={() => setIsClientDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </div>
          </div>

          <TabsContent value="active" className="mt-4">
            <div className="grid gap-4">
              {clientsLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredClients.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No active clients found</CardContent></Card>
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

          <TabsContent value="potential" className="mt-4">
            <div className="grid gap-4">
              {potentialLoading ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">Loading...</CardContent></Card>
              ) : filteredPotential.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">No potential clients found</CardContent></Card>
              ) : (
                filteredPotential.map((lead) => {
                  const badge = STAGE_BADGE[lead.status || 'new'] || STAGE_BADGE.new;
                  return (
                    <Card
                      key={lead.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-lg bg-accent/10">
                              <User className="h-6 w-6 text-accent" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{getLeadDisplayName(lead)}</h3>
                              {lead.service_type && (
                                <p className="text-sm text-muted-foreground">{lead.service_type}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                                {lead.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {lead.email}
                                  </span>
                                )}
                                {(lead.mobile_number || lead.phone) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {lead.mobile_number || lead.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>

        <ClientTypeForm
          open={isClientDialogOpen}
          onOpenChange={setIsClientDialogOpen}
        />

        {/* Detail Dialog */}
        <ClientDetailDialog
          client={selectedClient}
          open={!!selectedClient}
          onOpenChange={(open) => !open && setSelectedClient(null)}
        />
      </div>
    </DashboardLayout>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ClientTypeForm } from '@/components/clients/ClientTypeForm';
import { ClientDetailDialog } from '@/components/clients/ClientDetailDialog';
import {
  Users,
  Plus,
  Search,
  Building2,
  Mail,
  Phone,
  User
} from 'lucide-react';

export default function CRM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clients</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage client accounts</p>
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
        </div>

        {/* Clients List */}
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

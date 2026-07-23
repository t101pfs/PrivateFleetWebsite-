import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Landmark, User } from 'lucide-react';
import { cn } from '@/lib/utils';

type ClientType = 'B-B' | 'B-G' | 'B-C';

interface ClientTypeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (clientId: string) => void;
}

const CLIENT_TYPES = [
  { 
    value: 'B-B' as ClientType, 
    label: 'B-B', 
    description: 'Business to Business',
    detail: 'Private companies, corporates, charter brokers',
    icon: Building2 
  },
  { 
    value: 'B-G' as ClientType, 
    label: 'B-G', 
    description: 'Business to Government',
    detail: 'Government entities, ministries, authorities',
    icon: Landmark 
  },
  { 
    value: 'B-C' as ClientType, 
    label: 'B-C', 
    description: 'Business to Consumer',
    detail: 'Individuals, HNWIs, royal family members',
    icon: User 
  },
];

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'HRH', 'HH', 'HE', 'Dr.'];

export function ClientTypeForm({ open, onOpenChange, onSuccess }: ClientTypeFormProps) {
  const queryClient = useQueryClient();
  const [clientType, setClientType] = useState<ClientType | null>(null);
  
  // B-B / B-G fields
  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  
  // B-C fields
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [paName, setPaName] = useState('');
  const [paContact, setPaContact] = useState('');

  const resetForm = () => {
    setClientType(null);
    setCompanyName('');
    setCompanyWebsite('');
    setContactName('');
    setMobileNumber('');
    setEmail('');
    setAddress('');
    setDepartmentName('');
    setTitle('');
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setPaName('');
    setPaContact('');
  };

  const createClient = useMutation({
    mutationFn: async () => {
      let clientData: Record<string, unknown> = {
        client_type: clientType,
      };

      if (clientType === 'B-B' || clientType === 'B-G') {
        clientData = {
          ...clientData,
          company_name: companyName,
          company_website: companyWebsite,
          contact_name: contactName,
          mobile_number: mobileNumber,
          email: email,
          address: address || null,
          department_name: clientType === 'B-G' ? departmentName || null : null,
        };
      } else if (clientType === 'B-C') {
        const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(' ');
        clientData = {
          ...clientData,
          company_name: fullName, // Using company_name as display name for individuals
          title: title,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          mobile_number: mobileNumber,
          email: email,
          pa_name: paName || null,
          pa_contact: paContact || null,
        };
      }

      const { data, error } = await supabase
        .from('clients')
        .insert(clientData as any)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully');
      resetForm();
      onOpenChange(false);
      onSuccess?.(data.id);
    },
    onError: (error) => {
      toast.error('Failed to create client: ' + error.message);
    },
  });

  const isValid = () => {
    if (!clientType) return false;
    
    if (clientType === 'B-B' || clientType === 'B-G') {
      return companyName && companyWebsite && contactName && mobileNumber && email;
    }
    
    if (clientType === 'B-C') {
      return title && firstName && middleName && lastName && mobileNumber && email;
    }
    
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) resetForm();
      onOpenChange(open);
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Client</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Step 1: Client Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Client Type *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CLIENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setClientType(type.value)}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-left",
                      "hover:border-primary/50 hover:bg-secondary/50",
                      clientType === type.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6 mb-2",
                      clientType === type.value ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div className="font-semibold text-sm">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1 leading-tight">{type.detail}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Dynamic Fields based on Type */}
          {clientType && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
              {/* B-B or B-G Fields */}
              {(clientType === 'B-B' || clientType === 'B-G') && (
                <>
                  <div className="space-y-2">
                    <Label>{clientType === 'B-G' ? 'Government Entity Name' : 'Company Name'} *</Label>
                    <Input 
                      value={companyName} 
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={clientType === 'B-G' ? 'Ministry of...' : 'Company Ltd.'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{clientType === 'B-G' ? 'Official Website' : 'Company Website'} *</Label>
                    <Input 
                      type="url"
                      value={companyWebsite} 
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  {clientType === 'B-G' && (
                    <div className="space-y-2">
                      <Label>Department Name</Label>
                      <Input 
                        value={departmentName} 
                        onChange={(e) => setDepartmentName(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Contact Person Full Name *</Label>
                    <Input 
                      value={contactName} 
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="John Smith"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mobile Number *</Label>
                      <Input 
                        type="tel"
                        value={mobileNumber} 
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input 
                        type="email"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="contact@company.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Input 
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}

              {/* B-C Fields */}
              {clientType === 'B-C' && (
                <>
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Select value={title} onValueChange={setTitle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent>
                        {TITLES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>First Name *</Label>
                      <Input 
                        value={firstName} 
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Middle Name *</Label>
                      <Input 
                        value={middleName} 
                        onChange={(e) => setMiddleName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Name *</Label>
                      <Input 
                        value={lastName} 
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mobile Number *</Label>
                      <Input 
                        type="tel"
                        value={mobileNumber} 
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email *</Label>
                      <Input 
                        type="email"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-3">Personal Assistant (Optional)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>PA Name</Label>
                        <Input 
                          value={paName} 
                          onChange={(e) => setPaName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>PA Contact</Label>
                        <Input 
                          type="tel"
                          value={paContact} 
                          onChange={(e) => setPaContact(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button 
                onClick={() => createClient.mutate()} 
                disabled={!isValid() || createClient.isPending}
                className="w-full"
              >
                {createClient.isPending ? 'Creating...' : 'Create Client'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

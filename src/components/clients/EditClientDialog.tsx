import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PhoneInput } from '@/components/ui/phone-input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from './ClientDetailDialog';

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'HRH', 'HH', 'HE', 'Dr.'];

interface EditClientDialogProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Client type itself isn't editable here - B-B/B-G vs B-C changes which
// fields even apply (company vs. personal name), so changing it is really
// a "different kind of client," not a field edit.
export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const queryClient = useQueryClient();

  const [companyName, setCompanyName] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [contactName, setContactName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [title, setTitle] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [paName, setPaName] = useState('');
  const [paContact, setPaContact] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (!client || !open) return;
    setCompanyName(client.client_type === 'B-C' ? '' : client.company_name || '');
    setCompanyWebsite(client.company_website || '');
    setContactName(client.contact_name || '');
    setMobileNumber(client.mobile_number || client.phone || '');
    setEmail(client.email || '');
    setAddress(client.address || '');
    setDepartmentName(client.department_name || '');
    setTitle(client.title || '');
    setFirstName(client.first_name || '');
    setMiddleName(client.middle_name || '');
    setLastName(client.last_name || '');
    setPaName(client.pa_name || '');
    setPaContact(client.pa_contact || '');
    setStatus(client.status || 'active');
  }, [client, open]);

  const isIndividual = client?.client_type === 'B-C';
  const isGov = client?.client_type === 'B-G';

  const save = useMutation({
    mutationFn: async () => {
      if (!client) return;
      let updates: Record<string, unknown>;

      if (isIndividual) {
        const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(' ');
        updates = {
          company_name: fullName,
          title,
          first_name: firstName,
          middle_name: middleName || null,
          last_name: lastName,
          mobile_number: mobileNumber,
          email,
          pa_name: paName || null,
          pa_contact: paContact || null,
          status,
        };
      } else {
        updates = {
          company_name: companyName,
          company_website: companyWebsite,
          contact_name: contactName,
          mobile_number: mobileNumber,
          email,
          address: address || null,
          department_name: isGov ? departmentName || null : null,
          status,
        };
      }

      const { error } = await supabase.from('clients').update(updates).eq('id', client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-flights', client?.id] });
      toast.success('Client updated');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error('Failed to update client: ' + e.message),
  });

  const isValid = isIndividual
    ? !!(title && firstName && lastName && mobileNumber && email)
    : !!(companyName && mobileNumber && email);

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isIndividual ? (
            <>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger><SelectValue placeholder="Select title" /></SelectTrigger>
                  <SelectContent>
                    {TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Middle Name</Label>
                  <Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mobile Number *</Label>
                  <PhoneInput value={mobileNumber} onChange={setMobileNumber} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-3">Personal Assistant (Optional)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>PA Name</Label>
                    <Input value={paName} onChange={(e) => setPaName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>PA Contact</Label>
                    <Input type="tel" value={paContact} onChange={(e) => setPaContact(e.target.value)} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{isGov ? 'Government Entity Name' : 'Company Name'} *</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{isGov ? 'Official Website' : 'Company Website'}</Label>
                <Input type="url" value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} />
              </div>
              {isGov && (
                <div className="space-y-2">
                  <Label>Department Name</Label>
                  <Input value={departmentName} onChange={(e) => setDepartmentName(e.target.value)} placeholder="Optional" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Contact Person Full Name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mobile Number *</Label>
                  <PhoneInput value={mobileNumber} onChange={setMobileNumber} />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!isValid || save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

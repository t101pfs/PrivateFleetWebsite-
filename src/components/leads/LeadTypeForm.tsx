import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Landmark, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClientOption, LeadRow, PRIORITIES, SERVICE_TYPES } from './leadPipeline';
import { logLeadActivity } from './LeadActivityFeed';
import { MentionField } from '@/components/mentions/MentionField';
import { extractMentionedUserIds, notifyMentionedUsers } from '@/components/mentions/mentionUtils';
import { addLeadTeamMember } from './leadTeamChat';

type LeadType = 'B-B' | 'B-G' | 'B-C';

interface LeadTypeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (leadId: string) => void;
  editLead?: LeadRow | null;
}

const LEAD_TYPES = [
  { 
    value: 'B-B' as LeadType, 
    label: 'B-B', 
    description: 'Business to Business',
    detail: 'Private companies, corporates, charter brokers',
    icon: Building2 
  },
  { 
    value: 'B-G' as LeadType, 
    label: 'B-G', 
    description: 'Business to Government',
    detail: 'Government entities, ministries, authorities',
    icon: Landmark 
  },
  { 
    value: 'B-C' as LeadType, 
    label: 'B-C', 
    description: 'Business to Consumer',
    detail: 'Individuals, HNWIs, royal family members',
    icon: User 
  },
];

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'HRH', 'HH', 'HE', 'Dr.'];
const SOURCES = ['Website', 'Referral', 'Phone Call', 'Email', 'Social Media', 'Event', 'Other'];

export function LeadTypeForm({ open, onOpenChange, onSuccess, editLead }: LeadTypeFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [leadType, setLeadType] = useState<LeadType | null>(null);

  // Common fields
  const [contactMode, setContactMode] = useState<'new' | 'existing'>('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  
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

  // Pipeline fields
  const [serviceType, setServiceType] = useState('');
  const [customServiceType, setCustomServiceType] = useState('');
  const [dealSummary, setDealSummary] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<string>('medium');
  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionTime, setNextActionTime] = useState('');
  const [nextActionNote, setNextActionNote] = useState('');

  const { data: owners = [] } = useQuery({
    queryKey: ['profiles-owners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-for-lead-form'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, company_name, contact_name, client_type, company_website, mobile_number, email, address, department_name, title, first_name, middle_name, last_name, pa_name, pa_contact')
        .order('company_name');
      if (error) throw error;
      return data as ClientOption[];
    },
    enabled: open,
  });

  const clientsForType = clients.filter((c) => c.client_type === leadType);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    if (leadType === 'B-B' || leadType === 'B-G') {
      setCompanyName(client.company_name || '');
      setCompanyWebsite(client.company_website || '');
      setMobileNumber(client.mobile_number || '');
      setEmail(client.email || '');
      setAddress(client.address || '');
      setDepartmentName(client.department_name || '');
    } else if (leadType === 'B-C') {
      setTitle(client.title || '');
      setFirstName(client.first_name || '');
      setMiddleName(client.middle_name || '');
      setLastName(client.last_name || '');
      setMobileNumber(client.mobile_number || '');
      setEmail(client.email || '');
      setPaName(client.pa_name || '');
      setPaContact(client.pa_contact || '');
    }
  };

  useEffect(() => {
    if (!open) return;

    if (editLead) {
      setLeadType((editLead.lead_type as LeadType) || null);
      setContactMode(editLead.client_id ? 'existing' : 'new');
      setSelectedClientId(editLead.client_id || '');
      setSource(editLead.source || '');
      setDescription(editLead.description || '');
      setCompanyName(editLead.company_name || '');
      setCompanyWebsite(editLead.company_website || '');
      setMobileNumber(editLead.mobile_number || '');
      setEmail(editLead.email || '');
      setAddress(editLead.address || '');
      setDepartmentName(editLead.department_name || '');
      setTitle(editLead.title || '');
      setFirstName(editLead.first_name || '');
      setMiddleName(editLead.middle_name || '');
      setLastName(editLead.last_name || '');
      setPaName(editLead.pa_name || '');
      setPaContact(editLead.pa_contact || '');

      const knownService = SERVICE_TYPES.find((s) => s === editLead.service_type);
      setServiceType(knownService || (editLead.service_type ? 'Other' : ''));
      setCustomServiceType(knownService ? '' : editLead.service_type || '');

      setDealSummary(editLead.deal_summary || '');
      setEstimatedValue(editLead.estimated_value != null ? String(editLead.estimated_value) : '');
      setOwnerId(editLead.assigned_to || user?.id || '');
      setPriority(editLead.priority || 'medium');
      setNextActionDate(editLead.next_action_date || '');
      setNextActionTime(editLead.next_action_time || '');
      setNextActionNote(editLead.next_action_note || '');
    } else if (user?.id) {
      setOwnerId(user.id);
      setContactMode('new');
      setSelectedClientId('');
    }
  }, [open, editLead, user?.id]);

  const resetForm = () => {
    setLeadType(null);
    setContactMode('new');
    setSelectedClientId('');
    setSource('');
    setDescription('');
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
    setServiceType('');
    setCustomServiceType('');
    setDealSummary('');
    setEstimatedValue('');
    setOwnerId(user?.id || '');
    setPriority('medium');
    setNextActionDate('');
    setNextActionTime('');
    setNextActionNote('');
  };

  const saveLead = useMutation({
    mutationFn: async () => {
      let leadData: Record<string, unknown> = {
        lead_type: leadType,
        source: source,
        description: description || null,
        service_type: serviceType === 'Other' ? customServiceType : serviceType,
        deal_summary: dealSummary || null,
        estimated_value: estimatedValue ? Number(estimatedValue) : null,
        assigned_to: ownerId || user?.id || null,
        priority,
        next_action_date: nextActionDate || null,
        next_action_time: nextActionDate ? (nextActionTime || null) : null,
        next_action_note: nextActionDate ? (nextActionNote || null) : null,
        client_id: contactMode === 'existing' ? selectedClientId || null : null,
      };

      if (!editLead) {
        leadData.status = 'new';
        leadData.created_by = user?.id;
      }

      if (leadType === 'B-B' || leadType === 'B-G') {
        leadData = {
          ...leadData,
          company_name: companyName,
          company_website: companyWebsite || null,
          mobile_number: mobileNumber,
          email: email,
          address: address || null,
          department_name: leadType === 'B-G' ? departmentName || null : null,
        };
      } else if (leadType === 'B-C') {
        const fullName = [title, firstName, middleName, lastName].filter(Boolean).join(' ');
        leadData = {
          ...leadData,
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

      if (editLead) {
        const { error } = await supabase.from('leads').update(leadData as any).eq('id', editLead.id);
        if (error) throw error;
        return { id: editLead.id };
      }

      const { data, error } = await supabase
        .from('leads')
        .insert(leadData as any)
        .select('id')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads-for-flight'] });
      queryClient.invalidateQueries({ queryKey: ['lead', data.id] });
      queryClient.invalidateQueries({ queryKey: ['lead-activities', data.id] });
      toast.success(editLead ? 'Lead updated successfully' : 'Lead created successfully');

      if (!editLead) {
        const owner = owners.find((o) => o.user_id === ownerId);
        logLeadActivity(
          data.id,
          'assigned',
          `Lead assigned to ${owner?.full_name || owner?.email || 'owner'}`,
          user?.id,
          user?.name
        );
      }

      const mentionedIds = extractMentionedUserIds(description, owners).filter((uid) => uid !== user?.id);
      if (mentionedIds.length > 0) {
        await notifyMentionedUsers(mentionedIds, {
          title: 'You were mentioned',
          message: `${user?.name || 'Someone'} mentioned you on lead "${companyName || [firstName, lastName].filter(Boolean).join(' ')}"`,
          leadId: data.id,
          sourceTable: 'leads',
          sourceId: data.id,
        });
        for (const uid of mentionedIds) {
          await addLeadTeamMember(data.id, uid, 'Sales Support', undefined);
        }
        queryClient.invalidateQueries({ queryKey: ['lead-team-members', data.id] });
      }

      resetForm();
      onOpenChange(false);
      onSuccess?.(data.id);
    },
    onError: (error) => {
      toast.error(`Failed to ${editLead ? 'update' : 'create'} lead: ` + error.message);
    },
  });

  const isValid = () => {
    if (!leadType || !source) return false;
    if (!serviceType || (serviceType === 'Other' && !customServiceType)) return false;
    if (contactMode === 'existing' && !selectedClientId) return false;

    if (leadType === 'B-B' || leadType === 'B-G') {
      return companyName && mobileNumber && email;
    }

    if (leadType === 'B-C') {
      return title && firstName && lastName && mobileNumber && email;
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
          <DialogTitle>{editLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Step 1: Lead Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Lead Type *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {LEAD_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => {
                      setLeadType(type.value);
                      setSelectedClientId('');
                    }}
                    className={cn(
                      "p-4 rounded-lg border-2 transition-all text-left",
                      "hover:border-primary/50 hover:bg-secondary/50",
                      leadType === type.value 
                        ? "border-primary bg-primary/10" 
                        : "border-border"
                    )}
                  >
                    <Icon className={cn(
                      "h-6 w-6 mb-2",
                      leadType === type.value ? "text-primary" : "text-muted-foreground"
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
          {leadType && (
            <div className="space-y-4 animate-in fade-in-50 slide-in-from-top-2 duration-200">
              {/* Contact mode - new contact vs existing client */}
              <div className="space-y-2">
                <Label>Contact *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={contactMode === 'new' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setContactMode('new'); setSelectedClientId(''); }}
                  >
                    New Contact
                  </Button>
                  <Button
                    type="button"
                    variant={contactMode === 'existing' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setContactMode('existing')}
                  >
                    Existing Client
                  </Button>
                </div>
                {contactMode === 'existing' && (
                  <Select value={selectedClientId} onValueChange={handleSelectClient}>
                    <SelectTrigger>
                      <SelectValue placeholder={clientsForType.length ? 'Select a client' : `No ${leadType} clients yet`} />
                    </SelectTrigger>
                    <SelectContent>
                      {clientsForType.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name || c.contact_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Source field - common to all */}
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did they find us?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* B-B or B-G Fields */}
              {(leadType === 'B-B' || leadType === 'B-G') && (
                <>
                  <div className="space-y-2">
                    <Label>{leadType === 'B-G' ? 'Government Entity Name' : 'Company Name'} *</Label>
                    <Input 
                      value={companyName} 
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={leadType === 'B-G' ? 'Ministry of...' : 'Company Ltd.'}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{leadType === 'B-G' ? 'Official Website' : 'Company Website'}</Label>
                    <Input 
                      type="url"
                      value={companyWebsite} 
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  {leadType === 'B-G' && (
                    <div className="space-y-2">
                      <Label>Department Name</Label>
                      <Input 
                        value={departmentName} 
                        onChange={(e) => setDepartmentName(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  )}
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
              {leadType === 'B-C' && (
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
                      <Label>Middle Name</Label>
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

              {/* Pipeline fields - common to all */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Service Type *</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                      <SelectItem value="Other">Other…</SelectItem>
                    </SelectContent>
                  </Select>
                  {serviceType === 'Other' && (
                    <Input
                      value={customServiceType}
                      onChange={(e) => setCustomServiceType(e.target.value)}
                      placeholder="Enter service type"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Deal Summary</Label>
                  <Input
                    value={dealSummary}
                    onChange={(e) => setDealSummary(e.target.value)}
                    placeholder="e.g. DMM → FRA • 6.2t, or RUH event transfer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estimated Value (SAR)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Owner</Label>
                    <Select value={ownerId} onValueChange={setOwnerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((o) => (
                          <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Next Action Date</Label>
                    <Input
                      type="date"
                      value={nextActionDate}
                      onChange={(e) => setNextActionDate(e.target.value)}
                    />
                  </div>
                </div>

                {nextActionDate && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Next Action Time</Label>
                      <Input
                        type="time"
                        value={nextActionTime}
                        onChange={(e) => setNextActionTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Next Action Note</Label>
                      <Input
                        value={nextActionNote}
                        onChange={(e) => setNextActionNote(e.target.value)}
                        placeholder="e.g. Follow up on quotation"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Description - common to all */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <MentionField
                  value={description}
                  onChange={setDescription}
                  candidates={owners}
                  placeholder="Any additional notes about this lead... Use @ to mention a teammate"
                  rows={3}
                />
              </div>

              <Button
                onClick={() => saveLead.mutate()}
                disabled={!isValid() || saveLead.isPending}
                className="w-full"
              >
                {saveLead.isPending
                  ? (editLead ? 'Saving...' : 'Creating...')
                  : (editLead ? 'Save Changes' : 'Create Lead')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

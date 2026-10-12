import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getLeadDisplayName, type LeadRow } from '@/components/leads/leadPipeline';
import {
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  MapPin,
  Contact,
  Wallet,
  StickyNote,
  Users,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

interface PotentialClientDialogProps {
  lead: LeadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STAGE_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualified', className: 'bg-accent/15 text-accent' },
  pricing: { label: 'Pricing', className: 'bg-warning/15 text-warning' },
  quoted: { label: 'Quoted', className: 'bg-primary/10 text-primary' },
  negotiation: { label: 'Negotiation', className: 'bg-warning/20 text-warning' },
  won: { label: 'Won', className: 'bg-success/15 text-success' },
  lost: { label: 'Lost', className: 'bg-destructive/15 text-destructive' },
};

function Field({ label, value, icon: Icon }: { label: string; value?: string | null; icon: React.ComponentType<{ className?: string }> }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

// A lighter-weight profile than the Active Client dialog - a lead isn't a
// real client yet (no confirmed-flight history, no billing relationship),
// so there's less to show. The flight request itself (trip requirements,
// quotations, passengers) stays on its own page rather than being
// duplicated here - this is a quick-look contact summary with a way in.
export function PotentialClientDialog({ lead, open, onOpenChange }: PotentialClientDialogProps) {
  const navigate = useNavigate();
  if (!lead) return null;

  const isIndividual = lead.lead_type === 'B-C';
  const personName = [lead.title, lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ');
  const badge = STAGE_BADGE[lead.status || 'new'] || STAGE_BADGE.new;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIndividual ? <User className="h-5 w-5 text-accent" /> : <Building2 className="h-5 w-5 text-accent" />}
            {getLeadDisplayName(lead)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            {lead.lead_type && <Badge variant="outline">{lead.lead_type}</Badge>}
            <Badge variant="secondary" className={badge.className}>{badge.label}</Badge>
            {lead.service_type && <Badge variant="outline">{lead.service_type}</Badge>}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Contact className="h-4 w-4" />
              Contact Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isIndividual ? (
                <Field label="Name" value={personName} icon={User} />
              ) : (
                <Field label="Contact Name" value={lead.contact_name} icon={User} />
              )}
              <Field label="Mobile" value={lead.mobile_number || lead.phone} icon={Phone} />
              <Field label="Email" value={lead.email} icon={Mail} />
              {!isIndividual && <Field label="Website" value={lead.company_website} icon={Globe} />}
              {!isIndividual && <Field label="Address" value={lead.address} icon={MapPin} />}
              {lead.department_name && <Field label="Department" value={lead.department_name} icon={Building2} />}
            </div>
            {isIndividual && (lead.pa_name || lead.pa_contact) && (
              <Field label="Personal Assistant" value={[lead.pa_name, lead.pa_contact].filter(Boolean).join(' • ')} icon={Users} />
            )}
          </div>

          {(lead.source || lead.estimated_value || lead.deal_summary) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Opportunity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Source" value={lead.source} icon={TrendingUp} />
                  <Field label="Estimated Value" value={lead.estimated_value ? `${lead.estimated_value.toLocaleString()} ${lead.preferred_currency || 'SAR'}` : null} icon={Wallet} />
                </div>
                {lead.deal_summary && <Field label="Summary" value={lead.deal_summary} icon={StickyNote} />}
              </div>
            </>
          )}

          {(lead.preferred_currency || lead.billing_entity || lead.notes) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Preferences
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Preferred Currency" value={lead.preferred_currency} icon={Wallet} />
                  <Field label="Billing Entity" value={lead.billing_entity} icon={Building2} />
                </div>
                {lead.notes && <Field label="Notes" value={lead.notes} icon={StickyNote} />}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => { onOpenChange(false); navigate(`/leads/${lead.id}`); }}>
            View Flight Request
            <ArrowRight className="h-4 w-4 ml-1.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

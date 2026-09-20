import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { OptionDetailsBody } from '@/components/flights/OptionDetailsDialog';
import { notifyFlightSales } from '@/lib/notifyFlightSales';

interface ReviewFlight {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  flight_type: string | null;
  preferred_aircraft_category: string | null;
  flexibility_hours: number | null;
  special_requests: string | null;
  created_by: string;
  quotation_approval_status: string;
  quotation_approval_requested_at: string | null;
  quotation_approval_requested_by: string | null;
  leads: {
    reference_number: string | null;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    contact_name: string | null;
    service_type: string | null;
  } | null;
}

const FLIGHT_TYPE_LABELS: Record<string, string> = {
  one_way: 'One Way',
  round_trip: 'Round Trip',
  multi_leg: 'Multi-Leg',
};

function formatPrice(amount: number, currency: string | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
}

interface QuotationApprovalReviewDialogProps {
  flightId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The one place an Admin decides a quotation approval. Shows everything about
 * the flight and every aircraft option Sales selected, so the decision is made
 * on the full picture; Approve needs no note, Reject needs one, and either way
 * the note goes to Sales. Used by both the Approval Queue and the flight page. */
export function QuotationApprovalReviewDialog({ flightId, open, onOpenChange }: QuotationApprovalReviewDialogProps) {
  const { user, supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState('');

  const enabled = open && !!flightId;

  const { data: flight, isLoading: loadingFlight } = useQuery({
    queryKey: ['approval-review-flight', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('id, route_from, route_to, departure_date, departure_time, passengers, cargo_weight_kg, flight_type, preferred_aircraft_category, flexibility_hours, special_requests, created_by, quotation_approval_status, quotation_approval_requested_at, quotation_approval_requested_by, leads(reference_number, company_name, first_name, last_name, contact_name, service_type)')
        .eq('id', flightId as string)
        .single();
      if (error) throw error;
      return data as unknown as ReviewFlight;
    },
    enabled,
  });

  const { data: options = [], isLoading: loadingOptions } = useQuery({
    queryKey: ['approval-review-options', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_options')
        .select('*, operator:operator_id (name)')
        .eq('flight_id', flightId as string)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as unknown as FlightOption[]).filter((o) => !o.is_draft);
    },
    enabled,
  });

  const { data: names = {} } = useQuery({
    queryKey: ['approval-review-names', flight?.created_by, flight?.quotation_approval_requested_by],
    queryFn: async () => {
      const ids = [flight?.created_by, flight?.quotation_approval_requested_by].filter((v): v is string => !!v);
      const { data } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { map[p.user_id] = p.full_name || p.email; });
      return map;
    },
    enabled: !!flight,
  });

  const selected = options.filter((o) => o.is_selected);
  const others = options.filter((o) => !o.is_selected);

  const reference = flight?.leads?.reference_number || (flight ? `REQ-${flight.id.slice(0, 6).toUpperCase()}` : '');
  const clientName = flight?.leads
    ? flight.leads.company_name || [flight.leads.first_name, flight.leads.last_name].filter(Boolean).join(' ') || flight.leads.contact_name
    : null;

  const decide = useMutation({
    mutationFn: async (status: 'approved' | 'rejected') => {
      if (!flight) throw new Error('Flight not loaded');
      const note = notes.trim();
      if (status === 'rejected' && !note) throw new Error('Add a note so Sales knows why it was rejected');

      const { data, error } = await supabase
        .from('flight_requests')
        .update({
          quotation_approval_status: status,
          quotation_approval_decided_at: new Date().toISOString(),
          quotation_approval_decided_by: supabaseUser?.id,
          quotation_approval_notes: note || null,
        })
        .eq('id', flight.id)
        .eq('quotation_approval_status', 'pending')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('This approval was already decided by someone else');

      await notifyFlightSales(flight.id, {
        type: 'status_update',
        title: status === 'approved' ? 'Quotation Approved' : 'Quotation Rejected',
        message: `${user?.name || 'Admin'} ${status} the quotation for ${reference}${note ? `: ${note}` : ''}`,
      });

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser?.id,
        action: `quotation_approval_${status}`,
        entity_type: 'flight_request',
        entity_id: flight.id,
        details: note ? { notes: note } : null,
      });
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ['approvals-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      queryClient.invalidateQueries({ queryKey: ['flight-sourcing-detail', flightId] });
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      setNotes('');
      onOpenChange(false);
      toast.success(status === 'approved' ? 'Quotation approved' : 'Quotation rejected — Sales has been notified');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requirement: Array<[string, string]> = flight
    ? [
        ['Client', clientName || '—'],
        ['Service', flight.leads?.service_type || '—'],
        ['Route', `${flight.route_from} → ${flight.route_to}`],
        ['Trip type', FLIGHT_TYPE_LABELS[flight.flight_type || 'one_way'] || 'One Way'],
        ['Departure', `${format(new Date(flight.departure_date), 'EEE, MMM d, yyyy')} • ${flight.departure_time}`],
        [flight.cargo_weight_kg != null ? 'Cargo weight' : 'Passengers', flight.cargo_weight_kg != null ? `${flight.cargo_weight_kg} kg` : String(flight.passengers)],
        ['Preferred aircraft', flight.preferred_aircraft_category || 'Not specified'],
        ['Flexibility', flight.flexibility_hours ? `± ${flight.flexibility_hours} hours` : 'None'],
        ['Special requests', flight.special_requests || 'None'],
        ['Sales owner', names[flight.created_by] || '—'],
      ]
    : [];

  const alreadyDecided = !!flight && flight.quotation_approval_status !== 'pending';

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setNotes(''); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review quotation approval{reference ? ` — ${reference}` : ''}</DialogTitle>
          <DialogDescription>
            Check the flight and every aircraft Sales selected before you decide. Your note goes to Sales.
          </DialogDescription>
        </DialogHeader>

        {loadingFlight || loadingOptions || !flight ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading details...</p>
        ) : (
          <div className="space-y-5">
            {alreadyDecided && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                This approval was already decided ({flight.quotation_approval_status}).
              </div>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Flight requirement</h3>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4">
                {requirement.map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 text-sm">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium text-right">{value}</span>
                  </div>
                ))}
              </div>
              {flight.quotation_approval_requested_at && (
                <p className="text-xs text-muted-foreground">
                  Sent for approval by {names[flight.quotation_approval_requested_by || ''] || 'Sales'} ·{' '}
                  {formatDistanceToNow(new Date(flight.quotation_approval_requested_at), { addSuffix: true })}
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Aircraft selected for the quotation ({selected.length})</h3>
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">No aircraft are currently selected.</p>
              ) : (
                <div className="space-y-3">
                  {selected.map((opt, i) => (
                    <div key={opt.id} className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                          A{options.indexOf(opt) + 1 || i + 1}
                        </Badge>
                        <span className="font-semibold">{opt.aircraft_type}</span>
                      </div>
                      <OptionDetailsBody option={opt} showOperator showClientPrice />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {others.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Other options not selected ({others.length})</h3>
                <div className="rounded-lg border divide-y">
                  {others.map((opt) => (
                    <div key={opt.id} className="flex items-center justify-between gap-3 flex-wrap p-3 text-sm">
                      <div>
                        <span className="font-medium">{opt.aircraft_type}</span>
                        <span className="text-xs text-muted-foreground"> · {opt.operator?.name || 'Operator not set'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {opt.availability_status === 'unavailable' && (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive font-normal">Unavailable</Badge>
                        )}
                        <span className="font-medium">{formatPrice(opt.base_price, opt.currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2 border-t pt-4">
              <Label htmlFor="approvalNotes" className="text-sm font-semibold">Notes for Sales</Label>
              <Textarea
                id="approvalNotes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional when approving — required when rejecting, so Sales knows what to change"
                disabled={alreadyDecided}
              />
              <div className="flex flex-wrap gap-2 pt-1">
                <Button onClick={() => decide.mutate('approved')} disabled={decide.isPending || alreadyDecided || selected.length === 0}>
                  {decide.isPending && decide.variables === 'approved' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => decide.mutate('rejected')}
                  disabled={decide.isPending || alreadyDecided || !notes.trim()}
                >
                  {decide.isPending && decide.variables === 'rejected' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                  Reject
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

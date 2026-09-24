import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { generateQuotationPdf, downloadBlob, type QuotationData } from '@/lib/quotation-pdf';
import type { PricingBreakdown } from '@/components/flights/PricingBuilder';
import type { FlightOption } from '@/hooks/useFlightOptions';
import type { Json } from '@/integrations/supabase/types';

interface QuotationLeg {
  from?: string;
  to?: string;
  route_from?: string;
  route_to?: string;
  date?: string;
  departure_date?: string;
  departureTime?: string;
  departure_time?: string;
  passengers?: number;
}

interface FlightContact {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_number: string | null;
}

interface FlightWithClient {
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  client_id: string | null;
  client_name: string | null;
  flight_type: string | null;
  flight_legs: QuotationLeg[] | null;
  clients: FlightContact | null;
  // Most flights are still tied to a lead, not yet a converted client — the
  // client record (and its email) only exists after the whole confirmation
  // flow completes, so contact info has to fall back to the lead itself.
  leads: FlightContact | null;
}

interface PrepareQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  options: FlightOption[];
  onSetCommission: (input: { optionId: string; commissionPercent?: number | null; vatOnCommission?: boolean | null; priceOverride?: number | null }) => Promise<unknown>;
  onIssued: () => void;
}

interface OptionPricingState {
  finalCost: string;
}

export function PrepareQuotationDialog({ open, onOpenChange, flightId, options, onSetCommission, onIssued }: PrepareQuotationDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pricingByOption, setPricingByOption] = useState<Record<string, OptionPricingState>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      const next: Record<string, OptionPricingState> = {};
      for (const o of options) {
        // Sales never sees operator cost, so this never falls back to
        // base_price — an option without a client price yet is left blank
        // for Sales to fill in themselves.
        next[o.id] = {
          finalCost: o.price_override != null ? o.price_override.toString() : '',
        };
      }
      setPricingByOption(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.map((o) => o.id).join(',')]);

  const updatePricing = (optionId: string, patch: Partial<OptionPricingState>) => {
    setPricingByOption((prev) => ({ ...prev, [optionId]: { ...prev[optionId], ...patch } }));
  };

  const perOption = options.map((option) => {
    const state = pricingByOption[option.id] || { finalCost: option.base_price.toString() };
    const total = parseFloat(state.finalCost) || 0;
    return { option, state, total };
  });

  const formatCurrency = (amount: number, currency?: string | null) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);

  const handleGenerate = async () => {
    const missingCost = perOption.find((p) => p.total <= 0);
    if (missingCost) {
      toast.error(`Set a final cost for ${missingCost.option.aircraft_type} before generating the quotation`);
      return;
    }

    setIsGenerating(true);
    try {
      await Promise.all(perOption.map((p) => onSetCommission({
        optionId: p.option.id,
        commissionPercent: null,
        vatOnCommission: null,
        priceOverride: p.total,
      })));

      // The first selected option stands in for the flight's single
      // "quoted price" fields (client confirmation, discount math) - the
      // PDF itself lists every option's own price individually, which is
      // what the client actually sees and picks from.
      const primary = perOption[0];

      const { data: flightData, error: flightErr } = await supabase
        .from('flight_requests')
        .select('*, clients(company_name, first_name, last_name, email, phone, mobile_number), leads(company_name, first_name, last_name, email, phone, mobile_number)')
        .eq('id', flightId)
        .single();
      if (flightErr) throw flightErr;
      const flight = flightData as unknown as FlightWithClient;

      // Prefer the converted client's contact info once one exists, but fall
      // back to the lead's own — that's the only contact info most flights
      // have at this stage, since conversion only happens once this whole
      // flow (including this quotation) is complete.
      const contact = flight.clients || flight.leads;
      const clientName = contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.company_name || flight.client_name || 'Client'
        : flight.client_name || 'Client';

      const missing: string[] = [];
      if (!clientName || clientName === 'Client') missing.push('Client name is missing. Please assign a client to this flight.');
      if (!contact?.email) missing.push('Client email is missing.');

      const legsRaw = flight.flight_legs;
      const legs = Array.isArray(legsRaw) && legsRaw.length > 0
        ? legsRaw.map((l) => ({
            from: l.from || l.route_from || '',
            to: l.to || l.route_to || '',
            date: l.date || l.departure_date || flight.departure_date,
            departureTime: l.departureTime || l.departure_time || flight.departure_time || '',
            passengers: Number(l.passengers || flight.passengers || 1),
          }))
        : [{
            from: flight.route_from,
            to: flight.route_to,
            date: flight.departure_date,
            departureTime: flight.departure_time || '',
            passengers: Number(flight.passengers || 1),
          }];

      const hasValidLeg = legs.some((l) => l.from && l.to && l.date);
      if (!hasValidLeg) missing.push('Flight legs are incomplete. At least one leg must have From, To, and Date.');

      if (missing.length > 0) {
        throw new Error('Preflight check failed:\n• ' + missing.join('\n• '));
      }

      const pricing: PricingBreakdown = {
        currency: primary.option.currency || 'USD',
        base_total: primary.option.base_price,
        markup_percent: 0,
        markup_amount: 0,
        vat_enabled: false,
        vat_percent: 0,
        vat_amount: 0,
        taxes: 0,
        additional_charges: 0,
        discount: 0,
        final_total: primary.total,
      };

      const quoteDate = new Date().toLocaleDateString('en-GB');

      // Insert the quotes row first so the trigger-assigned quote_number
      // (the real, sequential one shown on the Quotations page) is what
      // actually prints on the PDF, instead of a second number invented
      // just for the document that never matched the stored record.
      const firstLeg = legs[0];
      const soonestValidity = perOption.reduce<number | null>((min, p) => {
        if (!p.option.validity_minutes) return min;
        return min === null ? p.option.validity_minutes : Math.min(min, p.option.validity_minutes);
      }, null);
      const validUntil = soonestValidity
        ? new Date(Date.now() + soonestValidity * 60_000).toISOString().split('T')[0]
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: newQuote, error: quoteErr } = await supabase
        .from('quotes')
        .insert({
          quote_number: '', // auto-generated by trigger
          client_id: flight.client_id || null,
          route_from: firstLeg.from,
          route_to: firstLeg.to,
          departure_date: firstLeg.date,
          passengers: firstLeg.passengers,
          base_price: primary.option.base_price,
          margin_percent: 0,
          taxes: null,
          total_price: primary.total,
          currency: primary.option.currency || 'USD',
          status: 'sent',
          // Operator identity is never shown to Sales, so it must not leak into a
          // field that Quotations.tsx displays back to them — aircraft type(s) only.
          notes: perOption.map((p) => p.option.aircraft_type).join(', '),
          created_by: user?.id,
          valid_until: validUntil,
        })
        .select('id, quote_number')
        .single();
      if (quoteErr) throw quoteErr;

      const data: QuotationData = {
        quoteNumber: newQuote.quote_number,
        quoteDate,
        preparedBy: user?.name || user?.email || 'Sales Team',
        client: {
          name: clientName,
          company: contact?.company_name,
          email: contact?.email,
          phone: contact?.phone || contact?.mobile_number,
        },
        flight: {
          type: flight.flight_type || 'one_way',
          legs,
        },
        options: JSON.parse(JSON.stringify(perOption.map((p) => p.option))),
        optionTotals: Object.fromEntries(perOption.map((p) => [
          p.option.id,
          { commission: 0, vat: 0, total: p.total, currency: p.option.currency || 'USD' },
        ])),
        pricing,
      };

      const blob = await generateQuotationPdf(data);
      downloadBlob(blob, `${newQuote.quote_number}.pdf`);

      // Link the new quote back onto the flight so Lead 360's Quotations tab
      // (which reads strictly off flight_requests.quotation_id) can find it.
      await supabase
        .from('flight_requests')
        .update({
          options_status: 'quotation_issued',
          pricing_breakdown: pricing as unknown as Json,
          quotation_id: newQuote.id,
          quotation_issued_at: new Date().toISOString(),
        })
        .eq('id', flightId);
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['lead-quotes'] });
      queryClient.invalidateQueries({ queryKey: ['lead-flight-requests'] });

      // Operations should know the client's 60 minutes have started, so the
      // aircraft stays on hold and availability can be confirmed quickly.
      const { data: issued } = await supabase.from('flight_requests').select('assigned_ops_id').eq('id', flightId).maybeSingle();
      let opsTargets: string[] = [];
      if (issued?.assigned_ops_id) {
        opsTargets = [issued.assigned_ops_id];
      } else {
        const { data: ops } = await supabase.rpc('get_operations_user_ids');
        opsTargets = (ops || []).map((o: { user_id: string }) => o.user_id);
      }
      if (opsTargets.length > 0) {
        await supabase.from('notifications').insert(
          opsTargets.map((uid) => ({
            user_id: uid,
            type: 'status_update',
            title: 'Quotation Sent to Client',
            message: `Sales sent the quotation for #${flightId.slice(0, 8).toUpperCase()} — the client has 60 minutes to confirm. Keep the aircraft on hold and be ready to confirm availability.`,
            flight_id: flightId,
          }))
        );
      }

      toast.success('Quotation downloaded — send it to the client, then click "Confirm with Client" when they agree');
      onOpenChange(false);
      onIssued();
    } catch (e) {
      toast.error('Failed to prepare quotation: ' + (e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Prepare Quotation • {options.length === 1 ? options[0].aircraft_type : `${options.length} aircraft offered`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {perOption.map(({ option, state, total }, i) => (
            <div key={option.id} className={i > 0 ? 'space-y-4 pt-4 border-t' : 'space-y-4'}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{option.aircraft_type}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`finalCost-${option.id}`}>Final Cost (what the client pays)</Label>
                <Input
                  id={`finalCost-${option.id}`}
                  type="number"
                  step="1"
                  min="0"
                  value={state.finalCost}
                  onChange={(e) => updatePricing(option.id, { finalCost: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {option.price_override != null
                    ? "Pre-filled with the price an Admin worked out — change it if you need to."
                    : 'An Admin has not priced this option yet — enter what to charge the client.'}
                </p>
              </div>

              <div className="flex justify-between pt-2 border-t font-semibold text-sm">
                <span>Client Total</span>
                <span className="text-primary">{formatCurrency(total, option.currency)}</span>
              </div>
            </div>
          ))}
          {options.length > 1 && (
            <p className="text-xs text-muted-foreground">
              All {options.length} aircraft above are included as separate offers in the same quotation PDF — the client picks one.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate & Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

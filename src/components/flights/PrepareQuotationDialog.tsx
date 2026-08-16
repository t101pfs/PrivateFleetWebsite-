import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { generateQuotationPdf, downloadBlob, type QuotationData } from '@/lib/quotation-pdf';
import type { PricingBreakdown } from '@/components/flights/PricingBuilder';
import type { FlightOption } from '@/hooks/useFlightOptions';
import type { Json } from '@/integrations/supabase/types';

const VAT_RATE = 0.15;

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

interface FlightWithClient {
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  client_name: string | null;
  flight_type: string | null;
  flight_legs: QuotationLeg[] | null;
  clients: {
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile_number: string | null;
  } | null;
}

interface PrepareQuotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flightId: string;
  option: FlightOption;
  onSetCommission: (input: { optionId: string; commissionPercent?: number | null; vatOnCommission?: boolean | null; priceOverride?: number | null }) => Promise<unknown>;
  onIssued: () => void;
}

export function PrepareQuotationDialog({ open, onOpenChange, flightId, option, onSetCommission, onIssued }: PrepareQuotationDialogProps) {
  const { user } = useAuth();
  const [commissionPct, setCommissionPct] = useState(option.commission_percent?.toString() || '');
  const [vatEnabled, setVatEnabled] = useState(option.vat_on_commission ?? false);
  const [priceOverride, setPriceOverride] = useState(option.price_override?.toString() || '');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (open) {
      setCommissionPct(option.commission_percent?.toString() || '');
      setVatEnabled(option.vat_on_commission ?? false);
      setPriceOverride(option.price_override?.toString() || '');
    }
  }, [open, option]);

  const pct = parseFloat(commissionPct) || 0;
  const commission = option.base_price * (pct / 100);
  const vat = vatEnabled ? commission * VAT_RATE : 0;
  const computedTotal = option.base_price + commission + vat;
  const override = priceOverride !== '' ? parseFloat(priceOverride) : null;
  const total = override !== null && !isNaN(override) ? override : computedTotal;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: option.currency || 'USD', maximumFractionDigits: 0 }).format(amount);

  const handleGenerate = async () => {
    if (pct <= 0) {
      toast.error('Set a commission % before generating the quotation');
      return;
    }

    setIsGenerating(true);
    try {
      await onSetCommission({
        optionId: option.id,
        commissionPercent: pct,
        vatOnCommission: vatEnabled,
        priceOverride: override,
      });

      const { data: flightData, error: flightErr } = await supabase
        .from('flight_requests')
        .select('*, clients(company_name, first_name, last_name, email, phone, mobile_number)')
        .eq('id', flightId)
        .single();
      if (flightErr) throw flightErr;
      const flight = flightData as unknown as FlightWithClient;

      const client = flight.clients;
      const clientName = client
        ? [client.first_name, client.last_name].filter(Boolean).join(' ') || client.company_name || flight.client_name || 'Client'
        : flight.client_name || 'Client';

      const missing: string[] = [];
      if (!clientName || clientName === 'Client') missing.push('Client name is missing. Please assign a client to this flight.');
      if (!client?.email) missing.push('Client email is missing.');

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
        currency: option.currency || 'USD',
        base_total: option.base_price,
        markup_percent: pct,
        markup_amount: commission,
        vat_enabled: vat > 0,
        vat_percent: 15,
        vat_amount: vat,
        taxes: 0,
        additional_charges: 0,
        discount: 0,
        final_total: total,
      };

      const quoteNumber = 'QT-' + new Date().getFullYear() + '-' + flightId.slice(0, 6).toUpperCase();
      const quoteDate = new Date().toLocaleDateString('en-GB');

      const data: QuotationData = {
        quoteNumber,
        quoteDate,
        preparedBy: user?.name || user?.email || 'Sales Team',
        client: {
          name: clientName,
          company: client?.company_name,
          email: client?.email,
          phone: client?.phone || client?.mobile_number,
        },
        flight: {
          type: flight.flight_type || 'one_way',
          legs,
        },
        options: [JSON.parse(JSON.stringify(option))],
        optionTotals: {
          [option.id]: { commission, vat, total, currency: option.currency || 'USD' },
        },
        pricing,
      };

      const blob = await generateQuotationPdf(data);
      downloadBlob(blob, `${quoteNumber}.pdf`);

      await supabase
        .from('flight_requests')
        .update({ options_status: 'quotation_issued', pricing_breakdown: pricing as unknown as Json })
        .eq('id', flightId);

      toast.success('Quotation PDF downloaded');
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Prepare Quotation • {option.aircraft_type}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Operator Cost</span>
            <span className="font-medium">{formatCurrency(option.base_price)}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissionPct">Commission %</Label>
            <Input
              id="commissionPct"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox checked={vatEnabled} onCheckedChange={(checked) => setVatEnabled(checked === true)} />
            Apply 15% VAT on commission
          </label>

          <div className="space-y-2">
            <Label htmlFor="priceOverride">Override total (optional)</Label>
            <Input
              id="priceOverride"
              type="number"
              step="1"
              min="0"
              placeholder={formatCurrency(computedTotal)}
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
            />
          </div>

          <div className="flex justify-between pt-2 border-t font-semibold text-sm">
            <span>Client Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
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

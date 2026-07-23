import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { FlightOption } from '@/hooks/useFlightOptions';

export interface PricingBreakdown {
  currency: string;
  base_total: number;
  markup_percent: number;
  markup_amount: number;
  vat_enabled: boolean;
  vat_percent: number;
  vat_amount: number;
  taxes: number;
  additional_charges: number;
  discount: number;
  final_total: number;
}

interface PricingBuilderProps {
  flightId: string;
  selectedOptions: FlightOption[];
  existingBreakdown: PricingBreakdown | null;
  onGeneratePdf: () => void;
  canEdit: boolean;
}

const calc = (
  base: number,
  markupPct: number,
  vatEnabled: boolean,
  vatPct: number,
  taxes: number,
  addCharges: number,
  discount: number
) => {
  const markupAmount = base * (markupPct / 100);
  const subtotal = base + markupAmount;
  const vatAmount = vatEnabled ? subtotal * (vatPct / 100) : 0;
  const finalTotal = subtotal + vatAmount + taxes + addCharges - discount;
  return { markupAmount, vatAmount, finalTotal };
};

export function PricingBuilder({
  flightId,
  selectedOptions,
  existingBreakdown,
  onGeneratePdf,
  canEdit,
}: PricingBuilderProps) {
  const queryClient = useQueryClient();
  const currency = selectedOptions[0]?.currency || existingBreakdown?.currency || 'USD';
  const baseTotal = selectedOptions.reduce((sum, o) => sum + o.base_price, 0);

  const [markupPct, setMarkupPct] = useState(existingBreakdown?.markup_percent?.toString() || '');
  const [vatEnabled, setVatEnabled] = useState(existingBreakdown?.vat_enabled ?? true);
  const [vatPct, setVatPct] = useState(existingBreakdown?.vat_percent?.toString() || '15');
  const [taxes, setTaxes] = useState(existingBreakdown?.taxes?.toString() || '');
  const [addCharges, setAddCharges] = useState(existingBreakdown?.additional_charges?.toString() || '');
  const [discount, setDiscount] = useState(existingBreakdown?.discount?.toString() || '');

  useEffect(() => {
    if (existingBreakdown) {
      setMarkupPct(existingBreakdown.markup_percent?.toString() || '');
      setVatEnabled(existingBreakdown.vat_enabled ?? true);
      setVatPct(existingBreakdown.vat_percent?.toString() || '15');
      setTaxes(existingBreakdown.taxes?.toString() || '');
      setAddCharges(existingBreakdown.additional_charges?.toString() || '');
      setDiscount(existingBreakdown.discount?.toString() || '');
    }
  }, [existingBreakdown]);

  const mPct = parseFloat(markupPct) || 0;
  const vPct = parseFloat(vatPct) || 0;
  const tx = parseFloat(taxes) || 0;
  const addC = parseFloat(addCharges) || 0;
  const disc = parseFloat(discount) || 0;

  const { markupAmount, vatAmount, finalTotal } = calc(baseTotal, mPct, vatEnabled, vPct, tx, addC, disc);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);

  const savePricing = useMutation({
    mutationFn: async () => {
      const breakdown: PricingBreakdown = {
        currency,
        base_total: baseTotal,
        markup_percent: mPct,
        markup_amount: markupAmount,
        vat_enabled: vatEnabled,
        vat_percent: vPct,
        vat_amount: vatAmount,
        taxes: tx,
        additional_charges: addC,
        discount: disc,
        final_total: finalTotal,
      };
      const { error } = await supabase
        .from('flight_requests')
        .update({
          pricing_breakdown: breakdown as any,
          commission_percent: mPct,
          options_status: 'options_selected',
        })
        .eq('id', flightId);
      if (error) throw error;

      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'pricing_updated',
          entity_type: 'flight_request',
          entity_id: flightId,
          details: breakdown as any,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight_requests'] });
      toast.success('Pricing saved');
    },
    onError: (e) => toast.error('Failed to save pricing: ' + (e as Error).message),
  });

  if (selectedOptions.length === 0) return null;

  return (
    <div className="space-y-3 p-4 bg-secondary/30 rounded-lg border">
      <h4 className="font-semibold text-sm">Pricing Builder</h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Markup %</Label>
          <Input type="number" step="0.1" min="0" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} disabled={!canEdit} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Discount</Label>
          <Input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} disabled={!canEdit} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Taxes</Label>
          <Input type="number" step="0.01" min="0" value={taxes} onChange={(e) => setTaxes(e.target.value)} disabled={!canEdit} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Additional Charges</Label>
          <Input type="number" step="0.01" min="0" value={addCharges} onChange={(e) => setAddCharges(e.target.value)} disabled={!canEdit} placeholder="0" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox id="vat-toggle" checked={vatEnabled} onCheckedChange={(v) => setVatEnabled(v === true)} disabled={!canEdit} />
          <Label htmlFor="vat-toggle" className="text-xs cursor-pointer">Apply VAT</Label>
          <Input type="number" step="0.1" min="0" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className="w-20 h-7 text-xs" disabled={!canEdit || !vatEnabled} />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </div>

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Base ({selectedOptions.length} aircraft)</span><span>{fmt(baseTotal)}</span></div>
        {mPct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Markup ({mPct}%)</span><span>{fmt(markupAmount)}</span></div>}
        {vatEnabled && vPct > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ VAT ({vPct}%)</span><span>{fmt(vatAmount)}</span></div>}
        {tx > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Taxes</span><span>{fmt(tx)}</span></div>}
        {addC > 0 && <div className="flex justify-between"><span className="text-muted-foreground">+ Additional</span><span>{fmt(addC)}</span></div>}
        {disc > 0 && <div className="flex justify-between text-destructive"><span>− Discount</span><span>−{fmt(disc)}</span></div>}
        <Separator className="my-1" />
        <div className="flex justify-between font-bold text-base">
          <span>Final Total</span>
          <span className="text-primary text-lg">{fmt(finalTotal)}</span>
        </div>
      </div>

      {canEdit && (
        <div className="flex gap-2">
          <Button onClick={() => savePricing.mutate()} disabled={savePricing.isPending} className="flex-1">
            {savePricing.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save Pricing
          </Button>
          <Button onClick={onGeneratePdf} variant="default" className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
            <FileText className="h-4 w-4 mr-2" />
            Generate Quotation PDF
          </Button>
        </div>
      )}
    </div>
  );
}

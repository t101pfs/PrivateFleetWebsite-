import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { FlightOption } from '@/hooks/useFlightOptions';

interface SetOptionPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: FlightOption | null;
  onSave: (updates: {
    margin_percent: number | null;
    withholding_tax_percent: number | null;
    royal_terminal_cost: number | null;
    brokers_commission_percent: number | null;
    client_vat_percent: number | null;
    price_override: number;
  }) => void;
  isPending: boolean;
}

/** Admin-only: turns an option's operator cost into the price the client
 * pays. Lives on its own, separate from the Add/Edit Option screen Ops
 * uses to source the aircraft — Ops never sees this. */
export function SetOptionPricingDialog({ open, onOpenChange, option, onSave, isPending }: SetOptionPricingDialogProps) {
  const [marginPct, setMarginPct] = useState('');
  const [withholdingTaxPct, setWithholdingTaxPct] = useState('');
  const [royalTerminalCost, setRoyalTerminalCost] = useState('');
  const [brokersCommissionPct, setBrokersCommissionPct] = useState('');
  const [clientVatPct, setClientVatPct] = useState('15');

  useEffect(() => {
    if (open && option) {
      setMarginPct(option.margin_percent?.toString() || '');
      setWithholdingTaxPct(option.withholding_tax_percent?.toString() || '');
      setRoyalTerminalCost(option.royal_terminal_cost?.toString() || '');
      setBrokersCommissionPct(option.brokers_commission_percent?.toString() || '');
      setClientVatPct(option.client_vat_percent?.toString() || '15');
    }
  }, [open, option]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: option?.currency || 'SAR', minimumFractionDigits: 0 }).format(n);

  const preview = useMemo(() => {
    const operatorCost = option?.base_price || 0;
    const marginAmount = operatorCost * ((parseFloat(marginPct) || 0) / 100);
    const withholdingTaxAmount = operatorCost * ((parseFloat(withholdingTaxPct) || 0) / 100);
    const brokersCommissionAmount = operatorCost * ((parseFloat(brokersCommissionPct) || 0) / 100);
    const royalTerminal = parseFloat(royalTerminalCost) || 0;
    const subtotal = operatorCost + marginAmount + withholdingTaxAmount + royalTerminal + brokersCommissionAmount;
    const clientVatAmount = subtotal * ((parseFloat(clientVatPct) || 0) / 100);
    const clientPrice = subtotal + clientVatAmount;
    return { operatorCost, marginAmount, withholdingTaxAmount, brokersCommissionAmount, royalTerminal, clientVatAmount, clientPrice };
  }, [option, marginPct, withholdingTaxPct, royalTerminalCost, brokersCommissionPct, clientVatPct]);

  const handleSave = () => {
    onSave({
      margin_percent: parseFloat(marginPct) || null,
      withholding_tax_percent: parseFloat(withholdingTaxPct) || null,
      royal_terminal_cost: parseFloat(royalTerminalCost) || null,
      brokers_commission_percent: parseFloat(brokersCommissionPct) || null,
      client_vat_percent: parseFloat(clientVatPct) || null,
      price_override: preview.clientPrice,
    });
  };

  if (!option) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Price {option.aircraft_type}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex justify-between text-sm rounded-lg border p-3 bg-secondary/20">
            <span className="text-muted-foreground">Operator cost</span>
            <span className="font-semibold">{fmt(preview.operatorCost)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="marginPct" className="text-xs text-muted-foreground">Margin %</Label>
              <Input id="marginPct" type="number" step="0.1" min="0" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="withholdingTaxPct" className="text-xs text-muted-foreground">Withholding Tax %</Label>
              <Input id="withholdingTaxPct" type="number" step="0.1" min="0" value={withholdingTaxPct} onChange={(e) => setWithholdingTaxPct(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="royalTerminalCost" className="text-xs text-muted-foreground">Royal Terminal Cost</Label>
              <Input id="royalTerminalCost" type="number" step="0.01" min="0" value={royalTerminalCost} onChange={(e) => setRoyalTerminalCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="brokersCommissionPct" className="text-xs text-muted-foreground">Brokers Commission %</Label>
              <Input id="brokersCommissionPct" type="number" step="0.1" min="0" value={brokersCommissionPct} onChange={(e) => setBrokersCommissionPct(e.target.value)} placeholder="0" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="clientVatPct" className="text-xs text-muted-foreground">VAT % (charged to client)</Label>
              <Input id="clientVatPct" type="number" step="0.1" min="0" value={clientVatPct} onChange={(e) => setClientVatPct(e.target.value)} className="w-24" />
            </div>
          </div>

          <div className="space-y-1 text-xs pt-2 border-t">
            {preview.marginAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Margin</span><span>{fmt(preview.marginAmount)}</span></div>}
            {preview.withholdingTaxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Withholding Tax</span><span>{fmt(preview.withholdingTaxAmount)}</span></div>}
            {preview.royalTerminal > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Royal Terminal Cost</span><span>{fmt(preview.royalTerminal)}</span></div>}
            {preview.brokersCommissionAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Brokers Commission</span><span>{fmt(preview.brokersCommissionAmount)}</span></div>}
            {preview.clientVatAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ VAT</span><span>{fmt(preview.clientVatAmount)}</span></div>}
            <div className="flex justify-between items-center pt-1 border-t font-semibold text-sm">
              <span>Client Price</span>
              <span className="text-primary">{fmt(preview.clientPrice)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

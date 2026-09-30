import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { resolvePricingAmount, type PricingValueType } from '@/lib/optionPricing';

interface SetOptionPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: FlightOption | null;
  onSave: (updates: {
    margin_percent: number | null;
    margin_amount: number | null;
    margin_type: PricingValueType;
    withholding_tax_percent: number | null;
    withholding_tax_amount: number | null;
    withholding_tax_type: PricingValueType;
    royal_terminal_cost: number | null;
    royal_terminal_percent: number | null;
    royal_terminal_type: PricingValueType;
    brokers_commission_percent: number | null;
    brokers_commission_amount: number | null;
    brokers_commission_type: PricingValueType;
    client_vat_percent: number | null;
    client_vat_amount: number | null;
    client_vat_type: PricingValueType;
    price_override: number;
  }) => void;
  isPending: boolean;
}

interface PercentOrFlatFieldProps {
  idPrefix: string;
  label: string;
  type: PricingValueType;
  onTypeChange: (type: PricingValueType) => void;
  value: string;
  onValueChange: (value: string) => void;
  flatUnit: string;
}

function PercentOrFlatField({ idPrefix, label, type, onTypeChange, value, onValueChange, flatUnit }: PercentOrFlatFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={idPrefix} className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex rounded-md border overflow-hidden text-[10px]">
          <button
            type="button"
            onClick={() => onTypeChange('percent')}
            className={`px-1.5 py-0.5 ${type === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            %
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('flat')}
            className={`px-1.5 py-0.5 border-l ${type === 'flat' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            {flatUnit}
          </button>
        </div>
      </div>
      <Input
        id={idPrefix}
        type="number"
        step={type === 'flat' ? '0.01' : '0.1'}
        min="0"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

/** Admin-only: turns an option's operator cost into the price the client
 * pays. Lives on its own, separate from the Add/Edit Option screen Ops
 * uses to source the aircraft — Ops never sees this. Every line (Margin,
 * Withholding Tax, Royal Terminal Cost, Brokers Commission, VAT) can be
 * entered as either a percentage of operator cost or a flat amount. */
export function SetOptionPricingDialog({ open, onOpenChange, option, onSave, isPending }: SetOptionPricingDialogProps) {
  const [marginType, setMarginType] = useState<PricingValueType>('percent');
  const [marginValue, setMarginValue] = useState('');
  const [withholdingTaxType, setWithholdingTaxType] = useState<PricingValueType>('percent');
  const [withholdingTaxValue, setWithholdingTaxValue] = useState('');
  const [royalTerminalType, setRoyalTerminalType] = useState<PricingValueType>('flat');
  const [royalTerminalValue, setRoyalTerminalValue] = useState('');
  const [brokersCommissionType, setBrokersCommissionType] = useState<PricingValueType>('percent');
  const [brokersCommissionValue, setBrokersCommissionValue] = useState('');
  const [clientVatType, setClientVatType] = useState<PricingValueType>('percent');
  const [clientVatValue, setClientVatValue] = useState('15');

  useEffect(() => {
    if (open && option) {
      const mType = option.margin_type || 'percent';
      setMarginType(mType);
      setMarginValue((mType === 'flat' ? option.margin_amount : option.margin_percent)?.toString() || '');

      const wType = option.withholding_tax_type || 'percent';
      setWithholdingTaxType(wType);
      setWithholdingTaxValue((wType === 'flat' ? option.withholding_tax_amount : option.withholding_tax_percent)?.toString() || '');

      const rType = option.royal_terminal_type || 'flat';
      setRoyalTerminalType(rType);
      setRoyalTerminalValue((rType === 'percent' ? option.royal_terminal_percent : option.royal_terminal_cost)?.toString() || '');

      const bType = option.brokers_commission_type || 'percent';
      setBrokersCommissionType(bType);
      setBrokersCommissionValue((bType === 'flat' ? option.brokers_commission_amount : option.brokers_commission_percent)?.toString() || '');

      const vType = option.client_vat_type || 'percent';
      setClientVatType(vType);
      setClientVatValue((vType === 'flat' ? option.client_vat_amount : option.client_vat_percent)?.toString() || '15');
    }
  }, [open, option]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: option?.currency || 'SAR', minimumFractionDigits: 0 }).format(n);

  const preview = useMemo(() => {
    const operatorCost = option?.base_price || 0;
    const marginAmount = resolvePricingAmount(marginType, parseFloat(marginValue) || 0, operatorCost);
    const withholdingTaxAmount = resolvePricingAmount(withholdingTaxType, parseFloat(withholdingTaxValue) || 0, operatorCost);
    const royalTerminalAmount = resolvePricingAmount(royalTerminalType, parseFloat(royalTerminalValue) || 0, operatorCost);
    const brokersCommissionAmount = resolvePricingAmount(brokersCommissionType, parseFloat(brokersCommissionValue) || 0, operatorCost);
    const subtotal = operatorCost + marginAmount + withholdingTaxAmount + royalTerminalAmount + brokersCommissionAmount;
    const clientVatAmount = resolvePricingAmount(clientVatType, parseFloat(clientVatValue) || 0, subtotal);
    const clientPrice = Math.round((subtotal + clientVatAmount) * 100) / 100;
    return { operatorCost, marginAmount, withholdingTaxAmount, royalTerminalAmount, brokersCommissionAmount, clientVatAmount, clientPrice };
  }, [option, marginType, marginValue, withholdingTaxType, withholdingTaxValue, royalTerminalType, royalTerminalValue, brokersCommissionType, brokersCommissionValue, clientVatType, clientVatValue]);

  const handleSave = () => {
    const margin = parseFloat(marginValue) || null;
    const withholdingTax = parseFloat(withholdingTaxValue) || null;
    const royalTerminal = parseFloat(royalTerminalValue) || null;
    const brokersCommission = parseFloat(brokersCommissionValue) || null;
    const clientVat = parseFloat(clientVatValue) || null;

    onSave({
      margin_percent: marginType === 'percent' ? margin : null,
      margin_amount: marginType === 'flat' ? margin : null,
      margin_type: marginType,
      withholding_tax_percent: withholdingTaxType === 'percent' ? withholdingTax : null,
      withholding_tax_amount: withholdingTaxType === 'flat' ? withholdingTax : null,
      withholding_tax_type: withholdingTaxType,
      royal_terminal_cost: royalTerminalType === 'flat' ? royalTerminal : null,
      royal_terminal_percent: royalTerminalType === 'percent' ? royalTerminal : null,
      royal_terminal_type: royalTerminalType,
      brokers_commission_percent: brokersCommissionType === 'percent' ? brokersCommission : null,
      brokers_commission_amount: brokersCommissionType === 'flat' ? brokersCommission : null,
      brokers_commission_type: brokersCommissionType,
      client_vat_percent: clientVatType === 'percent' ? clientVat : null,
      client_vat_amount: clientVatType === 'flat' ? clientVat : null,
      client_vat_type: clientVatType,
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
            <PercentOrFlatField
              idPrefix="marginValue"
              label="Margin"
              type={marginType}
              onTypeChange={setMarginType}
              value={marginValue}
              onValueChange={setMarginValue}
              flatUnit="SAR"
            />
            <PercentOrFlatField
              idPrefix="withholdingTaxValue"
              label="Withholding Tax"
              type={withholdingTaxType}
              onTypeChange={setWithholdingTaxType}
              value={withholdingTaxValue}
              onValueChange={setWithholdingTaxValue}
              flatUnit="SAR"
            />
            <PercentOrFlatField
              idPrefix="royalTerminalValue"
              label="Royal Terminal Cost"
              type={royalTerminalType}
              onTypeChange={setRoyalTerminalType}
              value={royalTerminalValue}
              onValueChange={setRoyalTerminalValue}
              flatUnit="SAR"
            />
            <PercentOrFlatField
              idPrefix="brokersCommissionValue"
              label="Brokers Commission"
              type={brokersCommissionType}
              onTypeChange={setBrokersCommissionType}
              value={brokersCommissionValue}
              onValueChange={setBrokersCommissionValue}
              flatUnit="SAR"
            />
            <div className="col-span-2">
              <PercentOrFlatField
                idPrefix="clientVatValue"
                label="VAT (charged to client)"
                type={clientVatType}
                onTypeChange={setClientVatType}
                value={clientVatValue}
                onValueChange={setClientVatValue}
                flatUnit="SAR"
              />
            </div>
          </div>

          <div className="space-y-1 text-xs pt-2 border-t">
            {preview.marginAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Margin</span><span>{fmt(preview.marginAmount)}</span></div>}
            {preview.withholdingTaxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Withholding Tax</span><span>{fmt(preview.withholdingTaxAmount)}</span></div>}
            {preview.royalTerminalAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Royal Terminal Cost</span><span>{fmt(preview.royalTerminalAmount)}</span></div>}
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

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { FlightOption } from '@/hooks/useFlightOptions';
import { resolvePricingAmount, roundMoney, type PricingValueType } from '@/lib/optionPricing';

// Unlike `parseFloat(x) || null`, a real 0 doesn't get swallowed into
// null here - only an empty or genuinely non-numeric field does.
function parseOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? null : n;
}

interface SetOptionPricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  option: FlightOption | null;
  /** Gates which fields this viewer can edit - Operations owns Withholding
   * Tax and VAT (they know the operator's actual cost/compliance figures),
   * Sales owns Margin, Royal Terminal Cost and Brokers Commission (their
   * own markup choices). Admin/Super Admin can edit all five regardless. */
  viewerRole: 'sales' | 'operations' | 'senior_operations' | 'admin' | 'super_admin';
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
    margin_vat_percent: number | null;
    margin_vat_amount: number | null;
    margin_vat_type: PricingValueType;
    price_override: number;
    base_price: number;
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
  disabled?: boolean;
}

function PercentOrFlatField({ idPrefix, label, type, onTypeChange, value, onValueChange, flatUnit, disabled }: PercentOrFlatFieldProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={idPrefix} className="text-xs text-muted-foreground">{label}</Label>
        <div className={`flex rounded-md border overflow-hidden text-[10px] ${disabled ? 'opacity-50' : ''}`}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTypeChange('percent')}
            className={`px-1.5 py-0.5 ${type === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            %
          </button>
          <button
            type="button"
            disabled={disabled}
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
        disabled={disabled}
      />
    </div>
  );
}

/** Turns an option's operator cost into the price the client pays. Split
 * by who owns which line: Operations sets Withholding Tax and VAT, Sales
 * sets Margin, Royal Terminal Cost and Brokers Commission - Admin sees
 * and can edit all five. Every line can be entered as either a percentage
 * of operator cost or a flat amount. */
export function SetOptionPricingDialog({ open, onOpenChange, option, viewerRole, onSave, isPending }: SetOptionPricingDialogProps) {
  const isAdmin = viewerRole === 'admin' || viewerRole === 'super_admin';
  const canEditOpsFields = isAdmin || viewerRole === 'operations' || viewerRole === 'senior_operations';
  const canEditSalesFields = isAdmin || viewerRole === 'sales';

  const [operatorCostValue, setOperatorCostValue] = useState('');
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
  const [marginVatType, setMarginVatType] = useState<PricingValueType>('percent');
  const [marginVatValue, setMarginVatValue] = useState('');

  useEffect(() => {
    if (open && option) {
      setOperatorCostValue(roundMoney(option.base_price || 0).toString());

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
      const storedVat = vType === 'flat' ? option.client_vat_amount : option.client_vat_percent;
      // 15% is only a starting suggestion for an option that's never been
      // priced at all. Once it has (price_override is set), a null VAT
      // means Ops deliberately cleared it to zero last time - defaulting
      // back to 15 here is exactly the bug where VAT "wouldn't go to zero".
      const everPriced = option.price_override != null;
      setClientVatValue(storedVat != null ? storedVat.toString() : (everPriced ? '0' : '15'));

      const mvType = option.margin_vat_type || 'percent';
      setMarginVatType(mvType);
      setMarginVatValue((mvType === 'flat' ? option.margin_vat_amount : option.margin_vat_percent)?.toString() || '');
    }
  }, [open, option]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: option?.currency || 'SAR', minimumFractionDigits: 0 }).format(n);

  const preview = useMemo(() => {
    const operatorCost = roundMoney(parseFloat(operatorCostValue) || 0);
    const marginAmount = resolvePricingAmount(marginType, parseFloat(marginValue) || 0, operatorCost);
    const withholdingTaxAmount = resolvePricingAmount(withholdingTaxType, parseFloat(withholdingTaxValue) || 0, operatorCost);
    const royalTerminalAmount = resolvePricingAmount(royalTerminalType, parseFloat(royalTerminalValue) || 0, operatorCost);
    const brokersCommissionAmount = resolvePricingAmount(brokersCommissionType, parseFloat(brokersCommissionValue) || 0, operatorCost);
    const subtotal = roundMoney(operatorCost + marginAmount + withholdingTaxAmount + royalTerminalAmount + brokersCommissionAmount);
    const clientVatAmount = resolvePricingAmount(clientVatType, parseFloat(clientVatValue) || 0, subtotal);
    // Calculated on marginAmount specifically (not the subtotal) - VAT Sales
    // owes on their own margin, separate from the Ops-owned VAT above.
    const marginVatAmount = resolvePricingAmount(marginVatType, parseFloat(marginVatValue) || 0, marginAmount);
    const clientPrice = roundMoney(subtotal + clientVatAmount + marginVatAmount);
    return { operatorCost, marginAmount, withholdingTaxAmount, royalTerminalAmount, brokersCommissionAmount, clientVatAmount, marginVatAmount, clientPrice };
  }, [operatorCostValue, marginType, marginValue, withholdingTaxType, withholdingTaxValue, royalTerminalType, royalTerminalValue, brokersCommissionType, brokersCommissionValue, clientVatType, clientVatValue, marginVatType, marginVatValue]);

  const handleSave = () => {
    // `parseFloat(x) || null` was treating an intentional 0 the same as an
    // empty/invalid field - so typing "0" to actually remove a fee (e.g.
    // zeroing out VAT) saved as null, and the reload effect above then
    // fell back to showing the stale default again (15 for VAT), making
    // it look like the 0 never took. Only an empty or non-numeric field
    // should become null now - an entered 0 stays 0.
    const margin = parseOrNull(marginValue);
    const withholdingTax = parseOrNull(withholdingTaxValue);
    const royalTerminal = parseOrNull(royalTerminalValue);
    const brokersCommission = parseOrNull(brokersCommissionValue);
    const clientVat = parseOrNull(clientVatValue);
    const marginVat = parseOrNull(marginVatValue);

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
      margin_vat_percent: marginVatType === 'percent' ? marginVat : null,
      margin_vat_amount: marginVatType === 'flat' ? marginVat : null,
      margin_vat_type: marginVatType,
      price_override: preview.clientPrice,
      base_price: preview.operatorCost,
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
          <div>
            <Label htmlFor="operatorCostValue" className="text-xs text-muted-foreground">
              Operator cost (Ops) {option.currency ? `(${option.currency})` : ''}
            </Label>
            <Input
              id="operatorCostValue"
              type="number"
              step="0.01"
              min="0"
              value={operatorCostValue}
              onChange={(e) => setOperatorCostValue(e.target.value)}
              placeholder="0"
              disabled={!canEditOpsFields}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <PercentOrFlatField
              idPrefix="marginValue"
              label="Margin (Sales)"
              type={marginType}
              onTypeChange={setMarginType}
              value={marginValue}
              onValueChange={setMarginValue}
              flatUnit={option.currency || 'SAR'}
              disabled={!canEditSalesFields}
            />
            <PercentOrFlatField
              idPrefix="withholdingTaxValue"
              label="Withholding Tax (Ops)"
              type={withholdingTaxType}
              onTypeChange={setWithholdingTaxType}
              value={withholdingTaxValue}
              onValueChange={setWithholdingTaxValue}
              flatUnit={option.currency || 'SAR'}
              disabled={!canEditOpsFields}
            />
            <PercentOrFlatField
              idPrefix="royalTerminalValue"
              label="Royal Terminal Cost (Sales)"
              type={royalTerminalType}
              onTypeChange={setRoyalTerminalType}
              value={royalTerminalValue}
              onValueChange={setRoyalTerminalValue}
              flatUnit={option.currency || 'SAR'}
              disabled={!canEditSalesFields}
            />
            <PercentOrFlatField
              idPrefix="brokersCommissionValue"
              label="Brokers Commission (Sales)"
              type={brokersCommissionType}
              onTypeChange={setBrokersCommissionType}
              value={brokersCommissionValue}
              onValueChange={setBrokersCommissionValue}
              flatUnit={option.currency || 'SAR'}
              disabled={!canEditSalesFields}
            />
            <PercentOrFlatField
              idPrefix="marginVatValue"
              label="VAT on Margin (Sales)"
              type={marginVatType}
              onTypeChange={setMarginVatType}
              value={marginVatValue}
              onValueChange={setMarginVatValue}
              flatUnit={option.currency || 'SAR'}
              disabled={!canEditSalesFields}
            />
            <div className="col-span-2">
              <PercentOrFlatField
                idPrefix="clientVatValue"
                label="VAT (Ops, charged to client)"
                type={clientVatType}
                onTypeChange={setClientVatType}
                value={clientVatValue}
                onValueChange={setClientVatValue}
                disabled={!canEditOpsFields}
                flatUnit={option.currency || 'SAR'}
              />
            </div>
          </div>

          <div className="space-y-1 text-xs pt-2 border-t">
            {preview.marginAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Margin</span><span>{fmt(preview.marginAmount)}</span></div>}
            {preview.withholdingTaxAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Withholding Tax</span><span>{fmt(preview.withholdingTaxAmount)}</span></div>}
            {preview.royalTerminalAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Royal Terminal Cost</span><span>{fmt(preview.royalTerminalAmount)}</span></div>}
            {preview.brokersCommissionAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ Brokers Commission</span><span>{fmt(preview.brokersCommissionAmount)}</span></div>}
            {preview.marginVatAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>+ VAT on Margin</span><span>{fmt(preview.marginVatAmount)}</span></div>}
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

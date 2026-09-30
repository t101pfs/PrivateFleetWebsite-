import type { FlightOption } from '@/hooks/useFlightOptions';

export type PricingValueType = 'percent' | 'flat';

export interface OptionPricingBreakdown {
  operatorCost: number;
  marginAmount: number;
  withholdingTaxAmount: number;
  royalTerminalAmount: number;
  brokersCommissionAmount: number;
  subtotal: number;
  clientVatAmount: number;
  clientPrice: number;
}

/** Rounds to the nearest cent/halala — every computed money amount goes
 * through this before it's summed with anything else, so tiny floating-point
 * fractions (82000 * 0.03 can land on 2460.0000000000005 in JS) never
 * compound into an off-by-a-cent total. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** A percent value is a share of `base`; a flat value is the amount itself. */
export function resolvePricingAmount(type: PricingValueType, value: number | null | undefined, base: number): number {
  if (type === 'flat') return roundMoney(value || 0);
  return roundMoney(base * ((value || 0) / 100));
}

/** Rebuilds the same client-price breakdown SetOptionPricingDialog previews
 * while editing, from whatever an option already has saved — so anywhere an
 * option is just being looked at (not edited) can show the same numbers,
 * including how much margin is baked into the client price. */
export function computeOptionPricingBreakdown(option: FlightOption): OptionPricingBreakdown {
  const operatorCost = roundMoney(option.base_price || 0);

  const marginAmount = resolvePricingAmount(option.margin_type || 'percent', option.margin_type === 'flat' ? option.margin_amount : option.margin_percent, operatorCost);
  const withholdingTaxAmount = resolvePricingAmount(option.withholding_tax_type || 'percent', option.withholding_tax_type === 'flat' ? option.withholding_tax_amount : option.withholding_tax_percent, operatorCost);
  const royalTerminalAmount = resolvePricingAmount(option.royal_terminal_type || 'flat', option.royal_terminal_type === 'percent' ? option.royal_terminal_percent : option.royal_terminal_cost, operatorCost);
  const brokersCommissionAmount = resolvePricingAmount(option.brokers_commission_type || 'percent', option.brokers_commission_type === 'flat' ? option.brokers_commission_amount : option.brokers_commission_percent, operatorCost);

  const subtotal = roundMoney(operatorCost + marginAmount + withholdingTaxAmount + royalTerminalAmount + brokersCommissionAmount);

  const clientVatAmount = resolvePricingAmount(option.client_vat_type || 'percent', option.client_vat_type === 'flat' ? option.client_vat_amount : option.client_vat_percent, subtotal);
  const clientPrice = roundMoney(subtotal + clientVatAmount);

  return { operatorCost, marginAmount, withholdingTaxAmount, royalTerminalAmount, brokersCommissionAmount, subtotal, clientVatAmount, clientPrice };
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightOptions } from '@/hooks/useFlightOptions';
import { FlightOptionCard } from './FlightOptionCard';
import { AddFlightOptionDialog } from './AddFlightOptionDialog';
import { EditFlightOptionDialog } from './EditFlightOptionDialog';
import { type PricingBreakdown } from './PricingBuilder';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Percent, CheckCircle2, Package, UserPlus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { generateQuotationPdf, downloadBlob, type QuotationData } from '@/lib/quotation-pdf';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { CreateOptionInput, FlightOption } from '@/hooks/useFlightOptions';

interface FlightOptionsTabProps {
  flightId: string;
  optionsStatus: string | null;
  commissionPercent: number | null;
  hasQuotation: boolean;
  canAssignToSelf?: boolean;
  canConfirm?: boolean;
  flightRoute?: {
    from: string;
    to: string;
    departureTime: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assignToMe?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confirmFlight?: any;
}

export function FlightOptionsTab({
  flightId,
  optionsStatus,
  commissionPercent,
  hasQuotation,
  canAssignToSelf,
  canConfirm,
  flightRoute,
  assignToMe,
  confirmFlight,
}: FlightOptionsTabProps) {
  const { user } = useAuth();
  const {
    options,
    selectedOptions,
    isLoading,
    createOption,
    updateOption,
    deleteOption,
    toggleOptionSelection,
    setCommission,
    setOptionCommission,
    isSales,
    isOperationsOrAdmin,
  } = useFlightOptions(flightId);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<FlightOption | null>(null);
  // Local per-option commercial inputs keyed by option id
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});
  const [vatInputs, setVatInputs] = useState<Record<string, boolean>>({});
  const [overrideInputs, setOverrideInputs] = useState<Record<string, string>>({});
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<QuotationData | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparingPreview, setPreparingPreview] = useState(false);

  const VAT_RATE = 0.15;

  const canEdit = isOperationsOrAdmin && !hasQuotation;
  const canSelectOptions = isSales && options.length > 0;
  const canSetCommission = isSales && selectedOptions.length > 0;
  const canGenerateQuotation = isSales && selectedOptions.length > 0;

  const handleAddOption = (data: CreateOptionInput) => {
    createOption.mutate(data, {
      onSuccess: () => setAddDialogOpen(false),
    });
  };

  const handleEditOption = (option: FlightOption) => {
    setEditingOption(option);
    setEditDialogOpen(true);
  };

  const handleUpdateOption = (optionId: string, updates: Partial<FlightOption>) => {
    updateOption.mutate({ optionId, updates }, {
      onSuccess: () => {
        setEditDialogOpen(false);
        setEditingOption(null);
      },
    });
  };

  const handleDeleteOption = (optionId: string) => {
    if (confirm('Are you sure you want to delete this option?')) {
      deleteOption.mutate(optionId);
    }
  };

  // Resolvers: local input > stored value > default
  const getOptionCommissionPct = (opt: FlightOption): number => {
    const local = commissionInputs[opt.id];
    if (local !== undefined && local !== '') {
      const n = parseFloat(local);
      if (!isNaN(n)) return n;
    }
    return opt.commission_percent ?? 0;
  };

  const getOptionVat = (opt: FlightOption): boolean => {
    if (vatInputs[opt.id] !== undefined) return vatInputs[opt.id];
    return opt.vat_on_commission ?? false;
  };

  const getOptionOverride = (opt: FlightOption): number | null => {
    const local = overrideInputs[opt.id];
    if (local !== undefined) {
      if (local === '') return null;
      const n = parseFloat(local);
      return isNaN(n) ? null : n;
    }
    return opt.price_override ?? null;
  };

  // Compute commission, VAT and total for an option
  const computeOptionTotals = (opt: FlightOption) => {
    const pct = getOptionCommissionPct(opt);
    const commission = opt.base_price * (pct / 100);
    const vat = getOptionVat(opt) ? commission * VAT_RATE : 0;
    const override = getOptionOverride(opt);
    const computedTotal = opt.base_price + commission + vat;
    const total = override !== null ? override : computedTotal;
    return { commission, vat, computedTotal, total, override };
  };

  const handleConfirmSelection = () => {
    // Ensure every selected option has a commission entered
    const missing = selectedOptions.filter(o => {
      const local = commissionInputs[o.id];
      const stored = o.commission_percent;
      const val = local !== undefined && local !== '' ? parseFloat(local) : stored;
      return val === null || val === undefined || isNaN(val as number) || (val as number) < 0;
    });
    if (missing.length > 0) {
      return;
    }

    // Persist per-option commercial fields for any with a pending change
    const tasks: Promise<unknown>[] = [];
    for (const opt of selectedOptions) {
      const updates: {
        optionId: string;
        commissionPercent?: number | null;
        vatOnCommission?: boolean | null;
        priceOverride?: number | null;
      } = { optionId: opt.id };
      let changed = false;

      const localPct = commissionInputs[opt.id];
      if (localPct !== undefined && localPct !== '') {
        const pct = parseFloat(localPct);
        if (!isNaN(pct) && pct !== opt.commission_percent) {
          updates.commissionPercent = pct;
          changed = true;
        }
      }
      if (vatInputs[opt.id] !== undefined && vatInputs[opt.id] !== (opt.vat_on_commission ?? false)) {
        updates.vatOnCommission = vatInputs[opt.id];
        changed = true;
      }
      if (overrideInputs[opt.id] !== undefined) {
        const ov = overrideInputs[opt.id] === '' ? null : parseFloat(overrideInputs[opt.id]);
        const newVal = ov === null ? null : (isNaN(ov) ? null : ov);
        if (newVal !== (opt.price_override ?? null)) {
          updates.priceOverride = newVal;
          changed = true;
        }
      }

      if (changed) {
        tasks.push(setOptionCommission.mutateAsync(updates));
      }
    }

    Promise.all(tasks).then(() => {
      // Compute weighted-average commission across selected options for legacy flight field
      const baseSum = selectedOptions.reduce((s, o) => s + o.base_price, 0);
      const weighted = baseSum > 0
        ? selectedOptions.reduce((s, o) => s + o.base_price * getOptionCommissionPct(o), 0) / baseSum
        : 0;
      setCommission.mutate(Math.round(weighted * 100) / 100);
      setCommissionInputs({});
      setVatInputs({});
      setOverrideInputs({});
    });
  };

  const buildQuotationData = async (): Promise<QuotationData> => {
    const { data: flight, error: flightErr } = await supabase
      .from('flight_requests')
      .select('*, clients(company_name, first_name, last_name, email, phone, mobile_number)')
      .eq('id', flightId)
      .single();
    if (flightErr) throw flightErr;

    const client = (flight as any).clients;
    const clientName = client
      ? [client.first_name, client.last_name].filter(Boolean).join(' ') || client.company_name || flight.client_name || 'Client'
      : flight.client_name || 'Client';

    // Preflight validation
    const missing: string[] = [];

    if (!clientName || clientName === 'Client') {
      missing.push('Client name is missing. Please assign a client to this flight.');
    }
    if (!client?.email) {
      missing.push('Client email is missing.');
    }

    const legsRaw = (flight as any).flight_legs;
    const legs = Array.isArray(legsRaw) && legsRaw.length > 0
      ? legsRaw.map((l: any) => ({
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

    const hasValidLeg = legs.some(
      (l: any) => l.from && l.to && l.date
    );
    if (!hasValidLeg) {
      missing.push('Flight legs are incomplete. At least one leg must have From, To, and Date.');
    }

    // Validate selected options
    for (const opt of selectedOptions) {
      if (!opt.aircraft_type) {
        missing.push(`Option ${opt.id}: Aircraft type is missing.`);
      }
      if (opt.base_price == null || isNaN(opt.base_price)) {
        missing.push(`Option ${opt.id}: Base price is missing or invalid.`);
      }
    }

    if (missing.length > 0) {
      throw new Error('Preflight check failed:\n• ' + missing.join('\n• '));
    }

    const baseSum = selectedOptions.reduce((s, o) => s + o.base_price, 0);
    const commissionSum = selectedOptions.reduce((s, o) => s + computeOptionTotals(o).commission, 0);
    const vatSum = selectedOptions.reduce((s, o) => s + computeOptionTotals(o).vat, 0);
    const finalSum = selectedOptions.reduce((s, o) => s + computeOptionTotals(o).total, 0);
    const currency = selectedOptions[0]?.currency || 'USD';

    const pricing: PricingBreakdown = {
      currency,
      base_total: baseSum,
      markup_percent: baseSum > 0 ? Math.round((commissionSum / baseSum) * 10000) / 100 : 0,
      markup_amount: commissionSum,
      vat_enabled: vatSum > 0,
      vat_percent: 15,
      vat_amount: vatSum,
      taxes: 0,
      additional_charges: 0,
      discount: 0,
      final_total: finalSum,
    };

    const quoteNumber = 'QT-' + new Date().getFullYear() + '-' + flightId.slice(0, 6).toUpperCase();
    const quoteDate = new Date().toLocaleDateString('en-GB');

    const optionTotals: QuotationData['optionTotals'] = {};
    for (const o of selectedOptions) {
      const t = computeOptionTotals(o);
      optionTotals[o.id] = {
        commission: t.commission,
        vat: t.vat,
        total: t.total,
        currency: o.currency || currency,
      };
    }

    return {
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
        type: (flight as any).flight_type || 'one_way',
        legs,
      },
      options: JSON.parse(JSON.stringify(selectedOptions)),
      optionTotals,
      pricing,
    };
  };

  const handlePreviewQuotation = async () => {
    if (selectedOptions.length === 0) {
      toast.error('Select at least one option first');
      return;
    }
    if (selectedOptions.some(o => getOptionCommissionPct(o) <= 0)) {
      toast.error('Set a commission % on every selected option before generating the quotation');
      return;
    }
    setPreparingPreview(true);
    try {
      const data = await buildQuotationData();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewData(data);
      setPreviewBlob(null);
      setPreviewUrl(null);
      setPreviewOpen(true);

      const blob = await generateQuotationPdf(data);
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
    } catch (e) {
      console.error('Quotation preview failed:', e);
      toast.error('Failed to build preview: ' + (e as Error).message);
    } finally {
      setPreparingPreview(false);
    }
  };

  const handleDownloadQuotation = async () => {
    if (!previewData) return;
    setGeneratingPdf(true);
    try {
      const blob = previewBlob || await generateQuotationPdf(previewData);
      downloadBlob(blob, `${previewData.quoteNumber}.pdf`);
      await supabase
        .from('flight_requests')
        .update({ options_status: 'quotation_issued', pricing_breakdown: previewData.pricing as any })
        .eq('id', flightId);
      toast.success('Quotation PDF downloaded');
      setPreviewOpen(false);
    } catch (e) {
      toast.error('Failed to download quotation: ' + (e as Error).message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewBlob(null);
  };

  const selectedBaseTotal = selectedOptions.reduce((sum, opt) => sum + opt.base_price, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Operations: Assign to Me */}
      {canAssignToSelf && assignToMe && (
        <Button onClick={() => assignToMe.mutate(flightId)} className="w-full h-8 text-xs" disabled={assignToMe.isPending}>
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />{assignToMe.isPending ? 'Assigning...' : 'Assign to Me'}
        </Button>
      )}

      {/* Operations: Confirm Flight */}
      {canConfirm && confirmFlight && (
        <Button onClick={() => confirmFlight.mutate(flightId)} className="w-full h-8 text-xs bg-accent hover:bg-accent/90 text-accent-foreground" disabled={confirmFlight.isPending}>
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Confirm Flight
        </Button>
      )}

      {(canAssignToSelf || canConfirm) && options.length > 0 && <Separator />}

      {/* Status Badge */}
      {optionsStatus && (
        <div className="flex items-center gap-2">
          <Badge variant={
            optionsStatus === 'quotation_issued' ? 'default' :
            optionsStatus === 'options_selected' ? 'secondary' :
            'outline'
          }>
            {optionsStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Badge>
          {commissionPercent !== null && (
            <Badge variant="outline">
              <Percent className="h-3 w-3 mr-1" />
              {commissionPercent}% commission
            </Badge>
          )}
        </div>
      )}

      {/* Operations: Add Options Button */}
      {isOperationsOrAdmin && canEdit && (
        <Button onClick={() => setAddDialogOpen(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Add Aircraft Option
        </Button>
      )}

      {/* Options List */}
      {options.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {isOperationsOrAdmin
              ? 'No options added yet. Add aircraft options for Sales to review.'
              : 'Waiting for Operations to upload aircraft options.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {options.map((option, index) => (
            <FlightOptionCard
              key={option.id}
              option={option}
              optionNumber={`A${index + 1}`}
              isSales={isSales}
              isOperationsOrAdmin={isOperationsOrAdmin}
              canEdit={canEdit}
              onDelete={() => handleDeleteOption(option.id)}
              onEdit={canEdit ? () => handleEditOption(option) : undefined}
              onPublish={canEdit ? () => updateOption.mutate({ optionId: option.id, updates: { is_draft: false } }) : undefined}
              onToggleSelect={canSelectOptions ? (selected) => 
                toggleOptionSelection.mutate({ optionId: option.id, isSelected: selected })
              : undefined}
            />
          ))}
        </div>
      )}

      {/* Sales: Commission Input & Summary */}
      {isSales && selectedOptions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3 p-3 bg-secondary/30 rounded-lg">
            <h4 className="font-medium">Selection Summary</h4>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Options ({selectedOptions.length})</span>
                <span>{formatCurrency(selectedBaseTotal)}</span>
              </div>

              {/* Per-option commercial rows */}
              <div className="space-y-3 pt-1">
                {selectedOptions.map((opt) => {
                  const totals = computeOptionTotals(opt);
                  const pctInputVal = commissionInputs[opt.id] ?? (opt.commission_percent != null ? String(opt.commission_percent) : '');
                  const vatVal = getOptionVat(opt);
                  const overrideInputVal = overrideInputs[opt.id] ?? (opt.price_override != null ? String(opt.price_override) : '');
                  const isOverridden = totals.override !== null;
                  return (
                    <div key={opt.id} className="space-y-2 p-2.5 rounded-md bg-background/60 border">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30 shrink-0">
                          A{options.findIndex(o => o.id === opt.id) + 1}
                        </Badge>
                        <span className="text-xs font-medium truncate flex-1 min-w-0">{opt.aircraft_type}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Base {formatCurrency(opt.base_price)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={`commission-${opt.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                          Commission %
                        </Label>
                        <Input
                          id={`commission-${opt.id}`}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={pctInputVal}
                          onChange={(e) =>
                            setCommissionInputs(prev => ({ ...prev, [opt.id]: e.target.value }))
                          }
                          className="w-20 h-8"
                          
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          = {formatCurrency(totals.commission)}
                        </span>
                      </div>

                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <Checkbox
                          checked={vatVal}
                          onCheckedChange={(checked) =>
                            setVatInputs(prev => ({ ...prev, [opt.id]: checked === true }))
                          }
                          
                        />
                        <span>Apply 15% VAT on commission</span>
                        {vatVal && (
                          <span className="text-muted-foreground ml-auto">
                            +{formatCurrency(totals.vat)}
                          </span>
                        )}
                      </label>

                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor={`override-${opt.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                          Override total
                        </Label>
                        <Input
                          id={`override-${opt.id}`}
                          type="number"
                          step="1"
                          min="0"
                          placeholder={formatCurrency(totals.computedTotal)}
                          value={overrideInputVal}
                          onChange={(e) =>
                            setOverrideInputs(prev => ({ ...prev, [opt.id]: e.target.value }))
                          }
                          className="w-32 h-8"
                          
                        />
                        {overrideInputVal !== '' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setOverrideInputs(prev => ({ ...prev, [opt.id]: '' }))}
                            
                          >
                            Clear
                          </Button>
                        )}
                      </div>

                      <div className="flex justify-between pt-1 border-t font-semibold text-sm">
                        <span>Option total</span>
                        <span className="text-primary">
                          {formatCurrency(totals.total)}
                          {isOverridden && (
                            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(manual)</span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-muted-foreground italic pt-1">
                The client will confirm one of the options above — each option total is the price quoted for that aircraft.
              </p>
            </div>

            {canSetCommission && (
              <Button
                onClick={handleConfirmSelection}
                disabled={
                  setCommission.isPending ||
                  setOptionCommission.isPending ||
                  selectedOptions.length === 0 ||
                  selectedOptions.some(o => {
                    const local = commissionInputs[o.id];
                    const val = local !== undefined && local !== ''
                      ? parseFloat(local)
                      : o.commission_percent;
                    return val === null || val === undefined || isNaN(val as number);
                  })
                }
                className="w-full"
              >
                {(setCommission.isPending || setOptionCommission.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirm Selection & Commission
              </Button>
            )}

            {canGenerateQuotation && (
              <Button
                onClick={handlePreviewQuotation}
                disabled={preparingPreview}
                variant="default"
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                {preparingPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Preview Quotation
              </Button>
            )}
          </div>
        </>
      )}

      <AddFlightOptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={handleAddOption}
        flightId={flightId}
        isPending={createOption.isPending}
        flightRoute={flightRoute}
      />

      {editingOption && (
        <EditFlightOptionDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingOption(null);
          }}
          option={editingOption}
          onSubmit={handleUpdateOption}
          isPending={updateOption.isPending}
          flightRoute={flightRoute}
        />
      )}

      <Dialog open={previewOpen} onOpenChange={(o) => { if (!o) handleClosePreview(); else setPreviewOpen(true); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>Quotation Preview</DialogTitle>
            <DialogDescription>
              Review the quotation details below, then open or download the generated PDF.
            </DialogDescription>
            {previewData && (
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                <div><span className="font-medium text-foreground">Client:</span> {previewData.client.name}{previewData.client.company ? ` — ${previewData.client.company}` : ''}</div>
                <div>
                  <span className="font-medium text-foreground">Quote #:</span> {previewData.quoteNumber}
                  <span className="ml-3 font-medium text-foreground">Total:</span>{' '}
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: previewData.pricing.currency, maximumFractionDigits: 2 }).format(previewData.pricing.final_total)}
                  <span className="ml-3 font-medium text-foreground">Options:</span> {previewData.options.length}
                </div>
              </div>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden bg-muted">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                title="Quotation PDF Preview"
                className="w-full h-full border-0"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Rendering final quotation PDF…
              </div>
            )}
          </div>
          <DialogFooter className="px-6 py-3 border-t shrink-0">
            <Button variant="outline" onClick={handleClosePreview} disabled={generatingPdf}>
              Close
            </Button>
            {previewUrl && (
              <Button asChild variant="outline" disabled={generatingPdf}>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">Open in new tab</a>
              </Button>
            )}
            <Button
              onClick={handleDownloadQuotation}
              disabled={generatingPdf || !previewBlob}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Confirm & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

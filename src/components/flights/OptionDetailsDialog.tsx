import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Download, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FlightOption } from '@/hooks/useFlightOptions';

interface OptionDetailsBodyProps {
  option: FlightOption;
  showOperator?: boolean;
  isConfirmed?: boolean;
  /** Admin review only: also shows the price the client would pay and the
   * commission on top of the operator cost. Never for Operations. */
  showClientPrice?: boolean;
}

interface OptionDetailsDialogProps extends OptionDetailsBodyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  optionNumber: string;
}

const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Confirmed',
  on_request: 'On Request',
  unavailable: 'Unavailable',
};

function formatPrice(amount: number, currency: string | null | undefined): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

/** Every detail of one aircraft option, without the surrounding dialog, so the
 * same content can sit inside a dialog or inside the Admin approval review. */
export function OptionDetailsBody({ option, showOperator, isConfirmed, showClientPrice }: OptionDetailsBodyProps) {
  const specs = option.aircraft_specs || {};
  const images = [
    ...(option.aircraft_images || []),
    ...(option.interior_images || []),
    ...(option.layout_image ? [option.layout_image] : []),
  ].filter(Boolean);

  const handleDownloadDocument = async () => {
    if (!option.supporting_document_path) return;
    const { data, error } = await supabase.storage.from('flight-documents').download(option.supporting_document_path);
    if (error || !data) {
      toast.error('Failed to download document');
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = option.supporting_document_name || 'supporting-document';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {showOperator && (
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{option.operator?.name || 'Operator not set'}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.slice(0, 4).map((src, i) => (
            <img key={i} src={src} alt={`${option.aircraft_type} ${i + 1}`} className="rounded-md border h-28 w-full object-cover" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Manufacturer" value={specs.manufacturer} />
        <Field label="Model" value={specs.model} />
        <Field label="Category" value={specs.category} />
        <Field label="Cabin Layout" value={specs.cabin_layout} />
        <Field label="Pax Capacity" value={specs.pax} />
        <Field label="Bedrooms" value={specs.bedroom_count} />
        <Field label="Range" value={specs.range} />
        <Field label="Baggage Capacity" value={option.baggage_capacity} />
        <Field label="Year of Make" value={specs.year_of_make} />
        <Field label="Year of Refurbishment" value={specs.year_of_refurbishment} />
        <Field label="Estimated Duration" value={option.estimated_duration} />
        <Field label="Availability" value={AVAILABILITY_LABELS[option.availability_status || 'available']} />
        <Field label="Requires Positioning" value={option.requires_positioning ? 'Yes' : 'No'} />
        <Field label="Validity" value={option.validity_minutes ? `${option.validity_minutes} minutes` : null} />
        {(showOperator || isConfirmed) && <Field label="Registration" value={option.aircraft_registration} />}
        <Field label="Operator Cost" value={formatPrice(option.base_price, option.currency)} />
        {showClientPrice && option.price_override != null && (
          <Field label="Client Price" value={formatPrice(option.price_override, option.currency)} />
        )}
        {showClientPrice && option.commission_percent != null && (
          <Field label="Commission" value={`${option.commission_percent}%${option.vat_on_commission ? ' + VAT' : ''}`} />
        )}
      </div>

      {option.aircraft_features && option.aircraft_features.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Features</p>
          <div className="flex flex-wrap gap-1.5">
            {option.aircraft_features.map((f, i) => (
              <Badge key={i} variant="secondary" className="font-normal">{f}</Badge>
            ))}
          </div>
        </div>
      )}

      {option.aircraft_notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">Notes</p>
          <p className="text-sm whitespace-pre-wrap">{option.aircraft_notes}</p>
        </div>
      )}

      {option.supporting_document_path && (
        <Button variant="outline" size="sm" onClick={handleDownloadDocument}>
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          {option.supporting_document_name || 'Supporting document'}
          <Download className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      )}
    </div>
  );
}

export function OptionDetailsDialog({ open, onOpenChange, option, optionNumber, showOperator, isConfirmed, showClientPrice }: OptionDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
              {optionNumber}
            </Badge>
            {option.aircraft_type}
          </DialogTitle>
        </DialogHeader>
        <OptionDetailsBody option={option} showOperator={showOperator} isConfirmed={isConfirmed} showClientPrice={showClientPrice} />
      </DialogContent>
    </Dialog>
  );
}

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Building2, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FlightOption } from '@/hooks/useFlightOptions';

interface SourcingOptionCardProps {
  option: FlightOption;
  optionNumber: string;
  canManage: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  available: { label: 'Confirmed', className: 'bg-success/10 text-success' },
  on_request: { label: 'On Request', className: 'bg-warning/10 text-warning' },
  unavailable: { label: 'Unavailable', className: 'bg-destructive/10 text-destructive' },
};

function formatPrice(amount: number, currency: string | null | undefined): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function SourcingOptionCard({ option, optionNumber, canManage, onEdit, onDelete }: SourcingOptionCardProps) {
  const status = STATUS_LABELS[option.availability_status || 'available'] || STATUS_LABELS.available;

  return (
    <div className={cn('rounded-lg border p-4 space-y-3', option.is_draft && 'border-warning/40 bg-warning/5')}>
      <div className="flex items-start justify-between gap-2">
        <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
          {optionNumber}
        </Badge>
        <Badge variant="secondary" className={cn('font-normal', status.className)}>
          {status.label}
        </Badge>
      </div>

      {option.is_draft && (
        <p className="text-[10px] font-medium text-warning uppercase tracking-wide">Draft (hidden from Sales)</p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span>{option.operator?.name || 'Operator not set'}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Plane className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium">{option.aircraft_type}</span>
        </div>
      </div>

      <div className="pt-2 border-t flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Operator Cost</p>
          <p className="text-lg font-bold text-primary">{formatPrice(option.base_price, option.currency)}</p>
        </div>
        {canManage && (
          <div className="flex gap-1">
            {onEdit && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

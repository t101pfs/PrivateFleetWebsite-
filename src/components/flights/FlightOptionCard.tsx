import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Plane, Users, Clock, Trash2, Building2, ImageOff, Pencil, Send } from 'lucide-react';
import type { FlightOption } from '@/hooks/useFlightOptions';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

interface FlightOptionCardProps {
  option: FlightOption;
  optionNumber: string;
  isSales: boolean;
  isOperationsOrAdmin: boolean;
  canEdit: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  onPublish?: () => void;
  onToggleSelect?: (selected: boolean) => void;
}

function FlightOptionCardImpl({
  option,
  optionNumber,
  isSales,
  isOperationsOrAdmin,
  canEdit,
  onDelete,
  onEdit,
  onPublish,
  onToggleSelect,
}: FlightOptionCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const specs = option.aircraft_specs || {};
  const images = option.aircraft_images || [];

  return (
    <Card className={cn(
      "transition-all",
      option.is_selected && "ring-2 ring-primary border-primary"
    )}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          {/* Image Carousel */}
          {images.length > 0 ? (
            <div className="relative w-full">
              <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent>
                  {images.map((imageUrl, index) => (
                    <CarouselItem key={index}>
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                          src={imageUrl}
                          alt={`${option.aircraft_type} - Image ${index + 1}`}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                {images.length > 1 && (
                  <>
                    <CarouselPrevious className="left-2 h-7 w-7" />
                    <CarouselNext className="right-2 h-7 w-7" />
                  </>
                )}
              </Carousel>
              {images.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                  {images.length} photos
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <ImageOff className="h-8 w-8 mx-auto mb-1" />
                <span className="text-xs">No images</span>
              </div>
            </div>
          )}

          {/* Details Section - stacked layout for narrow panels */}
          <div className="space-y-3">
            {/* Header Row: Option number, aircraft, selected badge */}
            <div className="flex items-center flex-wrap gap-2">
              {isSales && onToggleSelect && (
                <Checkbox
                  checked={option.is_selected}
                  onCheckedChange={(checked) => onToggleSelect(checked === true)}
                  className="h-5 w-5"
                />
              )}
              <Badge variant="outline" className="text-xs font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                {optionNumber}
              </Badge>
              <div className="flex items-center gap-1.5">
                <Plane className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{option.aircraft_type}</span>
              </div>
              {option.is_selected && (
                <Badge variant="default" className="text-xs px-2 py-0.5">Selected</Badge>
              )}
              {isOperationsOrAdmin && option.is_draft && (
                <Badge variant="outline" className="text-xs px-2 py-0.5 border-warning/40 text-warning">Draft (hidden from Sales)</Badge>
              )}
            </div>

            {/* Manufacturer/Model */}
            {(specs.manufacturer || specs.model) && (
              <p className="text-sm text-muted-foreground">
                {[specs.manufacturer, specs.model].filter(Boolean).join(' ')}
              </p>
            )}

            {/* Specs Grid - single column for narrow view */}
            <div className="grid grid-cols-1 gap-1.5 text-sm">
              {specs.pax && (
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{specs.pax} passengers</span>
                </div>
              )}
              {specs.range && (
                <div className="flex items-center gap-2">
                  <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{specs.range}</span>
                </div>
              )}
              {option.estimated_duration && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{option.estimated_duration}</span>
                </div>
              )}
            </div>

            {specs.cabin_layout && (
              <p className="text-sm text-muted-foreground">{specs.cabin_layout}</p>
            )}

            {/* Available times */}
            {option.available_times && option.available_times.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {option.available_times.map((time, i) => (
                  <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">
                    {time}
                  </Badge>
                ))}
              </div>
            )}

            {/* Operator - only visible to Operations */}
            {isOperationsOrAdmin && option.operator && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                <span>{option.operator.name}</span>
              </div>
            )}

            {/* Price & Actions Row */}
            <div className="pt-2 border-t space-y-2">
              {/* Price breakdown */}
              {specs.price_items && specs.price_items.length > 0 ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Charter Price</span>
                    <span>{formatCurrency(option.base_price - specs.price_items.reduce((s: number, i: any) => s + (i.amount || 0), 0))}</span>
                  </div>
                  {specs.price_items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t font-semibold">
                    <span>Total</span>
                    <span className="text-lg text-primary">{formatCurrency(option.base_price)}</span>
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-lg font-bold text-primary">{formatCurrency(option.base_price)}</span>
                  <p className="text-xs text-muted-foreground">Net price</p>
                </div>
              )}

              <div className="flex items-center justify-end">

              {isOperationsOrAdmin && canEdit && (
                <div className="flex gap-1">
                  {onPublish && option.is_draft && (
                    <Button variant="default" size="sm" onClick={onPublish} className="h-8">
                      <Send className="h-3.5 w-3.5 mr-1" />
                      Publish to Sales
                    </Button>
                  )}
                  {onEdit && (
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const FlightOptionCard = memo(FlightOptionCardImpl, (prev, next) => {
  // Re-render only when meaningful props change. Inline callbacks change each
  // parent render but don't affect rendered output, so we ignore them.
  return (
    prev.option === next.option &&
    prev.optionNumber === next.optionNumber &&
    prev.isSales === next.isSales &&
    prev.isOperationsOrAdmin === next.isOperationsOrAdmin &&
    prev.canEdit === next.canEdit
  );
});

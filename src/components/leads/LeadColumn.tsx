import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { LeadCard } from './LeadCard';
import { formatSAR, LeadRow } from './leadPipeline';

interface LeadColumnProps {
  stage: { value: string; label: string };
  leads: LeadRow[];
  ownerNameById: Map<string, string>;
  onCardClick: (lead: LeadRow) => void;
  accentClassName?: string;
}

export function LeadColumn({ stage, leads, ownerNameById, onCardClick, accentClassName }: LeadColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.value });

  const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="px-1 pb-3">
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold text-sm', accentClassName)}>{stage.label}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
            {leads.length}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">{formatSAR(totalValue)}</div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 rounded-lg p-2 min-h-[200px] transition-colors',
          isOver ? 'bg-accent/10' : 'bg-muted/30'
        )}
      >
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            ownerName={lead.assigned_to ? ownerNameById.get(lead.assigned_to) : undefined}
            onClick={() => onCardClick(lead)}
          />
        ))}
        {leads.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-6">No leads</div>
        )}
      </div>
    </div>
  );
}

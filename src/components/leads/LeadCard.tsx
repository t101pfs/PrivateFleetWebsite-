import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getLeadDisplayName, getOwnerFirstName, getRelativeDateLabel, LeadRow } from './leadPipeline';

interface LeadCardProps {
  lead: LeadRow;
  ownerName?: string;
  onClick: () => void;
}

export function LeadCard({ lead, ownerName, onClick }: LeadCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const dateInfo = getRelativeDateLabel(lead.next_action_date);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow touch-none',
        isDragging && 'opacity-50'
      )}
    >
      <div className="font-semibold text-sm truncate">{getLeadDisplayName(lead)}</div>
      {lead.service_type && (
        <div className="text-xs text-muted-foreground mt-0.5">{lead.service_type}</div>
      )}
      {lead.deal_summary && (
        <div className="text-xs text-muted-foreground mt-1 truncate">{lead.deal_summary}</div>
      )}
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          <span className="text-muted-foreground/70">Owner </span>
          <span className="font-medium text-foreground">{getOwnerFirstName(ownerName, null)}</span>
        </div>
        {dateInfo && (
          <Badge
            variant={dateInfo.overdue ? 'destructive' : 'secondary'}
            className="text-[10px] px-2 py-0"
          >
            {dateInfo.label}
          </Badge>
        )}
      </div>
    </div>
  );
}

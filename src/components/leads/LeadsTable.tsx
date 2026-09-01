import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ChevronRight, Inbox } from 'lucide-react';
import {
  formatSAR,
  getLeadDisplayName,
  getOwnerFirstName,
  getRelativeDateLabel,
  LeadRow,
} from './leadPipeline';

interface LeadsTableProps {
  leads: LeadRow[];
  ownerNameById: Map<string, string>;
  onRowClick: (lead: LeadRow) => void;
}

// Board order — open stages left-to-right, closed stages last — so the
// table reads as a progression the way the old Kanban columns did.
const STAGE_ORDER: Record<string, number> = {
  new: 0,
  qualified: 1,
  pricing: 2,
  quoted: 3,
  negotiation: 4,
  won: 5,
  converted: 5,
  lost: 6,
};

const STAGE_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-muted text-muted-foreground' },
  qualified: { label: 'Qualified', className: 'bg-accent/15 text-accent' },
  pricing: { label: 'Pricing', className: 'bg-warning/15 text-warning' },
  quoted: { label: 'Quoted', className: 'bg-primary/10 text-primary' },
  negotiation: { label: 'Negotiation', className: 'bg-warning/20 text-warning' },
  won: { label: 'Won', className: 'bg-success/15 text-success' },
  converted: { label: 'Won', className: 'bg-success/15 text-success' },
  lost: { label: 'Lost', className: 'bg-destructive/15 text-destructive' },
};

export function LeadsTable({ leads, ownerNameById, onRowClick }: LeadsTableProps) {
  const sorted = [...leads].sort((a, b) => {
    const stageDiff = (STAGE_ORDER[a.status || 'new'] ?? 0) - (STAGE_ORDER[b.status || 'new'] ?? 0);
    if (stageDiff !== 0) return stageDiff;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-muted-foreground">
        <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        No flights match the current filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium text-right">Est. Value</th>
              <th className="px-4 py-3 font-medium">Next Action</th>
              <th className="px-4 py-3 font-medium text-right">Status</th>
              <th className="px-2 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const dateInfo = getRelativeDateLabel(lead.next_action_date);
              const badge = STAGE_BADGE[lead.status || 'new'] || STAGE_BADGE.new;
              return (
                <tr
                  key={lead.id}
                  onClick={() => onRowClick(lead)}
                  className="border-b last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {lead.reference_number || `#${lead.id.slice(0, 8).toUpperCase()}`}
                  </td>
                  <td className="px-4 py-3 min-w-[220px]">
                    <div className="font-medium truncate">{getLeadDisplayName(lead)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[lead.service_type, lead.deal_summary].filter(Boolean).join(' — ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {getOwnerFirstName(lead.assigned_to ? ownerNameById.get(lead.assigned_to) : undefined, null)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatSAR(lead.estimated_value)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {dateInfo ? (
                      <span className={cn('text-xs font-medium', dateInfo.overdue ? 'text-destructive' : 'text-foreground')}>
                        {dateInfo.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant="secondary" className={cn('font-medium', badge.className)}>
                      {badge.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

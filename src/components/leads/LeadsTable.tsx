import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronRight, Inbox } from 'lucide-react';
import {
  getLeadDisplayName,
  getOwnerFirstName,
  isStaleOpen,
  LeadRow,
  LIST_STAGE_BADGE,
  LIST_STAGE_ORDER,
  resolveListStage,
  SERVICE_FIELD_CONFIG,
  STALE_OPEN_DAYS,
} from './leadPipeline';

interface LeadsTableProps {
  leads: LeadRow[];
  ownerNameById: Map<string, string>;
  onRowClick: (lead: LeadRow) => void;
  /** Operations never sees client identity - reference, route/service
   * summary, owner, priority, next action and status stay, the client's
   * name just doesn't render. */
  isOps?: boolean;
  /** lead_ids whose flight has status_sales === 'completed' - the signal
   * that moves a lead from Won to Completed (see resolveListStage). */
  completedLeadIds?: Set<string>;
  /** lead_id -> its flight's (earliest, if more than one) departure_date. */
  departureDateByLeadId?: Map<string, string>;
}

// "Light Jet", "Midsize Jet" etc. - the aircraft category picked when the
// lead was created - leads every deal_summary, baked right into the string.
// It's rarely what the client ends up flying (that's decided during
// sourcing), so it's noise here, not useful routing/at-a-glance info.
const AIRCRAFT_CATEGORIES = new Set(
  Object.values(SERVICE_FIELD_CONFIG).flatMap((c) => c.primaryDescriptorOptions)
);

function stripAircraftCategory(dealSummary: string | null | undefined): string | null {
  if (!dealSummary) return dealSummary ?? null;
  const sepIdx = dealSummary.indexOf(' • ');
  if (sepIdx === -1) return dealSummary;
  return AIRCRAFT_CATEGORIES.has(dealSummary.slice(0, sepIdx)) ? dealSummary.slice(sepIdx + 3) : dealSummary;
}

// "Private Jet Charter" is the default/overwhelming majority of leads, so
// spelling it out here just eats the space the route needs to stay
// readable (especially on a narrow card) without telling the reader
// anything new. Only the less common service types still get named.
function flightSummary(lead: LeadRow) {
  const service = lead.service_type && lead.service_type !== 'Private Jet Charter' ? lead.service_type : null;
  return [service, stripAircraftCategory(lead.deal_summary)].filter(Boolean).join(' — ') || '—';
}

// High priority first, so the most urgent leads surface to the top of the
// table regardless of what pipeline stage they're sitting in. Checked only
// among leads that aren't Lost - see the sort below.
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  high: { label: 'High', className: 'bg-destructive/15 text-destructive' },
  medium: { label: 'Medium', className: 'bg-warning/15 text-warning' },
  low: { label: 'Low', className: 'bg-muted text-muted-foreground' },
};

// Deprecated — this table itself now uses LIST_STAGE_BADGE (the real
// Open/Active/Won/Lost model, from leadPipeline.ts) below. Kept exported
// only because FloatingTeamChat.tsx and Messages.tsx still key their own
// chat-list badges off raw lead.status; left as-is rather than guessing
// at how to thread client_confirmed_at through useTeamChatList.ts too.
export const STAGE_BADGE: Record<string, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-500/15 text-blue-600' },
  qualified: { label: 'Qualified', className: 'bg-warning/15 text-warning' },
  pricing: { label: 'Pricing', className: 'bg-warning/15 text-warning' },
  quoted: { label: 'Quoted', className: 'bg-warning/15 text-warning' },
  negotiation: { label: 'Negotiation', className: 'bg-warning/15 text-warning' },
  won: { label: 'Won', className: 'bg-success/15 text-success' },
  converted: { label: 'Won', className: 'bg-success/15 text-success' },
  lost: { label: 'Lost', className: 'bg-destructive/15 text-destructive' },
};

export function LeadsTable({ leads, ownerNameById, onRowClick, isOps, completedLeadIds, departureDateByLeadId }: LeadsTableProps) {
  const stageFor = (lead: LeadRow) => resolveListStage(lead, completedLeadIds?.has(lead.id));

  const sorted = [...leads].sort((a, b) => {
    // Lost always sinks to the very end, no matter its priority - a
    // high-priority Lost lead was floating up near the top before, since
    // priority used to be checked before status.
    const aLost = stageFor(a) === 'lost' ? 1 : 0;
    const bLost = stageFor(b) === 'lost' ? 1 : 0;
    if (aLost !== bLost) return aLost - bLost;
    const priorityDiff = (PRIORITY_ORDER[a.priority || 'medium'] ?? 1) - (PRIORITY_ORDER[b.priority || 'medium'] ?? 1);
    if (priorityDiff !== 0) return priorityDiff;
    const stageDiff = LIST_STAGE_ORDER[stageFor(a)] - LIST_STAGE_ORDER[stageFor(b)];
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
      {/* Phone: a compact list closer to the desktop table's density - a
          generic label-above-value card (see index.css' "mobile-cards")
          read as too tall and sparse for a list this size. */}
      <div className="md:hidden divide-y">
        {sorted.map((lead) => {
          const departureDate = departureDateByLeadId?.get(lead.id);
          const stage = stageFor(lead);
          const stale = isStaleOpen(lead, stage);
          const badge = LIST_STAGE_BADGE[stage];
          const priorityBadge = PRIORITY_BADGE[lead.priority || 'medium'] || PRIORITY_BADGE.medium;
          const ownerName = getOwnerFirstName(lead.assigned_to ? ownerNameById.get(lead.assigned_to) : undefined, null);
          return (
            <div
              key={lead.id}
              onClick={() => onRowClick(lead)}
              className={cn('flex items-start gap-2 px-4 py-3 active:bg-secondary/20 cursor-pointer', stale && 'bg-warning/5 border-l-2 border-warning')}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {lead.reference_number || `#${lead.id.slice(0, 8).toUpperCase()}`}
                    {lead.created_at && <> · {new Date(lead.created_at).toLocaleDateString()}</>}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stale && (
                      <span title={`No update in ${STALE_OPEN_DAYS}+ days — needs attention`}>
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      </span>
                    )}
                    <Badge variant="secondary" className={cn('font-medium', badge.className)}>
                      {badge.label}
                    </Badge>
                  </div>
                </div>
                <div className="font-medium mt-0.5">{flightSummary(lead)}</div>
                {!isOps && <div className="text-xs text-muted-foreground truncate">{getLeadDisplayName(lead)}</div>}
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground truncate">{ownerName}</span>
                    <Badge variant="secondary" className={cn('font-medium shrink-0', priorityBadge.className)}>
                      {priorityBadge.label}
                    </Badge>
                  </div>
                  {departureDate && (
                    <span className="text-xs font-medium shrink-0 text-foreground">
                      {new Date(departureDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/30 text-left text-xs text-muted-foreground uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">{isOps ? 'Flight' : 'Client'}</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Departure</th>
              <th className="px-4 py-3 font-medium text-right">Status</th>
              <th className="px-2 py-3 w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const departureDate = departureDateByLeadId?.get(lead.id);
              const stage = stageFor(lead);
              const stale = isStaleOpen(lead, stage);
              const badge = LIST_STAGE_BADGE[stage];
              const priorityBadge = PRIORITY_BADGE[lead.priority || 'medium'] || PRIORITY_BADGE.medium;
              return (
                <tr
                  key={lead.id}
                  onClick={() => onRowClick(lead)}
                  className={cn(
                    'border-b last:border-0 hover:bg-secondary/20 cursor-pointer transition-colors',
                    stale && 'bg-warning/5 border-l-2 border-l-warning'
                  )}
                >
                  <td data-label="Reference" className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                    {lead.reference_number || `#${lead.id.slice(0, 8).toUpperCase()}`}
                  </td>
                  <td data-label="Date" className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td data-label={isOps ? 'Flight' : 'Client'} className="px-4 py-3 min-w-[220px]">
                    <div className="font-medium">{flightSummary(lead)}</div>
                    {!isOps && <div className="text-xs text-muted-foreground truncate">{getLeadDisplayName(lead)}</div>}
                  </td>
                  <td data-label="Owner" className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {getOwnerFirstName(lead.assigned_to ? ownerNameById.get(lead.assigned_to) : undefined, null)}
                  </td>
                  <td data-label="Priority" className="px-4 py-3">
                    <Badge variant="secondary" className={cn('font-medium', priorityBadge.className)}>
                      {priorityBadge.label}
                    </Badge>
                  </td>
                  <td data-label="Departure" className="px-4 py-3 whitespace-nowrap">
                    {departureDate ? (
                      <span className="text-xs font-medium text-foreground">
                        {new Date(departureDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td data-label="Status" className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {stale && (
                        <span title={`No update in ${STALE_OPEN_DAYS}+ days — needs attention`}>
                          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        </span>
                      )}
                      <Badge variant="secondary" className={cn('font-medium', badge.className)}>
                        {badge.label}
                      </Badge>
                    </div>
                  </td>
                  <td data-label="" className="px-2 py-3">
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

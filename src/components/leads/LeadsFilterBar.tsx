import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Ban, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLOSED_STAGES, PRIORITIES, OwnerProfile, STAGE_FILTER_OPEN } from './leadPipeline';

export interface LeadFilters {
  service: string;
  stage: string;
  owner: string;
  date: string;
  priority: string;
  /** Lost flights are hidden by default (mixing them in with live work made
   * the list confusing) - this brings them back into view on demand. */
  includeLost: boolean;
  /** Same reasoning as includeLost - won/converted flights are closed work,
   * hidden by default so the table stays focused on what's still open. */
  includeWon: boolean;
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  service: 'all',
  stage: 'all',
  owner: 'all',
  date: 'all',
  priority: 'all',
  includeLost: false,
  includeWon: false,
};

interface LeadsFilterBarProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  serviceOptions: string[];
  owners: OwnerProfile[];
  lostCount: number;
  wonCount: number;
}

const DATE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'week', label: 'Due This Week' },
  { value: 'none', label: 'No Date Set' },
];

export function LeadsFilterBar({ filters, onChange, serviceOptions, owners, lostCount, wonCount }: LeadsFilterBarProps) {
  const set = (key: keyof LeadFilters, value: string) => onChange({ ...filters, [key]: value });

  const activeCount = [
    filters.service !== 'all',
    filters.stage !== 'all',
    filters.owner !== 'all',
    filters.date !== 'all',
    filters.priority !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 justify-center px-1 rounded-full">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 overflow-y-auto"
        style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}
        align="start"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Filters</p>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onChange(DEFAULT_LEAD_FILTERS)}>
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Service</Label>
            <Select value={filters.service} onValueChange={(v) => set('service', v)}>
              <SelectTrigger><SelectValue placeholder="All Services" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Stage</Label>
            <Select
              value={filters.stage}
              onValueChange={(v) => onChange({
                ...filters,
                stage: v,
                includeLost: v === 'lost' ? true : filters.includeLost,
                includeWon: v === 'won' ? true : filters.includeWon,
              })}
            >
              <SelectTrigger><SelectValue placeholder="All Stages" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value={STAGE_FILTER_OPEN}>Open (any stage)</SelectItem>
                {CLOSED_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Owner</Label>
            <Select value={filters.owner} onValueChange={(v) => set('owner', v)}>
              <SelectTrigger><SelectValue placeholder="Owner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Select value={filters.date} onValueChange={(v) => set('date', v)}>
              <SelectTrigger><SelectValue placeholder="Date" /></SelectTrigger>
              <SelectContent>
                {DATE_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <Select value={filters.priority} onValueChange={(v) => set('priority', v)}>
              <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
      </Popover>

      {wonCount > 0 && (
        <Button
          variant={filters.includeWon ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-1.5', filters.includeWon && 'border-success/40 text-success')}
          onClick={() => onChange({ ...filters, includeWon: !filters.includeWon })}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {filters.includeWon ? 'Hide Won' : `Show Won (${wonCount})`}
        </Button>
      )}

      {lostCount > 0 && (
        <Button
          variant={filters.includeLost ? 'secondary' : 'outline'}
          size="sm"
          className={cn('gap-1.5', filters.includeLost && 'border-destructive/40 text-destructive')}
          onClick={() => onChange({ ...filters, includeLost: !filters.includeLost })}
        >
          <Ban className="h-3.5 w-3.5" />
          {filters.includeLost ? 'Hide Lost' : `Show Lost (${lostCount})`}
        </Button>
      )}
    </div>
  );
}

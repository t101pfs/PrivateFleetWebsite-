import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { PIPELINE_STAGES, PRIORITIES, OwnerProfile } from './leadPipeline';

export interface LeadFilters {
  service: string;
  stage: string;
  owner: string;
  date: string;
  priority: string;
}

export const DEFAULT_LEAD_FILTERS: LeadFilters = {
  service: 'all',
  stage: 'all',
  owner: 'all',
  date: 'all',
  priority: 'all',
};

interface LeadsFilterBarProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  serviceOptions: string[];
  owners: OwnerProfile[];
}

const DATE_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due Today' },
  { value: 'week', label: 'Due This Week' },
  { value: 'none', label: 'No Date Set' },
];

export function LeadsFilterBar({ filters, onChange, serviceOptions, owners }: LeadsFilterBarProps) {
  const set = (key: keyof LeadFilters, value: string) => onChange({ ...filters, [key]: value });
  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_LEAD_FILTERS);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={filters.service} onValueChange={(v) => set('service', v)}>
        <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Services" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Services</SelectItem>
          {serviceOptions.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.stage} onValueChange={(v) => set('stage', v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Stages" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Stages</SelectItem>
          {PIPELINE_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.owner} onValueChange={(v) => set('owner', v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Owner" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Owners</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.user_id} value={o.user_id}>{o.full_name || o.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.date} onValueChange={(v) => set('date', v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Date" /></SelectTrigger>
        <SelectContent>
          {DATE_OPTIONS.map((d) => (
            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.priority} onValueChange={(v) => set('priority', v)}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!isDefault && (
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_LEAD_FILTERS)}>
          Reset
        </Button>
      )}
    </div>
  );
}

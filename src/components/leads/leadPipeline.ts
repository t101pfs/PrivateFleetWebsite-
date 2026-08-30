import { format, isPast, isToday, isTomorrow, startOfDay } from 'date-fns';

export interface LeadRow {
  id: string;
  lead_type?: string | null;
  company_name?: string | null;
  company_website?: string | null;
  contact_name?: string | null;
  title?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile_number?: string | null;
  department_name?: string | null;
  government_references?: string | null;
  pa_name?: string | null;
  pa_contact?: string | null;
  notes?: string | null;
  preferred_currency?: string | null;
  billing_entity?: string | null;
  address?: string | null;
  source?: string | null;
  description?: string | null;
  status?: string | null;
  assigned_to?: string | null;
  service_type?: string | null;
  deal_summary?: string | null;
  estimated_value?: number | null;
  priority?: string | null;
  next_action_date?: string | null;
  next_action_time?: string | null;
  next_action_note?: string | null;
  probability?: number | null;
  reference_number?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  converted_to_client_id?: string | null;
  converted_at?: string | null;
  client_id?: string | null;
}

export interface ClientOption {
  id: string;
  company_name: string;
  contact_name?: string | null;
  client_type?: string | null;
  company_website?: string | null;
  mobile_number?: string | null;
  email?: string | null;
  address?: string | null;
  department_name?: string | null;
  title?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  pa_name?: string | null;
  pa_contact?: string | null;
}

export interface FlightRequestSummary {
  id: string;
  status_sales?: string | null;
  created_at?: string | null;
  quotation_id?: string | null;
}

export interface QuoteSummary {
  id: string;
  status?: string | null;
  created_at?: string | null;
}

export interface OwnerProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function getLeadDisplayName(lead: LeadRow): string {
  return (
    lead.company_name ||
    [lead.title, lead.first_name, lead.middle_name, lead.last_name].filter(Boolean).join(' ') ||
    'Unnamed lead'
  );
}

export const PIPELINE_STAGES = [
  { value: 'new', label: 'New' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'negotiation', label: 'Negotiation' },
] as const;

// Terminal stages — shown as their own columns at the end of the board so
// Won/Lost leads stay visible instead of vanishing once closed, but kept
// separate from PIPELINE_STAGES since they don't have probability defaults
// or count toward "open" pipeline stats elsewhere.
export const CLOSED_STAGES = [
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]['value'];

export const STAGE_PROBABILITY_DEFAULTS: Record<PipelineStage, number> = {
  new: 10,
  qualified: 25,
  pricing: 40,
  quoted: 60,
  negotiation: 80,
};

export const SERVICE_TYPES = [
  'Private Jet Charter',
  'Commercial Charter',
  'Medical Charter',
  'Cargo Charter',
  'Helicopter Charter',
  'Aircraft Buying',
  'Flight Support',
] as const;

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type LeadPriority = (typeof PRIORITIES)[number];

export function formatSAR(value: number | null | undefined): string {
  if (!value) return 'SAR 0';
  if (value >= 1_000_000) return `SAR ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `SAR ${(value / 1_000).toFixed(0)}K`;
  return `SAR ${value.toLocaleString()}`;
}

export function getRelativeDateLabel(
  dateStr: string | null | undefined
): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const date = startOfDay(new Date(dateStr));
  const today = startOfDay(new Date());
  const overdue = isPast(date) && !isToday(date);

  if (isToday(date)) return { label: 'Today', overdue: false };
  if (isTomorrow(date)) return { label: 'Tomorrow', overdue: false };

  const daysDiff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (daysDiff > 1 && daysDiff < 7) return { label: format(date, 'EEE'), overdue: false };

  return { label: format(date, 'MMM d'), overdue };
}

function latestByCreatedAt<T extends { created_at?: string | null }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows.reduce((latest, row) => {
    if (!row.created_at) return latest;
    if (!latest.created_at) return row;
    return new Date(row.created_at) > new Date(latest.created_at) ? row : latest;
  }, rows[0]);
}

export interface LeadStatusBadge {
  label: string;
  colorClass: string;
}

export function resolveLeadStatusBadge(
  lead: LeadRow,
  flightRequests: FlightRequestSummary[] = [],
  quotes: QuoteSummary[] = []
): LeadStatusBadge {
  if (lead.status === 'won') return { label: 'Won', colorClass: 'bg-success text-success-foreground' };
  if (lead.status === 'lost') return { label: 'Lost', colorClass: 'bg-destructive text-destructive-foreground' };
  if (lead.converted_to_client_id) return { label: 'Converted', colorClass: 'bg-success text-success-foreground' };

  const latestQuote = latestByCreatedAt(quotes);
  if (latestQuote?.status === 'sent') return { label: 'Quotation Sent', colorClass: 'bg-primary text-primary-foreground' };
  if (latestQuote?.status === 'accepted') return { label: 'Quotation Accepted', colorClass: 'bg-success text-success-foreground' };

  const latestFlight = latestByCreatedAt(flightRequests);
  if (latestFlight?.status_sales === 'confirmed') return { label: 'Confirmed', colorClass: 'bg-success text-success-foreground' };
  if (latestFlight?.status_sales === 'in_progress') return { label: 'In Progress', colorClass: 'bg-warning text-warning-foreground' };

  const stage = PIPELINE_STAGES.find((s) => s.value === lead.status);
  return { label: stage?.label || 'New', colorClass: 'bg-accent text-accent-foreground' };
}

export interface SlaSetting {
  service_type: string | null;
  stage: string | null;
  duration_minutes: number;
}

export function resolveSlaMinutes(
  settings: SlaSetting[],
  serviceType: string | null | undefined,
  stage: string | null | undefined
): number {
  const svc = serviceType ?? null;
  const stg = stage ?? null;
  const exact = settings.find((s) => s.service_type === svc && s.stage === stg);
  if (exact) return exact.duration_minutes;
  const byService = settings.find((s) => s.service_type === svc && s.stage === null);
  if (byService) return byService.duration_minutes;
  const byStage = settings.find((s) => s.service_type === null && s.stage === stg);
  if (byStage) return byStage.duration_minutes;
  const global = settings.find((s) => s.service_type === null && s.stage === null);
  return global?.duration_minutes ?? 60;
}

export function getOwnerFirstName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = fullName || email || 'Unassigned';
  return name.split(' ')[0];
}

export interface CustomServiceField {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'date';
}

export interface ServiceFieldConfig {
  /** 'route' services get a linked flight request (Origin/Destination/Departure/Trip Type/etc). */
  kind: 'route' | 'custom';
  primaryDescriptorLabel: string;
  primaryDescriptorPlaceholder: string;
  /** Dropdown choices for the primary descriptor field, plus a typed "Other" option. */
  primaryDescriptorOptions: string[];
  /** route kind only */
  passengerLabel: string;
  useCargoWeight?: boolean;
  /** custom kind only */
  customFields?: CustomServiceField[];
}

const DEFAULT_SERVICE_FIELD_CONFIG: ServiceFieldConfig = {
  kind: 'custom',
  primaryDescriptorLabel: 'Details',
  primaryDescriptorPlaceholder: 'Brief description',
  primaryDescriptorOptions: [],
  passengerLabel: '',
  customFields: [],
};

export const SERVICE_FIELD_CONFIG: Record<string, ServiceFieldConfig> = {
  'Private Jet Charter': {
    kind: 'route',
    primaryDescriptorLabel: 'Aircraft Preference',
    primaryDescriptorPlaceholder: 'Select aircraft category',
    primaryDescriptorOptions: ['Light Jet', 'Midsize Jet', 'Super-Midsize Jet', 'Heavy Jet', 'Ultra Long Range (ULR)', 'VVIP Airliner'],
    passengerLabel: 'Passengers',
  },
  'Commercial Charter': {
    kind: 'route',
    primaryDescriptorLabel: 'Aircraft Preference',
    primaryDescriptorPlaceholder: 'Select aircraft category',
    primaryDescriptorOptions: ['Narrow-body', 'Wide-body', 'Regional Jet', 'Turboprop'],
    passengerLabel: 'Passengers',
  },
  'Medical Charter': {
    kind: 'route',
    primaryDescriptorLabel: 'Aircraft Preference',
    primaryDescriptorPlaceholder: 'Select configuration',
    primaryDescriptorOptions: ['Air Ambulance', 'ICU Configured', 'Bed-to-Bed', 'Organ Transport'],
    passengerLabel: 'Patients & Crew',
  },
  'Helicopter Charter': {
    kind: 'route',
    primaryDescriptorLabel: 'Aircraft Preference',
    primaryDescriptorPlaceholder: 'Select helicopter class',
    primaryDescriptorOptions: ['Light Helicopter', 'Medium Helicopter', 'Heavy Helicopter', 'VIP Configuration'],
    passengerLabel: 'Passengers',
  },
  'Cargo Charter': {
    kind: 'route',
    primaryDescriptorLabel: 'Aircraft Preference',
    primaryDescriptorPlaceholder: 'Select freighter type',
    primaryDescriptorOptions: ['Small Freighter', 'Medium Freighter', 'Large Freighter', 'Super Freighter'],
    passengerLabel: 'Passengers',
    useCargoWeight: true,
  },
  'Aircraft Buying': {
    kind: 'custom',
    primaryDescriptorLabel: 'Aircraft Type / Model',
    primaryDescriptorPlaceholder: 'Select aircraft category',
    primaryDescriptorOptions: ['Light Jet', 'Midsize Jet', 'Super-Midsize Jet', 'Heavy Jet', 'Ultra Long Range (ULR)', 'Helicopter', 'Turboprop', 'Airliner'],
    passengerLabel: '',
    customFields: [
      { key: 'budget_range', label: 'Budget Range', placeholder: 'e.g. $30M - $40M' },
      { key: 'condition', label: 'New or Pre-Owned', placeholder: 'e.g. Pre-Owned' },
      { key: 'timeline', label: 'Preferred Timeline', placeholder: 'e.g. Q4 2026' },
    ],
  },
  'Flight Support': {
    kind: 'custom',
    primaryDescriptorLabel: 'Support Type',
    primaryDescriptorPlaceholder: 'Select support type',
    primaryDescriptorOptions: ['Handling', 'Fuel', 'Permits', 'Ground Transport', 'Catering', 'Crew Support'],
    passengerLabel: '',
    customFields: [
      { key: 'location', label: 'Location / Airport', placeholder: 'e.g. Jeddah (JED)' },
      { key: 'service_date', label: 'Service Date', type: 'date' },
      { key: 'aircraft_needed', label: 'Aircraft Needing Support', placeholder: 'Tail number / type' },
    ],
  },
};

export function getServiceFieldConfig(serviceType: string | null | undefined): ServiceFieldConfig {
  if (!serviceType) return DEFAULT_SERVICE_FIELD_CONFIG;
  return SERVICE_FIELD_CONFIG[serviceType] || DEFAULT_SERVICE_FIELD_CONFIG;
}

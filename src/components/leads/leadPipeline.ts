import { format, isPast, isToday, isTomorrow, startOfDay } from 'date-fns';

export interface LeadRow {
  id: string;
  lead_type?: string | null;
  company_name?: string | null;
  company_website?: string | null;
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
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  converted_to_client_id?: string | null;
  converted_at?: string | null;
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

export type PipelineStage = (typeof PIPELINE_STAGES)[number]['value'];

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

export function getOwnerFirstName(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = fullName || email || 'Unassigned';
  return name.split(' ')[0];
}

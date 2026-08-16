export interface FlightRequestRow {
  id: string;
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  cargo_weight_kg: number | null;
  preferred_aircraft_category: string | null;
  flexibility_hours: number | null;
  special_requests: string | null;
  status_ops: string;
  assigned_ops_id: string | null;
  assigned_ops_name: string | null;
  submitted_to_ops_at: string | null;
  sla_satisfied_at: string | null;
  lead_id: string | null;
  quotation_id: string | null;
  options_status: string | null;
  created_by: string;
  quotation_approval_status: string;
  quotation_approval_option_id: string | null;
  quotation_approval_requested_at: string | null;
  quotation_approval_requested_by: string | null;
  quotation_approval_decided_at: string | null;
  quotation_approval_decided_by: string | null;
  quotation_approval_notes: string | null;
}

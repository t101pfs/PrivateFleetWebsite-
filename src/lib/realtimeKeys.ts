// Which on-screen data to refresh when a database table changes. Keys are matched
// against the first part of each react-query key. Over-matching is harmless (the
// data is just fetched again); under-matching would leave a screen stale.
const keys = (...parts: string[]) => new RegExp('^(' + parts.join('|') + ')');

const FLIGHT_SCREENS = [
  'flight_requests', 'flight-requests', 'flight-sourcing', 'flight-status', 'flight-history', 'flight-quote',
  'flights', 'ops-', 'approval', 'dashboard', 'lead-flight', 'todays-departures', 'client-flights',
  'message-lead-flights', 'floating-chat-flight-lead', 'leads-for-flight', 'flight-briefing-flight',
  'flight-feedback-flight', 'post-confirm', 'my-accessible', 'deadline-extensions',
];

export const REALTIME_TABLE_KEYS: Record<string, RegExp> = {
  flight_requests: keys(...FLIGHT_SCREENS),
  flight_status_history: keys('flight-status', 'flight-history'),
  deadline_extension_requests: keys('deadline-extensions', 'approval', 'flight-sourcing'),
  option_followups: keys('option-followup', 'flight-sourcing'),
  flight_options: keys('flight_options', 'flight-briefing-option', 'flight-sourcing', 'approval', 'dashboard'),
  flight_passengers: keys('flight-passengers', 'post-confirm', 'flight-briefing'),
  flight_briefings: keys('flight-briefing', 'post-confirm'),
  flight_feedback: keys('flight-feedback', 'post-confirm'),
  catering_requests: keys('catering-requests', 'post-confirm', 'flight-passengers'),
  leads: keys(
    'leads', 'lead', 'potential-clients', 'eligible-lead-owners', 'client-lead-origin', 'message-lead',
    'my-accessible', 'dashboard', 'ops-', 'approval', 'flight-sourcing'
  ),
  lead_team_members: keys('lead-team-members', 'my-lead-chat-ids', 'message-lead', 'lead-team-chat-unread', 'my-accessible'),
  lead_activities: keys('lead-activities', 'flight-sourcing-activities'),
  quotes: keys('quotes', 'lead-quotes', 'flight-quote', 'dashboard', 'flight-sourcing'),
  clients: keys('clients', 'client', 'dashboard'),
  aircraft: keys('aircraft', 'operators', 'dashboard'),
  operators: keys('operators', 'aircraft', 'flight_options'),
  sla_settings: keys('sla-settings', 'ops-'),
  shift_schedules: keys('shift-schedules', 'current-shift', 'profiles-for-shifts', 'admin-profiles'),
  profiles: keys('profiles', 'approvals-profiles', 'admin-profiles', 'eligible-lead-owners', 'option-followup-names', 'approval-review-names'),
  user_roles: keys('profiles', 'eligible-lead-owners', 'admin-profiles'),
  messages: keys('message-leads-unread', 'lead-team-chat-unread'),
  message_reads: keys('message-leads-unread', 'lead-team-chat-unread'),
};

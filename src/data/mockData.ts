import { User, Client, Aircraft, Operator, FlightRequest, ChatMessage, Notification } from '@/types/charter';

export const mockUsers: User[] = [
  { id: '1', name: 'Sarah Mitchell', email: 'sarah@charter.com', role: 'sales', avatar: '' },
  { id: '2', name: 'James Wilson', email: 'james@charter.com', role: 'sales', avatar: '' },
  { id: '3', name: 'Michael Chen', email: 'michael@charter.com', role: 'operations', avatar: '' },
  { id: '4', name: 'Elena Rodriguez', email: 'elena@charter.com', role: 'operations', avatar: '' },
  { id: '5', name: 'David Thompson', email: 'david@charter.com', role: 'admin', avatar: '' },
];

export const mockClients: Client[] = [
  { id: 'c1', name: 'Alexander Sterling', email: 'alex@sterling.com', phone: '+1 555-0101', company: 'Sterling Industries', isVIP: true },
  { id: 'c2', name: 'Victoria Blackwood', email: 'victoria@blackwood.com', phone: '+1 555-0102', company: 'Blackwood Capital', isVIP: true },
  { id: 'c3', name: 'Marcus Chen', email: 'marcus@techventures.com', phone: '+1 555-0103', company: 'Tech Ventures', isVIP: false },
  { id: 'c4', name: 'Isabella Romano', email: 'isabella@romano.com', phone: '+1 555-0104', isVIP: true },
  { id: 'c5', name: 'William Hayes', email: 'william@hayes.com', phone: '+1 555-0105', company: 'Hayes Foundation', isVIP: false },
];

export const mockOperators: Operator[] = [
  { id: 'op1', name: 'SkyElite Aviation', contactName: 'John Parker', contactEmail: 'john@skyelite.com', contactPhone: '+1 555-1001', aircraftCount: 12 },
  { id: 'op2', name: 'Premier Jets', contactName: 'Maria Santos', contactEmail: 'maria@premierjets.com', contactPhone: '+1 555-1002', aircraftCount: 8 },
  { id: 'op3', name: 'Global Wings', contactName: 'Robert Kim', contactEmail: 'robert@globalwings.com', contactPhone: '+1 555-1003', aircraftCount: 15 },
];

export const mockAircraft: Aircraft[] = [
  { id: 'ac1', registration: 'N-ELITE1', type: 'Heavy Jet', model: 'Gulfstream G650', capacity: 14, baseLocation: 'New York (TEB)', operatorId: 'op1' },
  { id: 'ac2', registration: 'N-ELITE2', type: 'Super Midsize', model: 'Challenger 350', capacity: 10, baseLocation: 'Los Angeles (VNY)', operatorId: 'op1' },
  { id: 'ac3', registration: 'N-PREM1', type: 'Light Jet', model: 'Citation CJ4', capacity: 8, baseLocation: 'Miami (OPF)', operatorId: 'op2' },
  { id: 'ac4', registration: 'N-GLOB1', type: 'Ultra Long Range', model: 'Global 7500', capacity: 17, baseLocation: 'London (LTN)', operatorId: 'op3' },
  { id: 'ac5', registration: 'N-GLOB2', type: 'Heavy Jet', model: 'Falcon 8X', capacity: 12, baseLocation: 'Dubai (DWC)', operatorId: 'op3' },
];

export const mockFlightRequests: FlightRequest[] = [
  {
    id: 'fr1',
    clientId: 'c1',
    clientName: 'Alexander Sterling',
    route: { departure: 'New York (TEB)', arrival: 'London (LTN)' },
    date: '2026-01-15',
    time: '08:00',
    passengers: 6,
    specialRequests: 'Catering from Nobu, limousine on arrival',
    statusSales: 'in_progress',
    statusOps: 'aircraft_sourcing',
    assignedOpsId: '3',
    createdAt: '2026-01-06T09:00:00Z',
    updatedAt: '2026-01-06T10:30:00Z',
  },
  {
    id: 'fr2',
    clientId: 'c2',
    clientName: 'Victoria Blackwood',
    route: { departure: 'Los Angeles (VNY)', arrival: 'Aspen (ASE)' },
    date: '2026-01-12',
    time: '14:00',
    passengers: 4,
    specialRequests: 'Pet-friendly, ski equipment storage',
    statusSales: 'confirmed',
    statusOps: 'operator_confirmed',
    assignedOpsId: '4',
    aircraftId: 'ac2',
    operatorId: 'op1',
    createdAt: '2026-01-05T14:00:00Z',
    updatedAt: '2026-01-06T08:00:00Z',
  },
  {
    id: 'fr3',
    clientId: 'c3',
    clientName: 'Marcus Chen',
    route: { departure: 'San Francisco (SFO)', arrival: 'Seattle (BFI)' },
    date: '2026-01-10',
    time: '09:30',
    passengers: 8,
    statusSales: 'new',
    statusOps: 'new',
    createdAt: '2026-01-06T11:00:00Z',
    updatedAt: '2026-01-06T11:00:00Z',
  },
  {
    id: 'fr4',
    clientId: 'c4',
    clientName: 'Isabella Romano',
    route: { departure: 'Miami (OPF)', arrival: 'Nassau (NAS)' },
    date: '2026-01-08',
    time: '11:00',
    passengers: 2,
    specialRequests: 'Champagne service, flower arrangement',
    statusSales: 'completed',
    statusOps: 'flight_executed',
    assignedOpsId: '3',
    aircraftId: 'ac3',
    operatorId: 'op2',
    createdAt: '2026-01-02T10:00:00Z',
    updatedAt: '2026-01-08T18:00:00Z',
  },
];

export const mockChatMessages: ChatMessage[] = [
  { id: 'm1', flightId: 'fr1', senderId: '1', senderName: 'Sarah Mitchell', senderRole: 'sales', content: 'Client requesting departure change to 09:00 if possible', timestamp: '2026-01-06T10:00:00Z' },
  { id: 'm2', flightId: 'fr1', senderId: '3', senderName: 'Michael Chen', senderRole: 'operations', content: 'Checking aircraft availability for the new time slot', timestamp: '2026-01-06T10:15:00Z' },
  { id: 'm3', flightId: 'fr1', senderId: '3', senderName: 'Michael Chen', senderRole: 'operations', content: 'Confirmed - 09:00 departure is available', timestamp: '2026-01-06T10:30:00Z' },
  { id: 'm4', flightId: 'fr2', senderId: '2', senderName: 'James Wilson', senderRole: 'sales', content: 'Client confirmed - they\'ll have 2 dogs on board', timestamp: '2026-01-05T15:00:00Z' },
  { id: 'm5', flightId: 'fr2', senderId: '4', senderName: 'Elena Rodriguez', senderRole: 'operations', content: 'Aircraft is pet-approved, all set', timestamp: '2026-01-05T15:30:00Z' },
];

export const mockNotifications: Notification[] = [
  { id: 'n1', userId: '1', type: 'flight_request', title: 'New Flight Request', message: 'Marcus Chen submitted a new request', read: false, flightId: 'fr3', timestamp: '2026-01-06T11:00:00Z' },
  { id: 'n2', userId: '3', type: 'assignment', title: 'Flight Assigned', message: 'You\'ve been assigned to flight FR-001', read: false, flightId: 'fr1', timestamp: '2026-01-06T09:30:00Z' },
  { id: 'n3', userId: '1', type: 'status_update', title: 'Status Updated', message: 'FR-002 confirmed by operations', read: true, flightId: 'fr2', timestamp: '2026-01-06T08:00:00Z' },
  { id: 'n4', userId: '3', type: 'chat_message', title: 'New Message', message: 'Sarah sent a message on FR-001', read: false, flightId: 'fr1', timestamp: '2026-01-06T10:00:00Z' },
];

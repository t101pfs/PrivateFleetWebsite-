export type UserRole = 'sales' | 'operations' | 'admin' | 'super_admin';

export type FlightStatusSales = 'draft' | 'new' | 'posted' | 'in_progress' | 'confirmed' | 'completed' | 'cancelled' | 'lost';
export type FlightStatusOps = 'new' | 'posted' | 'aircraft_sourcing' | 'operator_confirmed' | 'flight_executed' | 'cancelled' | 'lost';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  isVIP: boolean;
}

export interface Aircraft {
  id: string;
  registration: string;
  type: string;
  model: string;
  capacity: number;
  baseLocation: string;
  operatorId: string;
}

export interface Operator {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  aircraftCount: number;
}

export interface FlightRequest {
  id: string;
  clientId: string;
  clientName: string;
  route: {
    departure: string;
    arrival: string;
  };
  date: string;
  time: string;
  passengers: number;
  specialRequests?: string;
  statusSales: FlightStatusSales;
  statusOps: FlightStatusOps;
  assignedOpsId?: string;
  aircraftId?: string;
  operatorId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  ownerName?: string;
  ownerEmail?: string;
}

export interface ChatMessage {
  id: string;
  flightId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  timestamp: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'flight_request' | 'status_update' | 'chat_message' | 'assignment';
  title: string;
  message: string;
  read: boolean;
  flightId?: string;
  timestamp: string;
}

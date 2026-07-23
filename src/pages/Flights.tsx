import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightRequests } from '@/hooks/useFlightRequests';
import type { FlightRequest } from '@/hooks/useFlightRequests';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { FlightDetailPanel } from '@/components/flights/FlightDetailPanel';
import { CreateFlightDialog } from '@/components/flights/CreateFlightDialog';
import {
  Search, 
  Filter, 
  ArrowRight, 
  Calendar, 
  Users,
  MoreHorizontal,
  MessageSquare,
  Loader2,
  FileEdit,
  Send,
  Clock,
  CheckCircle,
  CheckCheck,
  XCircle,
  Ban,
  Timer,
  UserPlus,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

const statusTabs = ['All', 'Draft', 'Posted', 'In Progress', 'Confirmed', 'Completed', 'Lost', 'Cancelled'];

const statusConfig = [
  { key: 'draft', label: 'Draft', icon: FileEdit, color: 'bg-muted/50 hover:bg-muted text-muted-foreground' },
  { key: 'posted', label: 'Posted', icon: Send, color: 'bg-accent/10 hover:bg-accent/20 text-accent' },
  { key: 'in_progress', label: 'In Progress', icon: Clock, color: 'bg-warning/10 hover:bg-warning/20 text-warning' },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'bg-success/10 hover:bg-success/20 text-success' },
  { key: 'completed', label: 'Completed', icon: CheckCheck, color: 'bg-muted/50 hover:bg-muted text-muted-foreground' },
  { key: 'lost', label: 'Lost', icon: Ban, color: 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-500' },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-destructive/10 hover:bg-destructive/20 text-destructive' },
];

// Estimated flight hours based on common routes (in hours)
// Uses approximate distances and average jet speed of ~500 knots
const estimateFlightHours = (from: string, to: string): string => {
  // Extract ICAO code from route string (e.g., "Jeddah (OEJN)" -> "OEJN")
  const extractICAO = (route: string) => {
    const match = route.match(/\(([A-Z]{4})\)/);
    return match ? match[1] : route.toUpperCase();
  };
  
  const fromCode = extractICAO(from);
  const toCode = extractICAO(to);
  
  // Common Saudi/GCC route distances (approximate flight hours)
  const routeHours: Record<string, number> = {
    // Saudi domestic
    'OEJN-OERK': 1.5,  // Jeddah - Riyadh
    'OERK-OEJN': 1.5,
    'OEJN-OEDF': 2.0,  // Jeddah - Dammam
    'OEDF-OEJN': 2.0,
    'OERK-OEDF': 0.75, // Riyadh - Dammam
    'OEDF-OERK': 0.75,
    'OEJN-OEMA': 1.25, // Jeddah - Medina
    'OEMA-OEJN': 1.25,
    'OERK-OEMA': 1.0,  // Riyadh - Medina
    'OEMA-OERK': 1.0,
    // GCC
    'OEJN-OMDB': 2.5,  // Jeddah - Dubai
    'OMDB-OEJN': 2.5,
    'OERK-OMDB': 2.0,  // Riyadh - Dubai
    'OMDB-OERK': 2.0,
    'OEJN-OTHH': 2.0,  // Jeddah - Doha
    'OTHH-OEJN': 2.0,
    'OERK-OTHH': 1.5,  // Riyadh - Doha
    'OTHH-OERK': 1.5,
    // International common
    'OEJN-EGLL': 6.5,  // Jeddah - London
    'EGLL-OEJN': 6.5,
    'OERK-EGLL': 7.0,  // Riyadh - London
    'EGLL-OERK': 7.0,
    'OEJN-LFPG': 6.0,  // Jeddah - Paris
    'LFPG-OEJN': 6.0,
    'OERK-LFPG': 6.5,  // Riyadh - Paris
    'LFPG-OERK': 6.5,
  };
  
  const routeKey = `${fromCode}-${toCode}`;
  const hours = routeHours[routeKey];
  
  if (hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  
  // Default estimate based on typical regional flight
  return '~2h';
};

export default function Flights() {
  const { user } = useAuth();
  const { flights, isLoading, isSales, isOperations, assignToMe } = useFlightRequests();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);

  // Get fresh flight data from the query results
  const selectedFlight = useMemo(() => {
    if (!selectedFlightId) return null;
    return flights.find(f => f.id === selectedFlightId) || null;
  }, [flights, selectedFlightId]);
  // Calculate status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      draft: 0,
      posted: 0,
      in_progress: 0,
      confirmed: 0,
      completed: 0,
      lost: 0,
      cancelled: 0,
    };
    
    flights.forEach(flight => {
      const s = flight.status_sales;
      const o = flight.status_ops;
      
      // Unified status resolution
      if (s === 'cancelled' || o === 'cancelled') counts.cancelled++;
      else if (s === 'lost' || o === 'lost') counts.lost++;
      else if (s === 'completed' || o === 'flight_executed') counts.completed++;
      else if (s === 'confirmed' || o === 'operator_confirmed') counts.confirmed++;
      else if (s === 'in_progress' || o === 'aircraft_sourcing') counts.in_progress++;
      else if (s === 'posted' || o === 'new') counts.posted++;
      else if (s === 'draft') counts.draft++;
    });
    
    return counts;
  }, [flights]);

  const filteredFlights = flights.filter(flight => {
    // Status filter using unified status resolution
    if (activeTab !== 'All') {
      const tabStatus = activeTab.toLowerCase().replace(/ /g, '_');
      const s = flight.status_sales;
      const o = flight.status_ops;
      
      // Resolve unified status
      let unifiedStatus: string;
      if (s === 'cancelled' || o === 'cancelled') unifiedStatus = 'cancelled';
      else if (s === 'lost' || o === 'lost') unifiedStatus = 'lost';
      else if (s === 'completed' || o === 'flight_executed') unifiedStatus = 'completed';
      else if (s === 'confirmed' || o === 'operator_confirmed') unifiedStatus = 'confirmed';
      else if (s === 'in_progress' || o === 'aircraft_sourcing') unifiedStatus = 'in_progress';
      else if (s === 'posted' || o === 'new') unifiedStatus = 'posted';
      else unifiedStatus = s;
      
      if (unifiedStatus !== tabStatus) return false;
    }
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesRoute = flight.route_from.toLowerCase().includes(query) || 
                          flight.route_to.toLowerCase().includes(query);
      const matchesClient = isSales && flight.client_name?.toLowerCase().includes(query);
      const matchesId = flight.id.toLowerCase().includes(query);
      if (!matchesRoute && !matchesClient && !matchesId) return false;
    }
    
    return true;
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border-border',
    new: 'bg-accent/10 text-accent border-accent/20',
    posted: 'bg-accent/10 text-accent border-accent/20',
    in_progress: 'bg-warning/10 text-warning border-warning/20',
    aircraft_sourcing: 'bg-warning/10 text-warning border-warning/20',
    confirmed: 'bg-success/10 text-success border-success/20',
    operator_confirmed: 'bg-success/10 text-success border-success/20',
    completed: 'bg-muted text-muted-foreground border-border',
    flight_executed: 'bg-muted text-muted-foreground border-border',
    lost: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  // Map internal status codes to display labels
  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    new: 'Posted',
    posted: 'Posted',
    in_progress: 'In Progress',
    aircraft_sourcing: 'In Progress',
    confirmed: 'Confirmed',
    operator_confirmed: 'Confirmed',
    completed: 'Completed',
    flight_executed: 'Completed',
    lost: 'Lost',
    cancelled: 'Cancelled',
  };

  // Check if flight is urgent (departing within 3 days)
  const isUrgent = (flight: FlightRequest) => {
    const daysUntil = differenceInDays(parseISO(flight.departure_date), new Date());
    return daysUntil >= 0 && daysUntil <= 3;
  };

  return (
    <DashboardLayout>
      <div className="flex min-h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
        {/* Main Content */}
        <div className={cn(
          "flex-1 space-y-6 overflow-y-auto pr-0 transition-all duration-300 w-full",
          selectedFlight && !isPanelExpanded && "md:pr-6",
          selectedFlight && "hidden md:block",
          selectedFlight && isPanelExpanded && "md:hidden"
        )}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Flights</h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1">
                {isSales ? 'Manage and track all your charter flights' : 'View and manage all flight operations'}
              </p>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="relative flex-1 min-w-0 sm:w-64 sm:flex-none">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search flights..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
              {isSales && <CreateFlightDialog />}
            </div>
          </div>

          {/* Status Filter Tabs */}
          <div className="bg-card rounded-xl border border-border p-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {statusConfig.map(({ key, label, icon: Icon, color }) => {
                const isActive = activeTab.toLowerCase().replace(/ /g, '_') === key || 
                  (activeTab === 'All' && key === 'all');
                const count = statusCounts[key] || 0;
                
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(label)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : cn("hover:bg-secondary", color)
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                    <span className={cn(
                      "ml-1 px-2 py-0.5 rounded-full text-xs font-bold",
                      isActive 
                        ? "bg-primary-foreground/20 text-primary-foreground" 
                        : "bg-current/10"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {/* All tab */}
              <button
                onClick={() => setActiveTab('All')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ml-auto",
                  activeTab === 'All'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <span>All Flights</span>
                <span className={cn(
                  "ml-1 px-2 py-0.5 rounded-full text-xs font-bold",
                  activeTab === 'All' 
                    ? "bg-primary-foreground/20 text-primary-foreground" 
                    : "bg-muted"
                )}>
                  {flights.length}
                </span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredFlights.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {flights.length === 0 ? 'No flight requests yet' : 'No flights match your filters'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Flight ID
                      </th>
                      {isSales && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Client
                        </th>
                      )}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Flying Hours
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Passengers
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      {isOperations && (
                        <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Assigned To
                        </th>
                      )}
                      <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFlights.map((flight) => {
                      // Use unified status: pick the most meaningful status across both fields
                      const status = (() => {
                        const s = flight.status_sales;
                        const o = flight.status_ops;
                        if (s === 'cancelled' || o === 'cancelled') return 'cancelled';
                        if (s === 'lost' || o === 'lost') return 'lost';
                        if (s === 'completed' || o === 'flight_executed') return 'completed';
                        if (s === 'confirmed' || o === 'operator_confirmed') return 'confirmed';
                        if (s === 'in_progress' || o === 'aircraft_sourcing') return 'in_progress';
                        if (s === 'posted' || o === 'new') return 'posted';
                        return s; // fallback to sales status (draft, etc.)
                      })();
                      const statusLabel = statusLabels[status] || status;
                      const urgent = isUrgent(flight);
                      
                      return (
                        <tr 
                          key={flight.id} 
                          onClick={() => setSelectedFlightId(flight.id)}
                          className={cn(
                            "hover:bg-secondary/30 transition-colors cursor-pointer",
                            selectedFlight?.id === flight.id && "bg-primary/5",
                            urgent && "bg-success/5"
                          )}
                        >
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm font-medium text-foreground">
                              #{flight.id.slice(0, 8).toUpperCase()}
                            </span>
                          </td>
                          {isSales && (
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <span className="text-xs font-semibold text-primary">
                                    {flight.client_name?.charAt(0) || '?'}
                                  </span>
                                </div>
                                <span className="font-medium text-foreground">{flight.client_name || 'Unknown'}</span>
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{flight.route_from}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-medium">{flight.route_to}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm">
                              <Timer className="h-4 w-4 text-primary" />
                              <span className="font-medium">{estimateFlightHours(flight.route_from, flight.route_to)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(flight.departure_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              <span className="text-foreground font-medium">{flight.departure_time}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>{flight.passengers}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {/* Pulsing dot for unassigned posted flights */}
                              {flight.status_sales === 'posted' && !flight.assigned_ops_id && (
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
                                </span>
                              )}
                              <Badge variant="outline" className={cn("capitalize", statusColors[status])}>
                                {statusLabel}
                              </Badge>
                            </div>
                          </td>
                          {isOperations && (
                            <td className="px-6 py-4">
                              {!flight.assigned_ops_id && flight.status_sales === 'posted' ? (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    assignToMe.mutate(flight.id);
                                  }}
                                  disabled={assignToMe.isPending}
                                >
                                  <UserPlus className="h-3.5 w-3.5" />
                                  {assignToMe.isPending ? 'Assigning...' : 'Assign to Me'}
                                </Button>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  {flight.assigned_ops_name || 'Unassigned'}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedFlightId(flight.id);
                                }}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Flight Detail Panel */}
        {selectedFlight && (
          <div className={cn(
            "transition-all duration-300 w-full",
            isPanelExpanded ? "md:w-full" : "md:w-80 md:flex-shrink-0"
          )}>
            <FlightDetailPanel 
              flight={selectedFlight} 
              onClose={() => {
                setSelectedFlightId(null);
                setIsPanelExpanded(false);
              }}
              isExpanded={isPanelExpanded}
              onToggleExpand={() => setIsPanelExpanded(!isPanelExpanded)}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

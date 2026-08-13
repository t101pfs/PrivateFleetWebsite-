import { useNavigate } from 'react-router-dom';
import { FlightRequest } from '@/types/charter';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plane, Calendar, Users, ArrowRight, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface FlightRequestCardProps {
  flight: FlightRequest;
  onClick?: () => void;
}

const statusColorsSales: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  new: 'bg-accent/10 text-accent border-accent/20',
  posted: 'bg-accent/10 text-accent border-accent/20',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-success/10 text-success border-success/20',
  completed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  lost: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const statusColorsOps: Record<string, string> = {
  new: 'bg-accent/10 text-accent border-accent/20',
  posted: 'bg-accent/10 text-accent border-accent/20',
  aircraft_sourcing: 'bg-warning/10 text-warning border-warning/20',
  operator_confirmed: 'bg-success/10 text-success border-success/20',
  flight_executed: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  lost: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
};

const statusLabelsSales: Record<string, string> = {
  draft: 'Draft',
  new: 'New',
  posted: 'Posted',
  in_progress: 'In Progress',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

const statusLabelsOps: Record<string, string> = {
  new: 'New',
  posted: 'Posted',
  aircraft_sourcing: 'In Progress',
  operator_confirmed: 'Confirmed',
  flight_executed: 'Executed',
  cancelled: 'Cancelled',
  lost: 'Lost',
};

export function FlightRequestCard({ flight, onClick }: FlightRequestCardProps) {
  const { effectiveRole } = useAuth();
  const navigate = useNavigate();
  const isSales = effectiveRole === 'sales';
  const isAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const isVIP = flight.clientId === 'c1' || flight.clientId === 'c2' || flight.clientId === 'c4';

  // Use unified status resolution across all roles
  const status = (() => {
    const s = flight.statusSales;
    const o = flight.statusOps;
    if (s === 'cancelled' || o === 'cancelled') return 'cancelled';
    if (s === 'lost' || o === 'lost') return 'lost';
    if (s === 'completed' || o === 'flight_executed') return 'completed';
    if (s === 'confirmed' || o === 'operator_confirmed') return 'confirmed';
    if (s === 'in_progress' || o === 'aircraft_sourcing') return 'in_progress';
    if (s === 'posted' || o === 'new') return 'posted';
    return s;
  })();
  const statusColors = isSales ? statusColorsSales : statusColorsOps;
  const statusLabels = isSales ? statusLabelsSales : statusLabelsOps;

  // Check if departure is within 3 days
  const flightDate = new Date(flight.date);
  const today = new Date();
  const diffTime = flightDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isUrgent = diffDays <= 3 && diffDays >= 0;

  return (
    <div 
      onClick={onClick}
      className={cn(
        "group relative rounded-xl border p-5 transition-all duration-300 cursor-pointer",
        "hover:shadow-lg hover:-translate-y-0.5",
        isUrgent 
          ? "bg-success/10 border-success/30 hover:border-success/50" 
          : "bg-card border-border hover:border-primary/20"
      )}
    >
      {/* VIP Indicator */}
      {isVIP && isSales && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-accent text-accent-foreground text-xs font-bold rounded-bl-lg rounded-tr-xl">
          VIP
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">#{flight.id.slice(0, 8).toUpperCase()}</span>
            <Badge variant="outline" className={cn("text-xs", statusColors[status])}>
              {statusLabels[status]}
            </Badge>
            {isAdmin && flight.ownerName && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                By: {flight.ownerName}
              </span>
            )}
          </div>
          {isSales && (
            <h3 className="font-display font-semibold text-lg text-foreground">
              {flight.clientName}
            </h3>
          )}
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-3 mb-4 p-3 bg-accent/10 rounded-lg">
        <div className="flex-1 text-center">
          <p className="text-xs text-muted-foreground mb-1">From</p>
          <p className="font-semibold text-foreground">{flight.route.departure}</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="w-8 h-px bg-border"></div>
          <Plane className="h-4 w-4 text-primary" />
          <ArrowRight className="h-4 w-4" />
          <div className="w-8 h-px bg-border"></div>
        </div>
        <div className="flex-1 text-center">
          <p className="text-xs text-muted-foreground mb-1">To</p>
          <p className="font-semibold text-foreground">{flight.route.arrival}</p>
        </div>
      </div>

      {/* Details */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          <span>{new Date(flight.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span className="text-foreground font-medium">{flight.time}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          <span>{flight.passengers} pax</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            navigate('/messages');
          }}
        >
          <MessageSquare className="h-4 w-4 mr-1.5" />
          Chat
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/flights?selected=${flight.id}`);
          }}
        >
          View Details
        </Button>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightRequests } from '@/hooks/useFlightRequests';
import type { FlightRequest } from '@/hooks/useFlightRequests';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { FlightDocuments } from './FlightDocuments';
import { FlightOptionsTab } from './FlightOptionsTab';
import { MarkAsLostDialog } from './MarkAsLostDialog';
import { CancelFlightDialog } from './CancelFlightDialog';
import { FlightStatusHistory } from './FlightStatusHistory';
import { EditFlightDialog } from './EditFlightDialog';
import { cn } from '@/lib/utils';
import { 
  X, Plane, Clock, Users, FileText,
  CheckCircle2, Send, UserPlus, AlertCircle, DollarSign, Package, Calendar, Ban, History,
  ChevronLeft, ChevronRight, Maximize2, Minimize2, Trash2, Pencil, XCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FlightDetailPanelProps {
  flight: FlightRequest;
  onClose: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function FlightDetailPanel({ flight, onClose, isExpanded, onToggleExpand }: FlightDetailPanelProps) {
  const { user, supabaseUser } = useAuth();
  const navigate = useNavigate();
  const { postToOperations, assignToMe, confirmFlight, deleteFlight, updateFlightDetails, isSales, isOperations, isAdmin } = useFlightRequests();
  const [showLostDialog, setShowLostDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check if user can edit: Sales creator or Admin, and flight is not confirmed/completed/cancelled
  const isFlightCreator = supabaseUser?.id === flight.created_by;
  const canEdit = (isFlightCreator || isAdmin) && 
    !['confirmed', 'completed', 'cancelled', 'lost'].includes(flight.status_sales);
  // Check scroll state
  const checkScrollState = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollState();
    const tabsElement = tabsRef.current;
    if (tabsElement) {
      tabsElement.addEventListener('scroll', checkScrollState);
      window.addEventListener('resize', checkScrollState);
      return () => {
        tabsElement.removeEventListener('scroll', checkScrollState);
        window.removeEventListener('resize', checkScrollState);
      };
    }
  }, []);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 80;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const isOperationsOrAdmin = isOperations || isAdmin;
  const isConfirmed = flight.status_sales === 'confirmed' || flight.status_sales === 'completed';
  const canAssignToSelf = isOperations && !flight.assigned_ops_id && flight.status_sales === 'posted';
  const canConfirm = isOperationsOrAdmin && flight.aircraft_id && flight.status_sales !== 'confirmed';
  const hasOptionsWorkflowStarted = flight.assigned_ops_id !== null;
  const hasQuotation = flight.quotation_id !== null;
  const isLost = flight.status_sales === 'lost' || flight.status_ops === 'lost';
  const canMarkAsLost = isSales && !isConfirmed && !isLost && flight.status_sales !== 'completed' && flight.status_sales !== 'cancelled';
  const canCancel = !isConfirmed && !isLost && flight.status_sales !== 'completed' && flight.status_sales !== 'cancelled' && 
    ((isSales && flight.created_by === supabaseUser?.id) || isAdmin);
  const canDelete = (isSales && flight.status_sales === 'draft' && flight.created_by === supabaseUser?.id) || isAdmin;

  // Fetch linked quotation for this flight
  const { data: linkedQuote } = useQuery({
    queryKey: ['flight-quote', flight.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, aircraft(tail_number, aircraft_type)')
        .eq('route_from', flight.route_from)
        .eq('route_to', flight.route_to)
        .eq('departure_date', flight.departure_date)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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
    return s;
  })();
  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    new: 'bg-accent text-accent-foreground',
    posted: 'bg-accent text-accent-foreground',
    in_progress: 'bg-warning text-warning-foreground',
    aircraft_sourcing: 'bg-warning text-warning-foreground',
    confirmed: 'bg-success text-success-foreground',
    operator_confirmed: 'bg-success text-success-foreground',
    completed: 'bg-muted text-muted-foreground',
    flight_executed: 'bg-muted text-muted-foreground',
    lost: 'bg-orange-500 text-white',
    cancelled: 'bg-destructive text-destructive-foreground',
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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="h-full bg-card rounded-xl border border-border flex flex-col overflow-hidden">
      {/* Header with ID, Status, and Close */}
      <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted-foreground">#{flight.id.slice(0, 8).toUpperCase()}</span>
          <Badge className={cn("text-xs px-2 py-0.5", statusColors[status])}>{statusLabels[status] || status}</Badge>
          {/* Assign to Me button - next to status for Operations */}
          {canAssignToSelf && (
            <Button 
              size="sm" 
              variant="outline"
              className="h-6 text-xs gap-1 px-2"
              onClick={() => assignToMe.mutate(flight.id)}
              disabled={assignToMe.isPending}
            >
              <UserPlus className="h-3 w-3" />
              {assignToMe.isPending ? 'Assigning...' : 'Assign to Me'}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowEditDialog(true)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit flight details</TooltipContent>
            </Tooltip>
          )}
          {onToggleExpand && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleExpand}>
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isExpanded ? 'Collapse panel' : 'Expand to full screen'}
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>Close panel</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Flight Legs Info */}
      <div className="px-4 py-3 border-b border-border bg-secondary/20 space-y-2.5 flex-shrink-0">
        {/* Check if multi-leg flight */}
        {flight.flight_legs && Array.isArray(flight.flight_legs) && flight.flight_legs.length > 1 ? (
          <div className="space-y-2">
            {/* Flight Type Badge */}
            <div className="flex items-center gap-2 mb-2">
              <Plane className="h-4 w-4 text-primary flex-shrink-0" />
              <Badge variant="outline" className="text-xs">
                {flight.flight_type === 'round_trip' ? 'Round Trip' : `Multi-Leg (${flight.flight_legs.length} legs)`}
              </Badge>
            </div>
            {/* Render each leg */}
            {(flight.flight_legs as Array<{route_from: string; route_to: string; departure_date: string; departure_time: string; passengers: number}>).map((leg, index) => (
              <div key={index} className="pl-6 py-2 border-l-2 border-primary/30 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Leg {index + 1}:</span>
                  <span className="font-semibold text-sm truncate">{leg.route_from}</span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="font-semibold text-sm truncate">{leg.route_to}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>{leg.departure_date}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{leg.departure_time}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span>{leg.passengers} pax</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Single leg - original display */}
            <div className="flex items-center gap-2">
              <Plane className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-semibold text-base truncate">{flight.route_from}</span>
              <span className="text-muted-foreground text-sm">→</span>
              <span className="font-semibold text-base truncate">{flight.route_to}</span>
            </div>
            
            {/* Date, Time, Passengers - Compact Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm bg-muted/50 px-2 py-1 rounded">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{flight.departure_date}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm bg-muted/50 px-2 py-1 rounded">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{flight.departure_time}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm bg-muted/50 px-2 py-1 rounded">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{flight.passengers} pax</span>
              </div>
            </div>
          </>
        )}

        {/* Client */}
        {isSales && flight.client_name && (
          <p className="text-sm text-muted-foreground">Client: <span className="font-medium text-foreground">{flight.client_name}</span></p>
        )}
      </div>

      {isConfirmed && (
        <div className="px-4 py-2 bg-success/10 border-b border-success/20 flex items-center gap-2 flex-shrink-0">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm text-success font-medium">Flight Confirmed</span>
        </div>
      )}

      {isLost && (
        <div className="px-4 py-2 bg-orange-500/10 border-b border-orange-500/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-orange-500 font-medium">Flight Lost</span>
          </div>
          {flight.lost_reason && (
            <p className="text-xs text-muted-foreground mt-1">Reason: {flight.lost_reason}</p>
          )}
        </div>
      )}

      {/* Tabs with Scrollable Content */}
      <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="relative flex-shrink-0">
          {/* Left scroll indicator */}
          {canScrollLeft && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-card to-transparent flex items-center justify-start pl-1"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          
          {/* Right scroll indicator */}
          {canScrollRight && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-card to-transparent flex items-center justify-end pr-1"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          
          <div
            ref={tabsRef}
            className="overflow-x-auto scrollbar-hide"
            onScroll={checkScrollState}
          >
            <TabsList className="w-max justify-start border-b rounded-none bg-transparent px-2 h-10">
              <TabsTrigger value="details" className="text-sm h-8 px-3 gap-1.5"><FileText className="h-4 w-4" />Details</TabsTrigger>
              {(isOperationsOrAdmin || hasOptionsWorkflowStarted) && (
                <TabsTrigger value="options" className="text-sm h-8 px-3 gap-1.5"><Package className="h-4 w-4" />Options</TabsTrigger>
              )}
              
              <TabsTrigger value="history" className="text-sm h-8 px-3 gap-1.5"><History className="h-4 w-4" />History</TabsTrigger>
              
              {isOperationsOrAdmin && <TabsTrigger value="documents" className="text-sm h-8 px-3 gap-1.5"><FileText className="h-4 w-4" />Docs</TabsTrigger>}
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="details" className="p-4 space-y-4 mt-0 pb-8">
            {/* Client Info - Sales only */}
            {isSales && flight.client_name && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Client</p>
                <p className="text-sm font-medium">{flight.client_name}</p>
              </div>
            )}

            {/* Ops Handler */}
            {flight.assigned_ops_name && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Ops Handler</p>
                <p className="text-sm font-medium">{flight.assigned_ops_name}</p>
              </div>
            )}

            {/* Special Requests */}
            {flight.special_requests && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Special Requests</p>
                <p className="text-xs bg-secondary/30 p-2 rounded">{flight.special_requests}</p>
              </div>
            )}

            {/* Aircraft Info - Sales only after confirmed */}
            {isSales && isConfirmed && flight.aircraft && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Aircraft</p>
                <div className="bg-secondary/30 p-2 rounded text-xs">
                  <p className="font-medium">{flight.aircraft.aircraft_type} - {flight.aircraft.model}</p>
                  <p className="text-muted-foreground">Tail: {flight.aircraft.tail_number}</p>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {isSales && flight.status_sales === 'posted' && !flight.assigned_ops_id && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/30 p-2 rounded">
                <AlertCircle className="h-3.5 w-3.5" />Waiting for Operations assignment
              </div>
            )}

            {/* Post to Operations - Sales Draft */}
            {isSales && flight.status_sales === 'draft' && (
              <div className="pt-2 border-t space-y-2">
                <Button onClick={() => postToOperations.mutate(flight.id)} className="w-full h-8 text-xs" disabled={postToOperations.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />{postToOperations.isPending ? 'Posting...' : 'Post to Operations'}
                </Button>
              </div>
            )}

            {/* Mark as Lost - Sales only */}
            {canMarkAsLost && (
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowLostDialog(true)} 
                  className="w-full h-8 text-xs border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
                >
                  <Ban className="h-3.5 w-3.5 mr-1.5" />Mark as Lost
                </Button>
              </div>
            )}

            {/* Cancel Flight */}
            {canCancel && (
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCancelDialog(true)} 
                  className="w-full h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />Cancel Flight
                </Button>
              </div>
            )}

            {/* Delete Flight */}
            {canDelete && (
              <div className="pt-2 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteDialog(true)} 
                  className="w-full h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete Flight
                </Button>
              </div>
            )}

            {/* No additional details message */}
            {!flight.special_requests && !flight.assigned_ops_name && !(isSales && flight.client_name) && !(isSales && isConfirmed && flight.aircraft) && flight.status_sales !== 'draft' && !(isSales && flight.status_sales === 'posted' && !flight.assigned_ops_id) && (
              <div className="text-center py-4">
                <FileText className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">No additional details</p>
              </div>
            )}
          </TabsContent>

          {/* Options Tab */}
          {(isOperationsOrAdmin || hasOptionsWorkflowStarted) && (
            <TabsContent value="options" className="p-4 mt-0 pb-8">
              <FlightOptionsTab
                flightId={flight.id}
                optionsStatus={flight.options_status}
                commissionPercent={flight.commission_percent}
                hasQuotation={hasQuotation}
                canAssignToSelf={canAssignToSelf}
                canConfirm={canConfirm}
                flightRoute={{
                  from: flight.route_from,
                  to: flight.route_to,
                  departureTime: flight.departure_time,
                }}
                assignToMe={assignToMe}
                confirmFlight={confirmFlight}
              />
            </TabsContent>
          )}


          <TabsContent value="history" className="p-4 mt-0 pb-8">
            <FlightStatusHistory flightId={flight.id} />
          </TabsContent>


          {isOperationsOrAdmin && (
            <TabsContent value="documents" className="p-4 mt-0 pb-8">
              <FlightDocuments flightId={flight.id} isConfirmed={isConfirmed} />
            </TabsContent>
          )}
        </div>
      </Tabs>

      <MarkAsLostDialog 
        flightId={flight.id} 
        open={showLostDialog} 
        onOpenChange={setShowLostDialog} 
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flight Request?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the flight request
              from {flight.route_from} to {flight.route_to}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteFlight.mutate(flight.id, {
                  onSuccess: () => {
                    setShowDeleteDialog(false);
                    onClose();
                  },
                });
              }}
            >
              {deleteFlight.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Flight Dialog */}
      <CancelFlightDialog
        flightId={flight.id}
        routeFrom={flight.route_from}
        routeTo={flight.route_to}
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onSuccess={onClose}
      />

      {/* Edit Flight Dialog */}
      <EditFlightDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        flight={flight}
        onSave={async (data) => {
          await updateFlightDetails.mutateAsync({
            flightId: flight.id,
            ...data,
          });
        }}
        isPending={updateFlightDetails.isPending}
      />
    </div>
  );
}

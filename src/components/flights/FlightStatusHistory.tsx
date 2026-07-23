import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { History, ArrowRight, User, Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface StatusHistoryEntry {
  id: string;
  flight_id: string;
  previous_status_sales: string | null;
  new_status_sales: string | null;
  previous_status_ops: string | null;
  new_status_ops: string | null;
  changed_by: string | null;
  changed_by_name: string | null;
  change_reason: string | null;
  created_at: string;
}

interface FlightStatusHistoryProps {
  flightId: string;
}

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  new: 'New',
  posted: 'Posted',
  in_progress: 'In Progress',
  aircraft_sourcing: 'Aircraft Sourcing',
  confirmed: 'Confirmed',
  operator_confirmed: 'Operator Confirmed',
  completed: 'Completed',
  flight_executed: 'Flight Executed',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

const statusColors: Record<string, string> = {
  draft: 'text-muted-foreground',
  new: 'text-accent',
  posted: 'text-accent',
  in_progress: 'text-warning',
  aircraft_sourcing: 'text-warning',
  confirmed: 'text-success',
  operator_confirmed: 'text-success',
  completed: 'text-muted-foreground',
  flight_executed: 'text-muted-foreground',
  lost: 'text-orange-500',
  cancelled: 'text-destructive',
};

function exportToCSV(history: StatusHistoryEntry[], flightId: string) {
  const headers = [
    'Date/Time',
    'Previous Sales Status',
    'New Sales Status',
    'Previous Ops Status',
    'New Ops Status',
    'Changed By',
    'Reason',
  ];

  const rows = history.map((entry) => [
    format(new Date(entry.created_at), 'yyyy-MM-dd HH:mm:ss'),
    statusLabels[entry.previous_status_sales || ''] || entry.previous_status_sales || '',
    statusLabels[entry.new_status_sales || ''] || entry.new_status_sales || '',
    statusLabels[entry.previous_status_ops || ''] || entry.previous_status_ops || '',
    statusLabels[entry.new_status_ops || ''] || entry.new_status_ops || '',
    entry.changed_by_name || '',
    entry.change_reason || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `flight-${flightId.slice(0, 8)}-status-history.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  toast.success('Status history exported to CSV');
}

export function FlightStatusHistory({ flightId }: FlightStatusHistoryProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['flight-status-history', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_status_history')
        .select('*')
        .eq('flight_id', flightId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as StatusHistoryEntry[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-6">
        <History className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">No status changes recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => exportToCSV(history, flightId)}
        >
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
      </div>
      
      <ScrollArea className="h-[180px]">
        <div className="space-y-3">
          {history.map((entry) => {
            const salesChanged = entry.previous_status_sales !== entry.new_status_sales;
            const opsChanged = entry.previous_status_ops !== entry.new_status_ops;

            return (
              <div key={entry.id} className="border-l-2 border-border pl-3 pb-3 relative">
                {/* Timeline dot */}
                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-primary" />
                
                {/* Timestamp */}
                <p className="text-[10px] text-muted-foreground mb-1">
                  {format(new Date(entry.created_at), 'MMM d, yyyy • h:mm a')}
                </p>

                {/* Sales status change */}
                {salesChanged && (
                  <div className="flex items-center gap-1 text-xs mb-0.5">
                    <span className="text-muted-foreground text-[10px]">Sales:</span>
                    <span className={cn("font-medium", statusColors[entry.previous_status_sales || ''])}>
                      {statusLabels[entry.previous_status_sales || ''] || entry.previous_status_sales || 'None'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn("font-medium", statusColors[entry.new_status_sales || ''])}>
                      {statusLabels[entry.new_status_sales || ''] || entry.new_status_sales}
                    </span>
                  </div>
                )}

                {/* Ops status change */}
                {opsChanged && (
                  <div className="flex items-center gap-1 text-xs mb-0.5">
                    <span className="text-muted-foreground text-[10px]">Ops:</span>
                    <span className={cn("font-medium", statusColors[entry.previous_status_ops || ''])}>
                      {statusLabels[entry.previous_status_ops || ''] || entry.previous_status_ops || 'None'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={cn("font-medium", statusColors[entry.new_status_ops || ''])}>
                      {statusLabels[entry.new_status_ops || ''] || entry.new_status_ops}
                    </span>
                  </div>
                )}

                {/* Changed by */}
                {entry.changed_by_name && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                    <User className="h-2.5 w-2.5" />
                    <span>{entry.changed_by_name}</span>
                  </div>
                )}

                {/* Reason (for lost flights) */}
                {entry.change_reason && (
                  <p className="text-[10px] text-muted-foreground mt-1 bg-muted/50 px-2 py-1 rounded">
                    Reason: {entry.change_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowRight, Clock, TrendingDown } from 'lucide-react';
import { useDashboardAlerts } from '@/hooks/useDashboardAlerts';

const STALE_HOURS_LABEL = '48h';

export function AdminAlerts() {
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardAlerts(true);

  const stalledFlights = data?.stalledFlights || [];
  const laggingKPIs = data?.laggingKPIs || [];
  const hasAlerts = stalledFlights.length > 0 || laggingKPIs.length > 0;

  if (isLoading || !hasAlerts) return null;

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-warning">
          <AlertTriangle className="h-4 w-4" />
          Needs Attention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stalledFlights.map((flight) => (
          <div
            key={flight.id}
            onClick={() => navigate(`/flights?selected=${flight.id}`)}
            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border hover:border-warning/40 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <Clock className="h-4 w-4 text-warning shrink-0" />
              <span className="font-medium truncate">
                {flight.routeFrom} → {flight.routeTo}
              </span>
              <span className="text-muted-foreground shrink-0">
                — no update in {STALE_HOURS_LABEL}+
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        ))}

        {laggingKPIs.map((kpi) => (
          <div
            key={kpi.assignmentId}
            onClick={() => navigate('/kpis')}
            className="flex items-center justify-between gap-3 p-3 rounded-lg bg-card border border-border hover:border-warning/40 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 text-sm">
              <TrendingDown className="h-4 w-4 text-warning shrink-0" />
              <span className="font-medium truncate">
                {kpi.name}{kpi.userName ? ` — ${kpi.userName}` : ''}
              </span>
              <span className="text-muted-foreground shrink-0">
                {kpi.percentComplete}% done, {kpi.percentElapsed}% of period elapsed
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

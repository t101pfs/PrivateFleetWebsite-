import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarClock, ArrowRight, Users } from 'lucide-react';
import { useTodaysDepartures } from '@/hooks/useTodaysDepartures';

export function TodaysDepartures() {
  const navigate = useNavigate();
  const { data: departures = [], isLoading } = useTodaysDepartures();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Today's Departures
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : departures.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No departures scheduled for today.
          </div>
        ) : (
          <div className="space-y-2">
            {departures.map((flight) => (
              <div
                key={flight.id}
                onClick={() => navigate(`/flights?selected=${flight.id}`)}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-sm font-semibold text-primary shrink-0">
                    {flight.departureTime}
                  </span>
                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                    <span className="font-medium truncate">{flight.routeFrom}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{flight.routeTo}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {flight.clientName && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {flight.clientName}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {flight.passengers}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

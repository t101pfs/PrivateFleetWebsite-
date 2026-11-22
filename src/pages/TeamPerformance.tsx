import { Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamPerformance } from '@/hooks/useTeamPerformance';
import { emptyPersonMetrics, formatMinutes, type AircraftOptionsStat, type MetricStat, type PersonMetrics } from '@/lib/teamPerformance';

interface MetricColumn {
  key: keyof PersonMetrics;
  label: string;
  hint: string;
}

const COLUMNS: MetricColumn[] = [
  { key: 'requestAcceptance', label: 'Request Pickup', hint: 'Time from a flight being submitted to Ops, to Ops accepting it' },
  { key: 'sourcingWindow', label: 'Sourcing', hint: 'Time from accepting a request to the first aircraft option added, against the sourcing window' },
  { key: 'quotationIssuance', label: 'Quotation Issuance', hint: 'Time from approval to the quotation being issued to the client' },
  { key: 'clientConfirmation', label: 'Client Confirmation', hint: 'Time from quotation issued to the client confirming, against the confirmation window' },
  { key: 'clientContractUpload', label: 'Contract Upload', hint: 'Time from client confirmation to the client contract being uploaded' },
  { key: 'clientContractReview', label: 'Contract Review', hint: 'Time from contract upload to it being reviewed' },
  { key: 'clientContractSign', label: 'Contract Sign-off', hint: 'Time from contract review to it being signed' },
  { key: 'operatorContractSign', label: 'Operator Contract', hint: 'Time from the operator contract being uploaded to it being signed' },
  { key: 'operatorFeedback', label: 'Operator Feedback', hint: 'Operator feedback submitted, against the 3-day deadline after the last leg' },
  { key: 'clientFeedback', label: 'Client Feedback', hint: 'Client feedback submitted, against the 3-day deadline after the last leg' },
];

function MetricCell({ stat }: { stat: MetricStat }) {
  if (stat.count === 0) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }
  const onTimeTone =
    stat.onTimeRate == null
      ? null
      : stat.onTimeRate >= 90
      ? 'text-emerald-600 dark:text-emerald-400'
      : stat.onTimeRate >= 70
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-destructive';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold tabular-nums">{formatMinutes(stat.avgMinutes)}</span>
      <span className="text-[11px] text-muted-foreground">{stat.count} flight{stat.count === 1 ? '' : 's'}</span>
      {stat.onTimeRate != null && (
        <span className={`text-[11px] font-medium tabular-nums ${onTimeTone}`}>{stat.onTimeRate}% on time</span>
      )}
    </div>
  );
}

// Stable per-person color so a given employee always gets the same one,
// regardless of list order (which changes by viewer - Senior Ops sees a
// filtered list) or sort. 8 colorblind-safe hues, validated against this
// app's light/dark card surfaces (see --person-1..8 in index.css).
function personColorVar(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const slot = (Math.abs(hash) % 8) + 1;
  return `var(--person-${slot})`;
}

function AircraftOptionsCell({ stat }: { stat: AircraftOptionsStat }) {
  if (stat.total === 0) {
    return <span className="text-sm text-muted-foreground/50">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-semibold tabular-nums">{stat.total} logged</span>
      <span className="text-[11px] text-muted-foreground tabular-nums">{stat.linkedToOperator} linked to an operator</span>
    </div>
  );
}

export default function TeamPerformance() {
  const { user } = useAuth();
  const { members, metrics, isLoading, canView } = useTeamPerformance();

  if (!canView) {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin/Super Admin get the whole company; Senior Operations is only
  // responsible for the Ops team, so they get just that list - including
  // themselves, since Senior Ops still does their own sourcing work too.
  const visibleMembers =
    user?.role === 'senior_operations'
      ? members.filter((m) => m.role === 'operations' || m.role === 'senior_operations')
      : members;

  const rows = visibleMembers
    .filter((m) => m.full_name?.trim().toLowerCase() !== 'test' && !m.email?.toLowerCase().startsWith('test@'))
    .map((m) => ({ member: m, metrics: metrics.get(m.user_id) ?? emptyPersonMetrics() }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Gauge className="h-7 w-7 text-accent" />
            Team Performance
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            How fast each person moves on what they're responsible for, and whether it lands inside the windows that already govern it elsewhere in the app.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading performance data…
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No activity has been recorded yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Each card only shows the steps that person has actually done — a step missing from their card means they haven't reached it yet, not that they're late.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map(({ member, metrics: m }) => {
                const filledColumns = COLUMNS.filter((col) => m[col.key].count > 0);
                const hasAircraftOptions = m.aircraftOptionsLogged.total > 0;
                const color = personColorVar(member.user_id);
                return (
                  <Card key={member.user_id} style={{ borderLeft: `3px solid ${color}` }}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{member.full_name || member.email}</p>
                          <Badge variant="outline" className="w-fit mt-0.5 text-[10px] capitalize">
                            {member.role.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </div>
                      {filledColumns.length === 0 && !hasAircraftOptions ? (
                        <p className="text-xs text-muted-foreground/70">No activity recorded yet.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                          {filledColumns.map((col) => (
                            <div key={col.key} title={col.hint}>
                              <p className="text-[11px] text-muted-foreground mb-0.5">{col.label}</p>
                              <MetricCell stat={m[col.key]} />
                            </div>
                          ))}
                          {hasAircraftOptions && (
                            <div title="Aircraft options this person has logged, and how many are complete (aircraft linked to an operator)">
                              <p className="text-[11px] text-muted-foreground mb-0.5">Aircraft Options</p>
                              <AircraftOptionsCell stat={m.aircraftOptionsLogged} />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

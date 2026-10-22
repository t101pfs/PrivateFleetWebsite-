import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gauge, Loader2 } from 'lucide-react';
import { useTeamPerformance } from '@/hooks/useTeamPerformance';
import { emptyPersonMetrics, formatMinutes, type MetricStat, type PersonMetrics } from '@/lib/teamPerformance';

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

export default function TeamPerformance() {
  const { members, metrics, isLoading, isRealAdmin } = useTeamPerformance();

  if (!isRealAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const rows = members
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Employee Turnaround</CardTitle>
              <p className="text-xs text-muted-foreground">
                Only steps a person actually completed count toward their average. A blank cell means they haven't done that step yet, not that they're late.
              </p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[1100px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 sticky left-0 bg-card text-sm font-semibold text-foreground">Employee</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap" title={col.hint}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ member, metrics: m }) => (
                    <tr key={member.user_id} className="border-b border-border/50 last:border-0">
                      <td className="py-3 pr-4 sticky left-0 bg-card">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">{member.full_name || member.email}</span>
                          <Badge variant="outline" className="w-fit mt-0.5 text-[10px] capitalize">
                            {member.role.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </td>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="py-3 px-3">
                          <MetricCell stat={m[col.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

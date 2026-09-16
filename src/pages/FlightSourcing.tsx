import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OperationsSourcingView } from '@/components/flights/OperationsSourcingView';
import { SalesOptionReviewView } from '@/components/flights/SalesOptionReviewView';
import { FlightHistoryLog } from '@/components/flights/FlightHistoryLog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, FileText } from 'lucide-react';

export default function FlightSourcing() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { effectiveRole } = useAuth();
  const isAdminOrSuperAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';

  if (!id) return null;

  // Sales and Ops only ever see their own side, matching the business
  // boundary (ops never sees client identity, sales never sees
  // operator/cost). Admin/Super Admin see everything at once instead of
  // switching between two exclusive views - nothing is actually hidden
  // from them at the API level either way, so there's no reason to make
  // them pick one perspective and lose the other.
  if (isAdminOrSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Package className="h-4 w-4" />
              Operations
            </div>
            <OperationsSourcingView flightId={id} embedded />
          </div>

          <div className="space-y-3 border-t pt-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <FileText className="h-4 w-4" />
              Sales
            </div>
            <SalesOptionReviewView flightId={id} embedded />
          </div>

          <div className="border-t pt-8">
            <FlightHistoryLog flightId={id} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return effectiveRole === 'operations'
    ? <OperationsSourcingView flightId={id} />
    : <SalesOptionReviewView flightId={id} />;
}

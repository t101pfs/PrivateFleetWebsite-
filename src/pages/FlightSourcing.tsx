import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { OperationsSourcingView } from '@/components/flights/OperationsSourcingView';
import { SalesOptionReviewView } from '@/components/flights/SalesOptionReviewView';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export default function FlightSourcing() {
  const { id } = useParams<{ id: string }>();
  const { effectiveRole } = useAuth();
  const isAdminOrSuperAdmin = effectiveRole === 'admin' || effectiveRole === 'super_admin';
  const [adminPerspective, setAdminPerspective] = useState<'operations' | 'sales'>('operations');

  if (!id) return null;

  // Sales and Ops only ever see their own side, matching the business
  // boundary (ops never sees client identity, sales never sees
  // operator/cost). Admin/Super Admin see everything either way (no data
  // is actually hidden from them at the API level), so this is just a
  // perspective switch for whichever layout is more useful right now -
  // e.g. adding an option on Ops's behalf, or reviewing what Sales sees.
  // Both views already render their own full DashboardLayout, so this
  // floats on top rather than wrapping a second layout around them.
  const view = isAdminOrSuperAdmin
    ? (adminPerspective === 'operations' ? <OperationsSourcingView flightId={id} /> : <SalesOptionReviewView flightId={id} />)
    : (effectiveRole === 'operations' ? <OperationsSourcingView flightId={id} /> : <SalesOptionReviewView flightId={id} />);

  return (
    <>
      {isAdminOrSuperAdmin && (
        <ToggleGroup
          type="single"
          value={adminPerspective}
          onValueChange={(v) => v && setAdminPerspective(v as typeof adminPerspective)}
          className="fixed top-4 right-4 z-50 bg-card border rounded-lg p-1 shadow-md"
        >
          <ToggleGroupItem value="operations" className="text-xs px-3">Ops View</ToggleGroupItem>
          <ToggleGroupItem value="sales" className="text-xs px-3">Sales View</ToggleGroupItem>
        </ToggleGroup>
      )}
      {view}
    </>
  );
}

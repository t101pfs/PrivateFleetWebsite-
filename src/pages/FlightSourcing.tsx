import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { OperationsSourcingView } from '@/components/flights/OperationsSourcingView';
import { SalesOptionReviewView } from '@/components/flights/SalesOptionReviewView';

export default function FlightSourcing() {
  const { id } = useParams<{ id: string }>();
  const { effectiveRole } = useAuth();

  if (!id) return null;

  return effectiveRole === 'operations'
    ? <OperationsSourcingView flightId={id} />
    : <SalesOptionReviewView flightId={id} />;
}

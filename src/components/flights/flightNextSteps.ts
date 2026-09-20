import type { FlightRequestRow } from './flightSourcingTypes';

export type StepOwner = 'Sales' | 'Operations' | 'Admin';

export interface NextStep {
  owner: StepOwner;
  text: string;
}

/** What still has to happen, and who has to do it, once the quotation has been
 * issued. Empty means every step is done. Follows the same locks as the
 * Confirmation & Contracts panel (availability first, then any discount
 * decision, then the Client Contract). */
export function getNextSteps(flight: FlightRequestRow): NextStep[] {
  if (!flight.client_confirmed_at) {
    return [{
      owner: 'Sales',
      text: 'Send the quotation to the client. When they agree, click "Confirm with Client". If they need more time, use "Follow up / Extend 1 hour".',
    }];
  }

  const steps: NextStep[] = [];
  const legacyNoAvailability = !flight.availability_confirmed_at && !!flight.client_contract_uploaded_at;
  const availabilityOk = !!flight.availability_confirmed_at || legacyNoAvailability;
  const discountPending = flight.discount_request_status === 'pending';

  if (!availabilityOk) {
    steps.push({ owner: 'Operations', text: 'Confirm with the operator that the aircraft is still available, or report it as not available.' });
  }
  if (discountPending) {
    steps.push({ owner: 'Admin', text: "Accept or reject the client's discount request in the Approval Queue — the Client Contract is locked until then." });
  }

  if (!flight.client_contract_uploaded_at) {
    if (availabilityOk && !discountPending) {
      steps.push({ owner: 'Sales', text: 'Upload the Client Contract and send it to the client.' });
    }
    return steps;
  }

  if (!flight.client_contract_signed_at) {
    steps.push({ owner: 'Sales', text: 'When the client has signed, click "Mark as Signed".' });
  }
  if (!flight.payment_proof_uploaded_at) {
    steps.push({ owner: 'Sales', text: "Upload the client's proof of payment." });
  }
  if (!flight.operator_contract_uploaded_at) {
    steps.push({ owner: 'Operations', text: 'Upload the Operator Contract and choose which Admin signs it.' });
  } else if (!flight.operator_contract_signed_at) {
    steps.push({
      owner: 'Admin',
      text: flight.payment_proof_uploaded_at
        ? 'Sign the Operator Contract: download it, sign it, then upload the signed copy.'
        : 'Sign the Operator Contract once the proof of payment is in: download it, sign it, then upload the signed copy.',
    });
  }
  return steps;
}

/** One-line version for places that only have room for a single next step. */
export function nextStepSummary(flight: FlightRequestRow): string {
  const steps = getNextSteps(flight);
  if (steps.length === 0) return 'All contract steps are complete';
  const first = steps[0];
  return `${first.owner}: ${first.text}`;
}

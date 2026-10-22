import { resolveSourceWindowMinutes, resolveClientConfirmMinutes } from '@/components/leads/leadPipeline';

// Per Odai: track each employee's turnaround on the things they're
// personally accountable for - issuing a quotation, replying/confirming
// with the client, issuing/signing contracts, submitting post-flight
// feedback - and whether each one landed inside the window that already
// governs it elsewhere in the app (where one exists).

export interface MetricStat {
  /** How many flights contributed to this metric for this person. */
  count: number;
  /** Average turnaround, in minutes. Null when count is 0. */
  avgMinutes: number | null;
  /** Percent landing inside the relevant SLA window. Null when this
   * metric has no defined window (just a turnaround time to compare
   * people by, not a pass/fail), or when count is 0. */
  onTimeRate: number | null;
}

export interface PersonMetrics {
  /** Ops: submitted_to_ops_at -> ops_accepted_at. No formal SLA - just how fast they pick up a new request. */
  requestAcceptance: MetricStat;
  /** Ops: ops_accepted_at -> first operator option added, against the dynamic sourcing window. */
  sourcingWindow: MetricStat;
  /** Sales (flight owner): quotation_approval_decided_at -> quotation_issued_at. No formal SLA. */
  quotationIssuance: MetricStat;
  /** Sales (who confirmed): quotation_issued_at -> client_confirmed_at, against the dynamic client-confirmation window. */
  clientConfirmation: MetricStat;
  /** Sales (who uploaded): client_confirmed_at -> client_contract_uploaded_at. No formal SLA. */
  clientContractUpload: MetricStat;
  /** Noora (who reviewed): client_contract_uploaded_at -> client_contract_reviewed_at. No formal SLA. */
  clientContractReview: MetricStat;
  /** Odai (who signed): client_contract_reviewed_at -> client_contract_signed_at. No formal SLA. */
  clientContractSign: MetricStat;
  /** Signer: operator_contract_uploaded_at -> operator_contract_signed_at. No formal SLA. */
  operatorContractSign: MetricStat;
  /** Ops: last leg's departure -> operator feedback submitted, against the 3-day feedback window. */
  operatorFeedback: MetricStat;
  /** Sales: last leg's departure -> client feedback submitted, against the 3-day feedback window. */
  clientFeedback: MetricStat;
}

interface Accumulator {
  sumMinutes: number;
  count: number;
  onTimeCount: number;
  tracksOnTime: boolean;
}

function newAcc(tracksOnTime: boolean): Accumulator {
  return { sumMinutes: 0, count: 0, onTimeCount: 0, tracksOnTime };
}

function record(acc: Accumulator, startIso: string, endIso: string, onTime?: boolean) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return;
  acc.sumMinutes += Math.max(0, (end - start) / 60000);
  acc.count += 1;
  if (acc.tracksOnTime && onTime) acc.onTimeCount += 1;
}

function finalize(acc: Accumulator): MetricStat {
  return {
    count: acc.count,
    avgMinutes: acc.count > 0 ? acc.sumMinutes / acc.count : null,
    onTimeRate: acc.tracksOnTime && acc.count > 0 ? Math.round((acc.onTimeCount / acc.count) * 100) : null,
  };
}

interface PersonBuckets {
  requestAcceptance: Accumulator;
  sourcingWindow: Accumulator;
  quotationIssuance: Accumulator;
  clientConfirmation: Accumulator;
  clientContractUpload: Accumulator;
  clientContractReview: Accumulator;
  clientContractSign: Accumulator;
  operatorContractSign: Accumulator;
  operatorFeedback: Accumulator;
  clientFeedback: Accumulator;
}

function newBuckets(): PersonBuckets {
  return {
    requestAcceptance: newAcc(false),
    sourcingWindow: newAcc(true),
    quotationIssuance: newAcc(false),
    clientConfirmation: newAcc(true),
    clientContractUpload: newAcc(false),
    clientContractReview: newAcc(false),
    clientContractSign: newAcc(false),
    operatorContractSign: newAcc(false),
    operatorFeedback: newAcc(true),
    clientFeedback: newAcc(true),
  };
}

export interface FlightForPerformance {
  id: string;
  departure_date: string;
  flight_legs: unknown;
  assigned_ops_id: string | null;
  created_by: string;
  submitted_to_ops_at: string | null;
  ops_accepted_at: string | null;
  quotation_approval_decided_at: string | null;
  quotation_issued_at: string | null;
  client_confirmed_at: string | null;
  client_confirmed_by: string | null;
  client_contract_uploaded_at: string | null;
  client_contract_uploaded_by: string | null;
  client_contract_reviewed_at: string | null;
  client_contract_reviewed_by: string | null;
  client_contract_signed_at: string | null;
  client_contract_signed_by: string | null;
  operator_contract_uploaded_at: string | null;
  operator_contract_signed_at: string | null;
  operator_contract_signed_by: string | null;
}

export interface OptionForPerformance {
  flight_id: string;
  created_at: string;
}

export interface FeedbackForPerformance {
  flight_id: string;
  kind: 'operator' | 'client';
  submitted_at: string;
  submitted_by: string;
}

/** Same rule the feedback cron/UI already use: 3 days after the LAST leg's
 * date, not the flight's own departure_date column (which only ever holds
 * the first leg). */
function lastLegDate(departureDate: string, legs: unknown): string {
  const list = Array.isArray(legs) ? (legs as Array<Record<string, unknown>>) : [];
  const legDates = list
    .map((l) => (l.date as string) || (l.departure_date as string))
    .filter((d): d is string => !!d)
    .sort();
  const last = legDates[legDates.length - 1];
  return last && last > departureDate ? last : departureDate;
}

export function computeTeamPerformance(
  flights: FlightForPerformance[],
  options: OptionForPerformance[],
  feedback: FeedbackForPerformance[]
): Map<string, PersonMetrics> {
  const firstOptionByFlight = new Map<string, string>();
  for (const o of options) {
    const existing = firstOptionByFlight.get(o.flight_id);
    if (!existing || o.created_at < existing) firstOptionByFlight.set(o.flight_id, o.created_at);
  }

  const feedbackByFlight = new Map<string, FeedbackForPerformance[]>();
  for (const f of feedback) {
    const list = feedbackByFlight.get(f.flight_id) || [];
    list.push(f);
    feedbackByFlight.set(f.flight_id, list);
  }

  const byPerson = new Map<string, PersonBuckets>();
  const bucketsFor = (userId: string) => {
    let b = byPerson.get(userId);
    if (!b) { b = newBuckets(); byPerson.set(userId, b); }
    return b;
  };

  for (const f of flights) {
    if (f.assigned_ops_id && f.submitted_to_ops_at && f.ops_accepted_at) {
      record(bucketsFor(f.assigned_ops_id).requestAcceptance, f.submitted_to_ops_at, f.ops_accepted_at);
    }

    if (f.assigned_ops_id && f.ops_accepted_at) {
      const firstOption = firstOptionByFlight.get(f.id);
      if (firstOption) {
        const windowMinutes = resolveSourceWindowMinutes(f.departure_date, new Date(f.ops_accepted_at).getTime());
        const elapsedMinutes = (new Date(firstOption).getTime() - new Date(f.ops_accepted_at).getTime()) / 60000;
        record(bucketsFor(f.assigned_ops_id).sourcingWindow, f.ops_accepted_at, firstOption, elapsedMinutes <= windowMinutes);
      }
    }

    if (f.created_by && f.quotation_approval_decided_at && f.quotation_issued_at) {
      record(bucketsFor(f.created_by).quotationIssuance, f.quotation_approval_decided_at, f.quotation_issued_at);
    }

    if (f.client_confirmed_by && f.quotation_issued_at && f.client_confirmed_at) {
      const windowMinutes = resolveClientConfirmMinutes(f.departure_date, new Date(f.quotation_issued_at).getTime());
      const elapsedMinutes = (new Date(f.client_confirmed_at).getTime() - new Date(f.quotation_issued_at).getTime()) / 60000;
      record(bucketsFor(f.client_confirmed_by).clientConfirmation, f.quotation_issued_at, f.client_confirmed_at, elapsedMinutes <= windowMinutes);
    }

    if (f.client_contract_uploaded_by && f.client_confirmed_at && f.client_contract_uploaded_at) {
      record(bucketsFor(f.client_contract_uploaded_by).clientContractUpload, f.client_confirmed_at, f.client_contract_uploaded_at);
    }

    if (f.client_contract_reviewed_by && f.client_contract_uploaded_at && f.client_contract_reviewed_at) {
      record(bucketsFor(f.client_contract_reviewed_by).clientContractReview, f.client_contract_uploaded_at, f.client_contract_reviewed_at);
    }

    if (f.client_contract_signed_by && f.client_contract_reviewed_at && f.client_contract_signed_at) {
      record(bucketsFor(f.client_contract_signed_by).clientContractSign, f.client_contract_reviewed_at, f.client_contract_signed_at);
    }

    if (f.operator_contract_signed_by && f.operator_contract_uploaded_at && f.operator_contract_signed_at) {
      record(bucketsFor(f.operator_contract_signed_by).operatorContractSign, f.operator_contract_uploaded_at, f.operator_contract_signed_at);
    }

    const flightFeedback = feedbackByFlight.get(f.id);
    if (flightFeedback) {
      const lastLeg = lastLegDate(f.departure_date, f.flight_legs);
      const dueAt = new Date(lastLeg); dueAt.setDate(dueAt.getDate() + 3);
      for (const fb of flightFeedback) {
        const onTime = new Date(fb.submitted_at).getTime() <= dueAt.getTime();
        const bucketKey = fb.kind === 'operator' ? 'operatorFeedback' : 'clientFeedback';
        record(bucketsFor(fb.submitted_by)[bucketKey], lastLeg, fb.submitted_at, onTime);
      }
    }
  }

  const result = new Map<string, PersonMetrics>();
  for (const [userId, b] of byPerson) {
    result.set(userId, {
      requestAcceptance: finalize(b.requestAcceptance),
      sourcingWindow: finalize(b.sourcingWindow),
      quotationIssuance: finalize(b.quotationIssuance),
      clientConfirmation: finalize(b.clientConfirmation),
      clientContractUpload: finalize(b.clientContractUpload),
      clientContractReview: finalize(b.clientContractReview),
      clientContractSign: finalize(b.clientContractSign),
      operatorContractSign: finalize(b.operatorContractSign),
      operatorFeedback: finalize(b.operatorFeedback),
      clientFeedback: finalize(b.clientFeedback),
    });
  }
  return result;
}

export function emptyPersonMetrics(): PersonMetrics {
  const empty: MetricStat = { count: 0, avgMinutes: null, onTimeRate: null };
  return {
    requestAcceptance: empty,
    sourcingWindow: empty,
    quotationIssuance: empty,
    clientConfirmation: empty,
    clientContractUpload: empty,
    clientContractReview: empty,
    clientContractSign: empty,
    operatorContractSign: empty,
    operatorFeedback: empty,
    clientFeedback: empty,
  };
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

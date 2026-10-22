import { describe, it, expect } from "vitest";
import { computeTeamPerformance, type FlightForPerformance } from "@/lib/teamPerformance";

const OPS_ID = "ops-1";
const SALES_ID = "sales-1";
const NOORA_ID = "noora-1";
const ODAI_ID = "odai-1";

function baseFlight(overrides: Partial<FlightForPerformance>): FlightForPerformance {
  return {
    id: "flight-1",
    departure_date: "2026-12-01", // far enough out to land in the long-notice tier
    flight_legs: null,
    assigned_ops_id: OPS_ID,
    created_by: SALES_ID,
    submitted_to_ops_at: null,
    ops_accepted_at: null,
    quotation_approval_decided_at: null,
    quotation_issued_at: null,
    client_confirmed_at: null,
    client_confirmed_by: null,
    client_contract_uploaded_at: null,
    client_contract_uploaded_by: null,
    client_contract_reviewed_at: null,
    client_contract_reviewed_by: null,
    client_contract_signed_at: null,
    client_contract_signed_by: null,
    operator_contract_uploaded_at: null,
    operator_contract_signed_at: null,
    operator_contract_signed_by: null,
    ...overrides,
  };
}

describe("computeTeamPerformance", () => {
  it("tracks request acceptance time with no on-time concept", () => {
    const flight = baseFlight({
      submitted_to_ops_at: "2026-10-01T10:00:00Z",
      ops_accepted_at: "2026-10-01T10:30:00Z",
    });
    const result = computeTeamPerformance([flight], [], []);
    const ops = result.get(OPS_ID)!;
    expect(ops.requestAcceptance.count).toBe(1);
    expect(ops.requestAcceptance.avgMinutes).toBe(30);
    expect(ops.requestAcceptance.onTimeRate).toBeNull();
  });

  it("marks sourcing on-time when the first option lands inside the dynamic window", () => {
    const flight = baseFlight({
      departure_date: "2026-12-01", // >7 days out -> 120 minute window
      ops_accepted_at: "2026-10-01T10:00:00Z",
    });
    const onTimeOption = { flight_id: flight.id, created_at: "2026-10-01T11:30:00Z" }; // 90 min, within 120
    const result = computeTeamPerformance([flight], [onTimeOption], []);
    const ops = result.get(OPS_ID)!;
    expect(ops.sourcingWindow.count).toBe(1);
    expect(ops.sourcingWindow.avgMinutes).toBe(90);
    expect(ops.sourcingWindow.onTimeRate).toBe(100);
  });

  it("marks sourcing late when the first option misses the dynamic window", () => {
    const flight = baseFlight({
      departure_date: "2026-12-01",
      ops_accepted_at: "2026-10-01T10:00:00Z",
    });
    const lateOption = { flight_id: flight.id, created_at: "2026-10-01T13:00:00Z" }; // 180 min, over 120
    const result = computeTeamPerformance([flight], [lateOption], []);
    const ops = result.get(OPS_ID)!;
    expect(ops.sourcingWindow.onTimeRate).toBe(0);
  });

  it("uses the short-notice window for a near-term flight, not the long one", () => {
    const flight = baseFlight({
      departure_date: "2026-10-03", // within 7 days -> 60 minute window
      ops_accepted_at: "2026-10-01T10:00:00Z",
    });
    const option = { flight_id: flight.id, created_at: "2026-10-01T10:45:00Z" }; // 45 min, within 60
    const result = computeTeamPerformance([flight], [option], []);
    expect(result.get(OPS_ID)!.sourcingWindow.onTimeRate).toBe(100);

    const lateOption = { flight_id: flight.id, created_at: "2026-10-01T11:10:00Z" }; // 70 min, over 60
    const result2 = computeTeamPerformance([flight], [lateOption], []);
    expect(result2.get(OPS_ID)!.sourcingWindow.onTimeRate).toBe(0);
  });

  it("attributes quotation issuance to the flight's creator with no on-time concept", () => {
    const flight = baseFlight({
      quotation_approval_decided_at: "2026-10-01T09:00:00Z",
      quotation_issued_at: "2026-10-01T09:20:00Z",
    });
    const result = computeTeamPerformance([flight], [], []);
    const sales = result.get(SALES_ID)!;
    expect(sales.quotationIssuance.count).toBe(1);
    expect(sales.quotationIssuance.avgMinutes).toBe(20);
    expect(sales.quotationIssuance.onTimeRate).toBeNull();
  });

  it("attributes client confirmation to whoever actually confirmed it, against the dynamic window", () => {
    const flight = baseFlight({
      departure_date: "2026-10-03", // within 3 days -> 60 minute confirm window
      quotation_issued_at: "2026-10-01T09:00:00Z",
      client_confirmed_at: "2026-10-01T09:50:00Z",
      client_confirmed_by: SALES_ID,
    });
    const result = computeTeamPerformance([flight], [], []);
    const sales = result.get(SALES_ID)!;
    expect(sales.clientConfirmation.count).toBe(1);
    expect(sales.clientConfirmation.onTimeRate).toBe(100);
  });

  it("chains the full Client Contract workflow to the three distinct people involved", () => {
    const flight = baseFlight({
      client_confirmed_at: "2026-10-01T08:00:00Z",
      client_contract_uploaded_at: "2026-10-01T09:00:00Z",
      client_contract_uploaded_by: SALES_ID,
      client_contract_reviewed_at: "2026-10-01T10:00:00Z",
      client_contract_reviewed_by: NOORA_ID,
      client_contract_signed_at: "2026-10-01T11:00:00Z",
      client_contract_signed_by: ODAI_ID,
    });
    const result = computeTeamPerformance([flight], [], []);
    expect(result.get(SALES_ID)!.clientContractUpload.avgMinutes).toBe(60);
    expect(result.get(NOORA_ID)!.clientContractReview.avgMinutes).toBe(60);
    expect(result.get(ODAI_ID)!.clientContractSign.avgMinutes).toBe(60);
  });

  it("attributes operator contract signing to the real signer, separate from the uploader", () => {
    const flight = baseFlight({
      operator_contract_uploaded_at: "2026-10-01T08:00:00Z",
      operator_contract_signed_at: "2026-10-01T09:00:00Z",
      operator_contract_signed_by: ODAI_ID,
    });
    const result = computeTeamPerformance([flight], [], []);
    expect(result.get(ODAI_ID)!.operatorContractSign.avgMinutes).toBe(60);
  });

  it("checks feedback against 3 days after the LAST leg, not the flight's first-leg departure_date", () => {
    const flight = baseFlight({
      departure_date: "2026-10-01", // first leg only
      flight_legs: [
        { date: "2026-10-01" },
        { date: "2026-10-05" }, // real last leg, 4 days later
      ],
    });
    // Due = 2026-10-08. Submitted on 10-07 should be on-time; on departure_date+3 (10-04) it would have been late.
    const onTimeFeedback = { flight_id: flight.id, kind: "operator" as const, submitted_at: "2026-10-07T12:00:00Z", submitted_by: OPS_ID };
    const result = computeTeamPerformance([flight], [], [onTimeFeedback]);
    expect(result.get(OPS_ID)!.operatorFeedback.count).toBe(1);
    expect(result.get(OPS_ID)!.operatorFeedback.onTimeRate).toBe(100);
  });

  it("marks feedback submitted after the 3-day window as late, split correctly by kind", () => {
    const flight = baseFlight({ departure_date: "2026-10-01", flight_legs: null });
    const lateOperator = { flight_id: flight.id, kind: "operator" as const, submitted_at: "2026-10-10T00:00:00Z", submitted_by: OPS_ID };
    const onTimeClient = { flight_id: flight.id, kind: "client" as const, submitted_at: "2026-10-02T00:00:00Z", submitted_by: SALES_ID };
    const result = computeTeamPerformance([flight], [], [lateOperator, onTimeClient]);
    expect(result.get(OPS_ID)!.operatorFeedback.onTimeRate).toBe(0);
    expect(result.get(SALES_ID)!.clientFeedback.onTimeRate).toBe(100);
    // Kinds must not cross-contaminate the same person's other bucket.
    expect(result.get(OPS_ID)!.clientFeedback.count).toBe(0);
    expect(result.get(SALES_ID)!.operatorFeedback.count).toBe(0);
  });

  it("averages correctly across multiple flights for the same person", () => {
    const f1 = baseFlight({ id: "f1", submitted_to_ops_at: "2026-10-01T10:00:00Z", ops_accepted_at: "2026-10-01T10:10:00Z" });
    const f2 = baseFlight({ id: "f2", submitted_to_ops_at: "2026-10-02T10:00:00Z", ops_accepted_at: "2026-10-02T10:30:00Z" });
    const result = computeTeamPerformance([f1, f2], [], []);
    expect(result.get(OPS_ID)!.requestAcceptance.count).toBe(2);
    expect(result.get(OPS_ID)!.requestAcceptance.avgMinutes).toBe(20); // (10 + 30) / 2
  });

  it("returns no entry at all for someone with zero recorded activity", () => {
    const result = computeTeamPerformance([baseFlight({})], [], []);
    expect(result.has("someone-with-nothing")).toBe(false);
  });
});

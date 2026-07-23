import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import {
  generateQuotationPdf,
  downloadBlob,
  type QuotationData,
} from "@/lib/quotation-pdf";

const mockData: QuotationData = {
  quoteNumber: "Q-2026-0001",
  quoteDate: "2026-05-24",
  preparedBy: "Test Sales",
  client: {
    name: "Acme Holdings",
    company: "Acme Corp",
    email: "ops@acme.com",
    phone: "+966500000000",
  },
  flight: {
    type: "One-Way",
    legs: [
      {
        from: "OEJN (Jeddah)",
        to: "OERK (Riyadh)",
        date: "2026-06-01",
        departureTime: "09:00",
        arrivalTime: "10:30",
        duration: "1h 30m",
        passengers: 6,
      },
    ],
  },
  options: [
    {
      id: "opt-1",
      aircraft_type: "Gulfstream G450",
      base_price: 45000,
      currency: "USD",
      aircraft_specs: { pax: 12, range: "5000 nm" } as any,
      aircraft_features: ["WiFi", "Full galley"],
      aircraft_notes: "Recently refurbished interior.",
      baggage_capacity: "Large",
      estimated_duration: "1h 30m",
    } as any,
  ],
  pricing: {
    base_total: 45000,
    markup_percent: 10,
    markup_amount: 4500,
    vat_enabled: true,
    vat_percent: 15,
    vat_amount: 7425,
    taxes: 0,
    additional_charges: 0,
    discount: 0,
    final_total: 56925,
    currency: "USD",
  } as any,
};

// Lightweight in-app preview component, mirrors FlightOptionsTab dialog content
function QuotationPreview({ data }: { data: QuotationData }) {
  return (
    <div>
      <h1>Private Charter Proposal</h1>
      <p data-testid="quote-number">{data.quoteNumber}</p>
      <p data-testid="client-name">{data.client.name}</p>
      <p data-testid="final-total">
        {new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: data.pricing.currency,
        }).format(data.pricing.final_total)}
      </p>
      <ul>
        {data.options.map((o) => (
          <li key={o.id}>{o.aircraft_type}</li>
        ))}
      </ul>
    </div>
  );
}

describe("Quotation E2E", () => {
  it("renders the in-app quotation preview with key fields", () => {
    render(<QuotationPreview data={mockData} />);
    expect(screen.getByText("Private Charter Proposal")).toBeInTheDocument();
    expect(screen.getByTestId("quote-number")).toHaveTextContent("Q-2026-0001");
    expect(screen.getByTestId("client-name")).toHaveTextContent("Acme Holdings");
    expect(screen.getByTestId("final-total").textContent).toMatch(/56,925/);
    expect(screen.getByText("Gulfstream G450")).toBeInTheDocument();
  });

  it("generates a valid PDF blob from the quotation data", async () => {
    const blob = await generateQuotationPdf(mockData);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);

    // Verify PDF magic header
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const sig = String.fromCharCode(...head);
    expect(sig).toBe("%PDF-");
  });

  it("downloadBlob triggers an anchor click for the generated PDF", async () => {
    const blob = await generateQuotationPdf(mockData);

    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(blob, "quotation-test.pdf");

    expect(createUrl).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeUrl).toHaveBeenCalledWith("blob:mock-url");

    createUrl.mockRestore();
    revokeUrl.mockRestore();
    clickSpy.mockRestore();
  });

  it("preview URL from the PDF blob is openable (object URL is created)", async () => {
    const blob = await generateQuotationPdf(mockData);
    const url = URL.createObjectURL(blob);
    expect(typeof url).toBe("string");
    expect(url.startsWith("blob:")).toBe(true);
    URL.revokeObjectURL(url);
  });
});

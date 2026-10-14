import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateQuotationPdf, type QuotationData } from '@/lib/quotation-pdf';
import { estimateFlightTime, addMinutesToClock } from '@/lib/flightTime';
import type { PricingBreakdown } from '@/components/flights/PricingBuilder';
import type { FlightOption } from '@/hooks/useFlightOptions';

interface QuotationLeg {
  from?: string; to?: string; route_from?: string; route_to?: string;
  date?: string; departure_date?: string;
  departureTime?: string; departure_time?: string;
  passengers?: number;
}

interface FlightContact {
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_number: string | null;
}

interface FlightWithClient {
  route_from: string;
  route_to: string;
  departure_date: string;
  departure_time: string;
  passengers: number;
  client_name: string | null;
  flight_type: string | null;
  flight_legs: QuotationLeg[] | null;
  clients: FlightContact | null;
  leads: FlightContact | null;
}

// Re-derives the same QuotationData shape usePrepareQuotation builds when
// a quote is first issued, but read-only: no new quotes row, no flight
// status change, no Ops notification. The quote's own number/total/
// currency come straight from the stored quotes row (what was actually
// sent), while the per-aircraft option breakdown is read live off
// flight_options - the closest available stand-in, since that detail was
// never persisted onto the quote itself.
export function useViewQuotationPdf() {
  const [isLoading, setIsLoading] = useState(false);

  const view = async (quoteId: string, flightId: string) => {
    setIsLoading(true);
    try {
      const { data: quote, error: quoteErr } = await supabase
        .from('quotes')
        .select('quote_number, total_price, currency, created_at')
        .eq('id', quoteId)
        .single();
      if (quoteErr) throw quoteErr;

      const { data: flightData, error: flightErr } = await supabase
        .from('flight_requests')
        .select('*, clients(company_name, first_name, last_name, email, phone, mobile_number), leads(company_name, first_name, last_name, email, phone, mobile_number)')
        .eq('id', flightId)
        .single();
      if (flightErr) throw flightErr;
      const flight = flightData as unknown as FlightWithClient;

      const { data: optionRows, error: optionsErr } = await supabase
        .from('flight_options')
        .select('*')
        .eq('flight_id', flightId)
        .eq('is_selected', true);
      if (optionsErr) throw optionsErr;
      const options = (optionRows || []) as unknown as FlightOption[];

      const contact = flight.clients || flight.leads;
      const clientName = contact
        ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.company_name || flight.client_name || 'Client'
        : flight.client_name || 'Client';

      const legsRaw = flight.flight_legs;
      const rawLegs = Array.isArray(legsRaw) && legsRaw.length > 0
        ? legsRaw.map((l) => ({
            from: l.from || l.route_from || '',
            to: l.to || l.route_to || '',
            date: l.date || l.departure_date || flight.departure_date,
            departureTime: l.departureTime || l.departure_time || flight.departure_time || '',
            passengers: Number(l.passengers || flight.passengers || 1),
          }))
        : [{
            from: flight.route_from,
            to: flight.route_to,
            date: flight.departure_date,
            departureTime: flight.departure_time || '',
            passengers: Number(flight.passengers || 1),
          }];

      const aircraftCategory = options[0]?.aircraft_specs?.category;
      const legs = rawLegs.map((leg) => {
        const estimate = estimateFlightTime(leg.from, leg.to, aircraftCategory);
        const arrivalTime = estimate && leg.departureTime ? addMinutesToClock(leg.departureTime, estimate.minutes) : null;
        return { ...leg, duration: estimate?.label, arrivalTime: arrivalTime || undefined };
      });

      const currency = quote.currency || options[0]?.currency || 'USD';
      const pricing: PricingBreakdown = {
        currency,
        base_total: options[0]?.base_price ?? (Number(quote.total_price) || 0),
        markup_percent: 0,
        markup_amount: 0,
        vat_enabled: false,
        vat_percent: 0,
        vat_amount: 0,
        taxes: 0,
        additional_charges: 0,
        discount: 0,
        final_total: Number(quote.total_price) || 0,
      };

      // No surviving option rows (e.g. a very old quote) - fall back to a
      // single stand-in line from the quote's own stored total, so the PDF
      // still has something to show rather than an empty options table.
      const effectiveOptions: FlightOption[] = options.length > 0
        ? options
        : [{
            id: 'stored-total',
            flight_id: flightId,
            aircraft_type: 'Aircraft',
            aircraft_specs: {},
            available_times: null,
            estimated_duration: null,
            base_price: Number(quote.total_price) || 0,
            aircraft_images: null,
            operator_id: null,
            is_selected: true,
            created_by: '',
            created_at: quote.created_at,
            updated_at: quote.created_at,
            currency,
            price_override: Number(quote.total_price) || 0,
          } as FlightOption];

      const data: QuotationData = {
        quoteNumber: quote.quote_number,
        quoteDate: new Date(quote.created_at).toLocaleDateString('en-GB'),
        preparedBy: 'Private Fleet Services',
        client: {
          name: clientName,
          company: contact?.company_name ?? undefined,
          email: contact?.email ?? undefined,
          phone: contact?.phone || contact?.mobile_number || undefined,
        },
        flight: { type: flight.flight_type || 'one_way', legs },
        options: JSON.parse(JSON.stringify(effectiveOptions)),
        optionTotals: Object.fromEntries(effectiveOptions.map((o) => [
          o.id,
          { commission: 0, vat: 0, total: o.price_override ?? (Number(quote.total_price) || 0), currency: o.currency || currency },
        ])),
        pricing,
      };

      const blob = await generateQuotationPdf(data);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Revoke once the new tab has had a chance to load it, not
      // immediately - an instant revoke can race the browser's fetch of
      // the blob: URL and leave the tab blank.
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) {
      toast.error('Failed to open quotation: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return { view, isLoading };
}

import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import type { FlightOption } from '@/hooks/useFlightOptions';
import type { PricingBreakdown } from '@/components/flights/PricingBuilder';
import logoDark from '@/assets/pfs-crest.png';

// Matches the real PFS letterhead exactly: plain black text on white, thin
// gray table borders, light gray alternating rows. The logo graphic is the
// only splash of color, same as on the actual template.
const COLORS = {
  text: '#1A1A1A',
  muted: '#4A4A4A',
  border: '#333333',
  borderLight: '#999999',
  rowShade: '#EEEEEE',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 60, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: COLORS.text, backgroundColor: COLORS.white },

  // ===== Letterhead (every page) =====
  // Three regions the width of the page: contact info on the left, the logo
  // dead-center, and an empty region on the right the same width as the
  // contact column so the logo sits centered on the page, not just centered
  // between wherever the contact text happens to end.
  letterhead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  contactCol: { width: 230 },
  contactBrand: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 3 },
  contactLine: { fontSize: 8.5, color: COLORS.text, lineHeight: 1.5 },
  logoCol: { flex: 1, alignItems: 'center' },
  logoSpacer: { width: 230 },
  logoImg: { width: 60, height: 60, objectFit: 'contain' },
  brandWord: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: 1, marginTop: 4 },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  brandRuleLine: { width: 14, height: 1, backgroundColor: COLORS.borderLight },
  brandRuleWord: { fontSize: 7, color: COLORS.muted, letterSpacing: 2, marginHorizontal: 5 },

  // ===== Footer (every page) =====
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40 },
  footerRule: { borderTop: `0.5 solid ${COLORS.borderLight}`, marginBottom: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.5 },
  footerPageNum: { fontSize: 8, color: COLORS.text, fontFamily: 'Helvetica-Bold' },

  // ===== Page 1 — cover letter =====
  quoteTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: 0.5, marginBottom: 16 },
  dateLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 16 },
  greeting: { fontSize: 10.5, color: COLORS.text, marginBottom: 12 },
  introText: { fontSize: 10, color: COLORS.text, lineHeight: 1.6, marginBottom: 18 },

  table: { border: `1 solid ${COLORS.border}` },
  tableHeadRow: { flexDirection: 'row', backgroundColor: COLORS.rowShade },
  tableHeadCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, paddingVertical: 8, paddingHorizontal: 6, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  tableBodyRow: { flexDirection: 'row', borderTop: `0.5 solid ${COLORS.border}` },
  tableBodyCell: { fontSize: 9, color: COLORS.text, paddingVertical: 9, paddingHorizontal: 6, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },

  bullets: { marginTop: 20 },
  bulletRow: { flexDirection: 'row', marginBottom: 4 },
  bulletText: { fontSize: 9.5, color: COLORS.text, flex: 1, lineHeight: 1.5 },

  // ===== Aircraft option pages =====
  acTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: COLORS.text, textAlign: 'center', marginTop: 30, marginBottom: 26, letterSpacing: 1 },
  acTable: { border: `1 solid ${COLORS.border}` },
  acRow: { flexDirection: 'row', borderTop: `0.5 solid ${COLORS.border}` },
  acRowFirst: { flexDirection: 'row' },
  acLabelCell: { width: '45%', paddingVertical: 10, paddingHorizontal: 10, fontSize: 9.5, color: COLORS.text, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  acValueCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 9.5, color: COLORS.text, textAlign: 'center' },
  acPriceLabel: { width: '45%', paddingVertical: 10, paddingHorizontal: 10, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  acPriceValue: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, textAlign: 'center' },

  acPicsLabel: { fontSize: 10, color: COLORS.text, textAlign: 'center', marginTop: 60 },
  acGallery: { marginTop: 24, gap: 14 },
  acImg: { width: '100%', height: 330, objectFit: 'cover', border: `1 solid ${COLORS.border}`, backgroundColor: COLORS.white },

  // ===== Final page — terms & acceptance =====
  sectionHeading: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: COLORS.text, textAlign: 'center', textDecoration: 'underline', marginBottom: 22, marginTop: 10 },
  termRow: { fontSize: 10, color: COLORS.text, lineHeight: 1.6, marginBottom: 8 },
  termRule: { borderTop: `1 solid ${COLORS.text}`, marginTop: 14, marginBottom: 36 },

  acceptanceNote: { fontSize: 9.5, color: COLORS.text, lineHeight: 1.6, marginBottom: 60 },
  fieldsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fieldCol: { alignItems: 'center' },
  fieldLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 30 },
  fieldLine: { fontSize: 12, color: COLORS.text, letterSpacing: 1 },
});

export interface QuotationData {
  quoteNumber: string;
  quoteDate: string;
  preparedBy: string;
  client: { name: string; company?: string; email?: string; phone?: string };
  flight: {
    type: string;
    legs: Array<{
      from: string; to: string; date: string; departureTime: string;
      arrivalTime?: string; duration?: string; passengers: number;
    }>;
  };
  options: FlightOption[];
  optionTotals?: Record<string, { commission: number; vat: number; total: number; currency: string }>;
  pricing: PricingBreakdown;
  terms?: string[];
  inclusions?: string[];
  exclusions?: string[];
}

const DEFAULT_TERMS = [
  'All offers are subject to aircraft and crew serviceability and availability.',
  'All quoted prices are including taxes and 15% VAT if applicable.',
  'Any changes in routes or any additional needs may change the quoted prices.',
];

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// Letterhead — identical on every page, including pages a long photo
// gallery spills onto (`fixed`, same as the footer), mirrors the real
// template exactly.
const Letterhead = () => (
  <View style={styles.letterhead} fixed>
    <View style={styles.contactCol}>
      <Text style={styles.contactBrand}>PRIVATE FLEET SERVICES</Text>
      <Text style={styles.contactLine}>KSA, Jeddah , King Abdulaziz Rd.</Text>
      <Text style={styles.contactLine}>CR: 4030284062</Text>
      <Text style={styles.contactLine}>M: +966559952727</Text>
      <Text style={styles.contactLine}>E: info@privatefleetservices.com</Text>
      <Text style={styles.contactLine}>www.privatefleetservices.com</Text>
    </View>
    <View style={styles.logoCol}>
      <Image src={logoDark} style={styles.logoImg} />
      <Text style={styles.brandWord}>PRIVATE FLEET</Text>
      <View style={styles.brandRule}>
        <View style={styles.brandRuleLine} />
        <Text style={styles.brandRuleWord}>SERVICES</Text>
        <View style={styles.brandRuleLine} />
      </View>
    </View>
    <View style={styles.logoSpacer} />
  </View>
);

// Footer — identical on every page, mirrors the real template exactly.
const Footer = () => (
  <View style={styles.footer} fixed>
    <View style={styles.footerRule} />
    <View style={styles.footerRow}>
      <View>
        <Text style={styles.footerText}>KSA, Jeddah, Al Morjan Dist. King Abdulaziz Rd.</Text>
        <Text style={styles.footerText}>info@privatefleetservices.com  /  www.privatefleetservices.com</Text>
      </View>
      <Text style={styles.footerPageNum} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  </View>
);

export function QuotationDocument({ data }: { data: QuotationData }) {
  const terms = data.terms?.length ? data.terms : DEFAULT_TERMS;

  return (
    <Document>
      {/* ============ PAGE 1 — QUOTATION LETTER ============ */}
      <Page size="A4" style={styles.page}>
        <Letterhead />

        <Text style={styles.quoteTitle}>QUOTATION {data.quoteNumber}</Text>
        <Text style={styles.dateLabel}>Date: {data.quoteDate}</Text>

        <Text style={styles.greeting}>Dear {data.client.name || 'Sir'},</Text>
        <Text style={styles.introText}>
          Thank you for your enquiry, we are pleased to give you offers for the following route :
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.tableHeadCell, { width: '16%' }]}>Leg Date</Text>
            <Text style={[styles.tableHeadCell, { width: '32%' }]}>Route</Text>
            <Text style={[styles.tableHeadCell, { width: '13%' }]}>DepTime</Text>
            <Text style={[styles.tableHeadCell, { width: '13%' }]}>ArrTime</Text>
            <Text style={[styles.tableHeadCell, { width: '14%' }]}>FltTime</Text>
            <Text style={[styles.tableHeadCell, { width: '12%', borderRight: 'none' }]}>Pax</Text>
          </View>
          {data.flight.legs.map((leg, i) => (
            <View key={i} style={styles.tableBodyRow}>
              <Text style={[styles.tableBodyCell, { width: '16%' }]}>{leg.date}</Text>
              <Text style={[styles.tableBodyCell, { width: '32%' }]}>{leg.from} - {leg.to}</Text>
              <Text style={[styles.tableBodyCell, { width: '13%' }]}>{leg.departureTime}</Text>
              <Text style={[styles.tableBodyCell, { width: '13%' }]}>{leg.arrivalTime || ''}</Text>
              <Text style={[styles.tableBodyCell, { width: '14%' }]}>{leg.duration || ''}</Text>
              <Text style={[styles.tableBodyCell, { width: '12%', borderRight: 'none' }]}>{leg.passengers}</Text>
            </View>
          ))}
        </View>

        <View style={styles.bullets}>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletText}>* Kindly find the Aircraft offers in the next pages with pictures.</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletText}>* Kindly find this Quotation Terms &amp; Conditions in the last page.</Text>
          </View>
        </View>

        <Footer />
      </Page>

      {/* ============ AIRCRAFT PAGES — ONE PER OPTION ============ */}
      {data.options.map((opt, idx) => {
        const totals = data.optionTotals?.[opt.id];
        const optCurrency = totals?.currency || opt.currency || data.pricing.currency;
        const displayTotal = totals?.total ?? opt.base_price;
        // Everything uploaded for this aircraft, one big photo per row so
        // each stays large and clear - spills onto extra pages by itself
        // when there are more photos than one page holds. The floor plan
        // always comes last regardless of upload order.
        const photos: Array<{ src: string; plan: boolean }> = [
          ...(((opt as any).aircraft_images || []) as string[]).map((src) => ({ src, plan: false })),
          ...(((opt as any).interior_images || []) as string[]).map((src) => ({ src, plan: false })),
          ...((opt as any).layout_image ? [{ src: (opt as any).layout_image as string, plan: true }] : []),
        ]
          .filter((p) => !!p.src)
          .sort((a, b) => Number(a.plan) - Number(b.plan));
        const label = `A${idx + 1}`;

        return (
          <Page key={opt.id} size="A4" style={styles.page}>
            <Letterhead />

            <Text style={styles.acTitle}>{label}</Text>

            <View style={styles.acTable}>
              <View style={styles.acRowFirst}>
                <Text style={styles.acLabelCell}>Aircraft type</Text>
                <Text style={styles.acValueCell}>{opt.aircraft_type || ''}</Text>
              </View>
              <View style={[styles.acRow, { backgroundColor: COLORS.rowShade }]}>
                <Text style={styles.acLabelCell}>Pax capacity</Text>
                <Text style={styles.acValueCell}>{opt.aircraft_specs?.pax ? `${opt.aircraft_specs.pax}` : ''}</Text>
              </View>
              <View style={styles.acRow}>
                <Text style={styles.acLabelCell}>Luggage Capacity</Text>
                <Text style={styles.acValueCell}>{opt.baggage_capacity || ''}</Text>
              </View>
              <View style={[styles.acRow, { backgroundColor: COLORS.rowShade }]}>
                <Text style={styles.acPriceLabel}>Price</Text>
                <Text style={styles.acPriceValue}>{fmt(displayTotal, optCurrency)}</Text>
              </View>
            </View>

            {photos.length === 0 ? (
              <Text style={styles.acPicsLabel}>*PICS</Text>
            ) : (
              <View style={styles.acGallery}>
                {photos.map((img, i) => (
                  <Image
                    key={i}
                    src={img.src}
                    style={[styles.acImg, { objectFit: img.plan ? 'contain' : 'cover' }]}
                  />
                ))}
              </View>
            )}

            <Footer />
          </Page>
        );
      })}

      {/* ============ FINAL PAGE — TERMS & ACCEPTANCE ============ */}
      <Page size="A4" style={styles.page}>
        <Letterhead />

        <Text style={styles.sectionHeading}>Terms &amp; Conditions</Text>
        <View>
          {terms.map((tx, i) => (
            <Text key={i} style={styles.termRow}>{i + 1}. {tx}</Text>
          ))}
        </View>
        <View style={styles.termRule} />

        <Text style={styles.sectionHeading}>Offer Acceptance</Text>
        <Text style={styles.acceptanceNote}>
          * By writing the offer number above and signing this quotation we will check if the aircraft is available and send
          you the flight booking form to be signed.
        </Text>

        <View style={styles.fieldsRow}>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Offer number</Text>
            <Text style={styles.fieldLine}>——————</Text>
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Name</Text>
            <Text style={styles.fieldLine}>——————————————</Text>
          </View>
          <View style={styles.fieldCol}>
            <Text style={styles.fieldLabel}>Signature</Text>
            <Text style={styles.fieldLine}>————————</Text>
          </View>
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Decode any image (incl. webp) and re-encode as JPEG so @react-pdf/renderer accepts it.
async function rasterizeToJpeg(srcDataUrl: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas ctx'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = srcDataUrl;
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await blobToDataUrl(blob);
    // react-pdf only supports jpg/png — re-encode anything else (webp, avif, etc.)
    const isJpgOrPng = /^data:image\/(jpeg|jpg|png);/i.test(dataUrl);
    if (isJpgOrPng) return dataUrl;
    try {
      return await rasterizeToJpeg(dataUrl);
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

async function resolveOptionImages(data: QuotationData): Promise<QuotationData> {
  const resolveList = async (list?: string[] | null) => {
    if (!list?.length) return list ?? [];
    const resolved = await Promise.all(list.map((u) => urlToDataUrl(u)));
    return resolved.filter((u): u is string => !!u);
  };
  const options = await Promise.all(
    data.options.map(async (opt: any) => ({
      ...opt,
      aircraft_images: await resolveList(opt.aircraft_images),
      interior_images: await resolveList(opt.interior_images),
      layout_image: opt.layout_image ? (await urlToDataUrl(opt.layout_image)) : null,
    }))
  );
  return { ...data, options: options as any };
}

export async function generateQuotationPdf(data: QuotationData): Promise<Blob> {
  const resolved = await resolveOptionImages(data);
  const blob = await pdf(<QuotationDocument data={resolved} />).toBlob();
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { Document, Page, Text, View, Image, Svg, Path, Rect, Line, Circle, StyleSheet, pdf } from '@react-pdf/renderer';
import type { FlightOption } from '@/hooks/useFlightOptions';
import type { PricingBreakdown } from '@/components/flights/PricingBuilder';
import logoWhite from '@/assets/pf-logo-white.png';
import logoDark from '@/assets/pf-logo.png';

// Brand-aligned palette — Dark Navy + Bright Blue (matches index.css)
const COLORS = {
  navy: '#0A1A3B',        // --primary
  navyDeep: '#06112A',
  navySoft: '#122754',
  navyMist: '#1B3370',
  blue: '#2563EB',        // --accent
  blueLight: '#5B8DEF',
  blueGlow: '#93B4F5',
  ice: '#EAF1FF',
  paper: '#F6F8FC',
  border: '#B8CCEF',
  text: '#0B1530',
  muted: '#5A6885',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 70, paddingHorizontal: 0, fontFamily: 'Helvetica', fontSize: 10, color: COLORS.text, backgroundColor: COLORS.white },

  // ===== Decorative absolute layers =====
  cornerSvg: { position: 'absolute', top: 0, right: 0, width: 220, height: 220 },
  bottomGlow: { position: 'absolute', bottom: 60, left: 0, right: 0, height: 6 },
  watermark: { position: 'absolute', top: 320, left: 140, width: 320, height: 320, opacity: 0.035 },

  // ===== Header =====
  header: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerAccentBar: { height: 3, backgroundColor: COLORS.blue },
  headerThinBar: { height: 1, backgroundColor: COLORS.blueGlow, opacity: 0.4 },

  brandWrap: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 108, height: 44, objectFit: 'contain' },
  brandDivider: { width: 1, height: 38, backgroundColor: COLORS.blue, marginHorizontal: 14, opacity: 0.6 },
  brand: { color: COLORS.white, fontSize: 13, fontFamily: 'Helvetica-Bold', letterSpacing: 3 },
  brandSub: { color: COLORS.blueGlow, fontSize: 7.5, marginTop: 4, letterSpacing: 2 },

  quoteMeta: { alignItems: 'flex-end' },
  quoteLabel: { color: COLORS.blueGlow, fontSize: 7, letterSpacing: 2.5, marginBottom: 3 },
  quoteMetaBig: { color: COLORS.white, fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },
  quoteMetaSmall: { color: COLORS.blueGlow, fontSize: 8, marginTop: 4 },

  // ===== Hero =====
  hero: {
    paddingHorizontal: 32,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: COLORS.paper,
    borderBottom: `1 solid ${COLORS.border}`,
    position: 'relative',
  },
  heroEyebrow: { fontSize: 8, color: COLORS.blue, letterSpacing: 3, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  heroTitle: { color: COLORS.blue, fontSize: 22, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  heroSub: { color: COLORS.navy, fontSize: 10, marginTop: 6, lineHeight: 1.4 },

  // KPI ribbon under hero
  kpiRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  kpi: {
    flex: 1,
    backgroundColor: COLORS.white,
    border: `1 solid ${COLORS.blueLight}`,
    borderLeft: `3 solid ${COLORS.blue}`,
    padding: 10,
  },
  kpiLabel: { fontSize: 7, color: COLORS.blue, letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  kpiValue: { fontSize: 12, color: COLORS.navy, fontFamily: 'Helvetica-Bold', marginTop: 4 },

  // ===== Body =====
  body: { paddingHorizontal: 32, paddingTop: 18, paddingBottom: 80 },

  // ===== Section title =====
  sectionWrap: { marginBottom: 16 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionIndex: {
    color: COLORS.blue, fontSize: 9, fontFamily: 'Helvetica-Bold', letterSpacing: 1, marginRight: 8,
  },
  sectionBar: { width: 22, height: 2, backgroundColor: COLORS.blue, marginRight: 10 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.blue, letterSpacing: 2 },
  sectionRule: { flex: 1, height: 1, backgroundColor: COLORS.blueLight, marginLeft: 10 },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, gap: 12 },
  col: { flex: 1 },

  // ===== Cards =====
  card: {
    backgroundColor: COLORS.white,
    padding: 14,
    border: `1 solid ${COLORS.blueLight}`,
    borderTop: `3 solid ${COLORS.blue}`,
  },
  cardSoft: { backgroundColor: COLORS.ice, padding: 12, borderLeft: `3 solid ${COLORS.blue}` },

  label: { fontSize: 7, color: COLORS.blue, textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'Helvetica-Bold' },
  value: { fontSize: 10, color: COLORS.navy, marginTop: 3, fontFamily: 'Helvetica-Bold' },

  // ===== Legs (timeline) =====
  legCard: {
    backgroundColor: COLORS.white,
    border: `1 solid ${COLORS.blueLight}`,
    borderLeft: `3 solid ${COLORS.blue}`,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  legHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  legBadge: {
    backgroundColor: COLORS.blue,
    color: COLORS.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 4,
    letterSpacing: 1.5,
    marginRight: 10,
  },
  routeWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  airportCode: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.blue, letterSpacing: 1 },
  routeArrow: { marginHorizontal: 10 },

  // ===== Aircraft =====
  aircraftCard: { border: `1 solid ${COLORS.blueLight}`, marginBottom: 14, backgroundColor: COLORS.white },
  aircraftHeader: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  aircraftHeaderAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: COLORS.navy },
  aircraftBadge: {
    color: COLORS.blue,
    backgroundColor: COLORS.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    paddingHorizontal: 9,
    paddingVertical: 4,
    letterSpacing: 1.5,
  },
  aircraftTitle: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 12 },
  aircraftPrice: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 15 },
  aircraftBody: { padding: 14 },
  selectedRibbon: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: COLORS.navy, color: COLORS.white,
    fontSize: 7, letterSpacing: 2, fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  selectedBorder: { border: `1.5 solid ${COLORS.blue}` },
  featurePill: {
    backgroundColor: COLORS.ice,
    color: COLORS.blue,
    fontSize: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 5,
    marginBottom: 5,
    border: `0.5 solid ${COLORS.blue}`,
    fontFamily: 'Helvetica-Bold',
  },
  inclusionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  inclusionDot: { color: COLORS.blue, fontSize: 10, fontFamily: 'Helvetica-Bold', marginRight: 6, lineHeight: 1.4 },
  inclusionText: { fontSize: 8.5, color: COLORS.navy, flex: 1, lineHeight: 1.45 },
  inclusionsTitle: { fontSize: 8, color: COLORS.blue, fontFamily: 'Helvetica-Bold', letterSpacing: 1.4, marginBottom: 6, marginTop: 12 },
  optionTotalBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.ice, padding: 10, marginTop: 12,
    borderLeft: `3 solid ${COLORS.blue}`,
  },
  optionTotalLabel: { fontSize: 8, color: COLORS.blue, letterSpacing: 1.6, fontFamily: 'Helvetica-Bold' },
  optionTotalValue: { fontSize: 15, color: COLORS.navy, fontFamily: 'Helvetica-Bold' },
  optionSubMeta: { fontSize: 7.5, color: COLORS.muted, marginTop: 2 },

  // ===== Pricing =====
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottom: `0.5 solid ${COLORS.blueLight}` },
  priceLabel: { fontSize: 10, color: COLORS.navy },
  priceValue: { fontSize: 10, color: COLORS.blue, fontFamily: 'Helvetica-Bold' },
  priceFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.navy,
    padding: 16,
    marginTop: 10,
    alignItems: 'center',
    position: 'relative',
  },
  priceFinalAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: COLORS.blue },
  priceFinalLabel: { color: COLORS.blueGlow, fontFamily: 'Helvetica-Bold', fontSize: 11, letterSpacing: 2.5, marginLeft: 8 },
  priceFinalValue: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 20, letterSpacing: 0.5 },

  // ===== Terms (premium tiles) =====
  termsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  termTile: {
    width: '48.5%',
    backgroundColor: COLORS.white,
    border: `1 solid ${COLORS.blueLight}`,
    borderLeft: `3 solid ${COLORS.blue}`,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
  },
  termNumCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    fontSize: 9, fontFamily: 'Helvetica-Bold',
    textAlign: 'center', paddingTop: 5,
    letterSpacing: 0.5,
  },
  termTileText: { flex: 1, fontSize: 8.5, color: COLORS.navy, lineHeight: 1.5 },

  // ===== Acceptance / closing =====
  acceptHero: {
    backgroundColor: COLORS.navy,
    padding: 20,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  acceptHeroAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: COLORS.blue },
  acceptEyebrow: { color: COLORS.blueGlow, fontSize: 8, letterSpacing: 3, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  acceptTitle: { color: COLORS.white, fontSize: 18, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  acceptSub: { color: COLORS.blueGlow, fontSize: 9.5, marginTop: 6, lineHeight: 1.55, maxWidth: 420 },

  offerSelectRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  offerChip: {
    backgroundColor: COLORS.white,
    color: COLORS.navy,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 12, paddingVertical: 6,
    letterSpacing: 1.5,
    border: `1 solid ${COLORS.blue}`,
  },

  signatureGrid: { flexDirection: 'row', gap: 14, marginTop: 4 },
  sigCol: { flex: 1, backgroundColor: COLORS.white, border: `1 solid ${COLORS.blueLight}`, borderTop: `3 solid ${COLORS.blue}`, padding: 14 },
  sigPartyLabel: { fontSize: 7.5, color: COLORS.blue, letterSpacing: 1.8, fontFamily: 'Helvetica-Bold' },
  sigParty: { fontSize: 11, color: COLORS.navy, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  sigLine: { borderBottom: `1 solid ${COLORS.navy}`, marginTop: 36, marginBottom: 6, opacity: 0.4 },
  sigMeta: { fontSize: 7.5, color: COLORS.muted, letterSpacing: 1, fontFamily: 'Helvetica-Bold' },

  thankYou: {
    marginTop: 16,
    backgroundColor: COLORS.ice,
    borderLeft: `3 solid ${COLORS.blue}`,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  thankYouMark: { color: COLORS.blue, fontSize: 30, fontFamily: 'Helvetica-Bold' },
  thankYouTitle: { fontSize: 13, color: COLORS.navy, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  thankYouText: { fontSize: 9, color: COLORS.muted, marginTop: 3, lineHeight: 1.5 },

  // ===== Footer =====
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.navyDeep,
    paddingHorizontal: 32, paddingVertical: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footerAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: COLORS.blue },
  footerText: { color: COLORS.blueGlow, fontSize: 7.5, opacity: 0.9, lineHeight: 1.5 },
  footerBrand: { color: COLORS.white, fontSize: 8.5, fontFamily: 'Helvetica-Bold', letterSpacing: 2 },
  pageNum: { color: COLORS.blueGlow, fontSize: 8 },
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

const DEFAULT_INCLUSIONS = [
  'Private aircraft charter & qualified flight crew',
  'Fuel, oil & all standard handling fees',
  'Landing, parking & navigation charges',
  'Standard in-flight catering & refreshments',
  'VIP ground handling & lounge access (where available)',
  'Crew duty allowances & accommodation (if required)',
  'Aircraft insurance & regulatory compliance',
];

const DEFAULT_EXCLUSIONS = [
  'Overflight & landing permits in restricted territories (charged at cost)',
  'De-icing services (charged at cost when required)',
  'Premium / bespoke catering on request',
  'Ground transportation outside the airport',
  'Any taxes or duties imposed after quotation date',
];

const DEFAULT_TERMS = [
  'All offers are subject to aircraft and crew serviceability and availability.',
  'All quoted prices are including taxes and 15% VAT if applicable.',
  'Any changes in routes or any additional needs may change the quoted prices.',
];

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

// --- Decorative SVG corner ornament ---
const CornerOrnament = () => (
  <Svg style={styles.cornerSvg} viewBox="0 0 220 220">
    <Path d="M220,0 L220,160 Q220,220 160,220 L220,220 Z" fill={COLORS.blue} opacity={0.08} />
    <Path d="M220,0 L220,110 Q220,180 150,180 L220,180 Z" fill={COLORS.blue} opacity={0.10} />
    <Circle cx="200" cy="20" r="3" fill={COLORS.blue} opacity={0.6} />
    <Circle cx="190" cy="35" r="1.5" fill={COLORS.blue} opacity={0.5} />
    <Line x1="170" y1="10" x2="215" y2="10" stroke={COLORS.blue} strokeWidth="0.5" opacity={0.4} />
  </Svg>
);

// --- Section title ---
const SectionTitle = ({ index, children }: { index: string; children: React.ReactNode }) => (
  <View style={styles.sectionTitleRow}>
    <Text style={styles.sectionIndex}>{index}</Text>
    <View style={styles.sectionBar} />
    <Text style={styles.sectionTitle}>{children}</Text>
    <View style={styles.sectionRule} />
  </View>
);

// --- Route arrow with dotted line ---
const RouteArrow = () => (
  <Svg width="80" height="14" viewBox="0 0 80 14" style={styles.routeArrow}>
    <Circle cx="3" cy="7" r="3" fill={COLORS.blue} />
    <Line x1="8" y1="7" x2="68" y2="7" stroke={COLORS.blue} strokeWidth="1" strokeDasharray="2,2" />
    <Path d="M68,3 L76,7 L68,11 Z" fill={COLORS.blue} />
  </Svg>
);

// ===== Additional template-aligned styles =====
const t = StyleSheet.create({
  // Cover page
  coverTopBar: { height: 6, backgroundColor: COLORS.blue },
  coverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  contactCol: { flexDirection: 'column', maxWidth: 230 },
  contactBrand: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: COLORS.navy, letterSpacing: 1.5, marginBottom: 4 },
  contactLine: { fontSize: 8.5, color: COLORS.muted, lineHeight: 1.55 },
  coverLogo: { width: 130, height: 56, objectFit: 'contain' },
  brandStack: { alignItems: 'center', marginTop: 4 },
  brandWord: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: COLORS.navy, letterSpacing: 4 },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  brandRuleLine: { width: 18, height: 1, backgroundColor: COLORS.blue },
  brandRuleWord: { fontSize: 7, color: COLORS.blue, letterSpacing: 3, marginHorizontal: 6 },

  quoteHero: {
    marginTop: 38,
    paddingHorizontal: 40,
  },
  quoteEyebrow: { fontSize: 8, color: COLORS.blue, letterSpacing: 4, fontFamily: 'Helvetica-Bold' },
  quoteTitle: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.navy,
    letterSpacing: 2,
    marginTop: 10,
  },
  quoteTitleAccent: { color: COLORS.blue },
  quoteUnderline: { width: 80, height: 3, backgroundColor: COLORS.blue, marginTop: 12 },
  quoteDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
  },
  quoteDatePill: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.white,
    backgroundColor: COLORS.blue,
    paddingHorizontal: 10,
    paddingVertical: 5,
    letterSpacing: 2,
  },
  quoteDateText: { fontSize: 11, color: COLORS.navy, fontFamily: 'Helvetica-Bold' },

  letterBlock: { marginTop: 26, paddingHorizontal: 40 },
  letterGreeting: { fontSize: 11, color: COLORS.navy, fontFamily: 'Helvetica-Bold' },
  letterBody: { fontSize: 10.5, color: COLORS.text, marginTop: 8, lineHeight: 1.65 },

  // Route table (template style — but brand-colored)
  routeTableWrap: { marginTop: 22, paddingHorizontal: 40 },
  routeTable: { border: `1 solid ${COLORS.blueLight}` },
  routeHeadRow: { flexDirection: 'row', backgroundColor: COLORS.navy },
  routeHeadCell: {
    color: COLORS.white,
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    paddingVertical: 9,
    paddingHorizontal: 8,
    textAlign: 'center',
    borderRight: `1 solid ${COLORS.navySoft}`,
  },
  routeBodyRow: { flexDirection: 'row', backgroundColor: COLORS.white },
  routeBodyRowAlt: { flexDirection: 'row', backgroundColor: COLORS.ice },
  routeBodyCell: {
    fontSize: 9.5,
    color: COLORS.navy,
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
    borderRight: `0.5 solid ${COLORS.blueLight}`,
    borderTop: `0.5 solid ${COLORS.blueLight}`,
  },

  bullets: { marginTop: 22, paddingHorizontal: 40 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletStar: { color: COLORS.blue, fontSize: 11, marginRight: 8, fontFamily: 'Helvetica-Bold' },
  bulletText: { fontSize: 9.5, color: COLORS.navy, flex: 1, lineHeight: 1.5 },

  // Aircraft offer page
  acHeaderBand: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 40,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acHeaderBandAccent: { height: 4, backgroundColor: COLORS.blue },
  acBadge: {
    color: COLORS.navy,
    backgroundColor: COLORS.white,
    fontFamily: 'Helvetica-Bold',
    fontSize: 22,
    paddingHorizontal: 16,
    paddingVertical: 8,
    letterSpacing: 2,
  },
  acHeaderTitle: { color: COLORS.white, fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 1 },
  acHeaderSub: { color: COLORS.blueGlow, fontSize: 8, letterSpacing: 2, marginTop: 3 },

  acTableWrap: { paddingHorizontal: 40, marginTop: 22 },
  acTable: { border: `1 solid ${COLORS.blueLight}` },
  acRow: { flexDirection: 'row', borderTop: `0.5 solid ${COLORS.blueLight}` },
  acRowFirst: { flexDirection: 'row' },
  acLabelCell: {
    width: '42%',
    backgroundColor: COLORS.ice,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.navy,
    letterSpacing: 0.5,
    borderRight: `0.5 solid ${COLORS.blueLight}`,
  },
  acValueCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 9.5,
    color: COLORS.navy,
  },
  acPriceLabel: {
    width: '42%',
    backgroundColor: COLORS.blue,
    color: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  acPriceValue: {
    flex: 1,
    backgroundColor: COLORS.navy,
    color: COLORS.white,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
  },

  acGallery: { paddingHorizontal: 40, marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  acImgFull: { width: '100%', height: 240, objectFit: 'cover', border: `1 solid ${COLORS.blueLight}` },
  acImgHalf: { width: '48.8%', height: 180, objectFit: 'cover', border: `1 solid ${COLORS.blueLight}` },
  acImgPlaceholder: {
    width: '100%', height: 200,
    backgroundColor: COLORS.ice,
    border: `1 dashed ${COLORS.blueLight}`,
    alignItems: 'center', justifyContent: 'center',
  },
  acImgPlaceholderText: { color: COLORS.blue, fontSize: 9, letterSpacing: 2, fontFamily: 'Helvetica-Bold' },

  acInclusions: { paddingHorizontal: 40, marginTop: 22 },
  acInclTitle: { fontSize: 9, color: COLORS.blue, fontFamily: 'Helvetica-Bold', letterSpacing: 2, marginBottom: 10 },
  acInclGrid: { flexDirection: 'row', gap: 16 },

  // Closing / signature page
  closeHeader: {
    paddingHorizontal: 40, paddingTop: 36, paddingBottom: 14,
    borderBottom: `2 solid ${COLORS.blue}`,
  },
  closeTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: COLORS.navy, letterSpacing: 1.5 },
  closeEyebrow: { fontSize: 8, color: COLORS.blue, letterSpacing: 4, fontFamily: 'Helvetica-Bold', marginBottom: 8 },

  termsList: { paddingHorizontal: 40, marginTop: 22 },
  termLineRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  termLineNum: {
    width: 26, height: 26,
    backgroundColor: COLORS.navy, color: COLORS.white,
    fontSize: 10, fontFamily: 'Helvetica-Bold',
    textAlign: 'center', paddingTop: 6,
    marginRight: 12,
    letterSpacing: 0.5,
  },
  termLineText: { flex: 1, fontSize: 10, color: COLORS.navy, lineHeight: 1.55, paddingTop: 4 },

  // Acceptance table
  acceptWrap: { paddingHorizontal: 40, marginTop: 30 },
  acceptHeading: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.navy, letterSpacing: 1.5, marginBottom: 4 },
  acceptHeadingAccent: { width: 50, height: 2, backgroundColor: COLORS.blue, marginBottom: 18 },

  signTable: { border: `1 solid ${COLORS.blueLight}` },
  signHeadRow: { flexDirection: 'row', backgroundColor: COLORS.navy },
  signHeadCell: {
    flex: 1,
    color: COLORS.white, fontSize: 9.5, fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5, paddingVertical: 10, textAlign: 'center',
    borderRight: `1 solid ${COLORS.navySoft}`,
  },
  signBodyRow: { flexDirection: 'row', minHeight: 70 },
  signBodyCell: {
    flex: 1,
    paddingVertical: 28, paddingHorizontal: 14,
    borderRight: `0.5 solid ${COLORS.blueLight}`,
    alignItems: 'center', justifyContent: 'flex-end',
  },
  signBodyLine: { width: '85%', borderBottom: `1 solid ${COLORS.navy}`, opacity: 0.5 },
  signBodyCaption: { fontSize: 7.5, color: COLORS.muted, letterSpacing: 1.2, marginTop: 6, fontFamily: 'Helvetica-Bold' },

  acceptNote: {
    marginTop: 22,
    backgroundColor: COLORS.ice,
    borderLeft: `3 solid ${COLORS.blue}`,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  acceptNoteStar: { color: COLORS.blue, fontFamily: 'Helvetica-Bold', fontSize: 12, marginRight: 4 },
  acceptNoteText: { fontSize: 9.5, color: COLORS.navy, flex: 1, lineHeight: 1.6 },

  // Letter footer (matches template — no fixed dark bar so it feels like a letter)
  letterFooterAccent: {
    position: 'absolute', bottom: 22, left: 0, right: 0, height: 3, backgroundColor: COLORS.blue,
  },
  letterFooter: {
    position: 'absolute', bottom: 28, left: 0, right: 0,
    paddingHorizontal: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  letterFooterCol: { flexDirection: 'column' },
  letterFooterText: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.5 },
  letterPageNum: { fontSize: 8, color: COLORS.navy, fontFamily: 'Helvetica-Bold' },
});

// Letter-style footer (used on every page — mirrors template)
const LetterFooter = () => (
  <>
    <View style={t.letterFooterAccent} fixed />
    <View style={t.letterFooter} fixed>
      <View style={t.letterFooterCol}>
        <Text style={t.letterFooterText}>KSA, Jeddah, Al Morjan Dist. AlMalik St.</Text>
        <Text style={t.letterFooterText}>info@privatefleetservices.com  /  www.privatefleetservices.com</Text>
      </View>
      <Text
        style={t.letterPageNum}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  </>
);



export function QuotationDocument({ data }: { data: QuotationData }) {
  const terms = data.terms?.length ? data.terms : DEFAULT_TERMS;
  const inclusions = data.inclusions?.length ? data.inclusions : DEFAULT_INCLUSIONS;

  return (
    <Document>
      {/* ============ PAGE 1 — COVER LETTER ============ */}
      <Page size="A4" style={styles.page}>
        <View style={t.coverTopBar} fixed />

        <View style={t.coverHeader}>
          <View style={t.contactCol}>
            <Text style={t.contactBrand}>PRIVATE FLEET SERVICES</Text>
            <Text style={t.contactLine}>KSA, Jeddah Al Morjan District</Text>
            <Text style={t.contactLine}>AlMalik ST.</Text>
            <Text style={t.contactLine}>M: +966 920 003 455</Text>
            <Text style={t.contactLine}>E: info@privatefleetservices.com</Text>
            <Text style={t.contactLine}>www.privatefleetservices.com</Text>
          </View>

          <View style={t.brandStack}>
            <Image src={logoDark} style={t.coverLogo} />
            <Text style={t.brandWord}>PRIVATE FLEET</Text>
            <View style={t.brandRule}>
              <View style={t.brandRuleLine} />
              <Text style={t.brandRuleWord}>SERVICES</Text>
              <View style={t.brandRuleLine} />
            </View>
          </View>

          {/* Spacer to balance the flex row */}
          <View style={{ width: 230 }} />
        </View>

        <View style={t.quoteHero}>
          <Text style={t.quoteEyebrow}>EXECUTIVE CHARTER PROPOSAL</Text>
          <Text style={t.quoteTitle}>
            QUOTATION  <Text style={t.quoteTitleAccent}>{data.quoteNumber}</Text>
          </Text>
          <View style={t.quoteUnderline} />

          <View style={t.quoteDateRow}>
            <Text style={t.quoteDatePill}>DATE</Text>
            <Text style={t.quoteDateText}>{data.quoteDate}</Text>
          </View>
        </View>

        <View style={t.letterBlock}>
          <Text style={t.letterGreeting}>
            Dear {data.client.name || 'Sir'},
          </Text>
          <Text style={t.letterBody}>
            Thank you for your enquiry, we are pleased to give you offers for the following route:
          </Text>
        </View>

        <View style={t.routeTableWrap}>
          <View style={t.routeTable}>
            <View style={t.routeHeadRow}>
              <Text style={[t.routeHeadCell, { width: '16%' }]}>Leg Date</Text>
              <Text style={[t.routeHeadCell, { width: '32%' }]}>Route</Text>
              <Text style={[t.routeHeadCell, { width: '13%' }]}>Dep. Time</Text>
              <Text style={[t.routeHeadCell, { width: '13%' }]}>Arr. Time</Text>
              <Text style={[t.routeHeadCell, { width: '14%' }]}>Flt. Time</Text>
              <Text style={[t.routeHeadCell, { width: '12%', borderRight: 'none' }]}>Pax</Text>
            </View>
            {data.flight.legs.map((leg, i) => (
              <View key={i} style={i % 2 === 0 ? t.routeBodyRow : t.routeBodyRowAlt}>
                <Text style={[t.routeBodyCell, { width: '16%' }]}>{leg.date}</Text>
                <Text style={[t.routeBodyCell, { width: '32%' }]}>{leg.from} – {leg.to}</Text>
                <Text style={[t.routeBodyCell, { width: '13%' }]}>{leg.departureTime}</Text>
                <Text style={[t.routeBodyCell, { width: '13%' }]}>{leg.arrivalTime || '—'}</Text>
                <Text style={[t.routeBodyCell, { width: '14%' }]}>{leg.duration || '—'}</Text>
                <Text style={[t.routeBodyCell, { width: '12%', borderRight: 'none' }]}>{leg.passengers}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={t.bullets}>
          <View style={t.bulletRow}>
            <Text style={t.bulletStar}>✦</Text>
            <Text style={t.bulletText}>Kindly find the Aircraft offer in the next pages with pictures.</Text>
          </View>
          <View style={t.bulletRow}>
            <Text style={t.bulletStar}>✦</Text>
            <Text style={t.bulletText}>Kindly find this Quotation Terms &amp; Conditions in the last page.</Text>
          </View>
        </View>

        <LetterFooter />
      </Page>

      {/* ============ AIRCRAFT PAGES — ONE PER OPTION ============ */}
      {data.options.map((opt, idx) => {
        const totals = data.optionTotals?.[opt.id];
        const optCurrency = totals?.currency || opt.currency || data.pricing.currency;
        const displayTotal = totals?.total ?? opt.base_price;
        const images = [
          ...((opt as any).aircraft_images || []),
          ...((opt as any).interior_images || []),
        ].filter(Boolean).slice(0, 3);

        return (
          <Page key={opt.id} size="A4" style={styles.page}>
            <View style={t.coverTopBar} fixed />

            <View style={t.acHeaderBand}>
              <View>
                <Text style={t.acHeaderTitle}>{opt.aircraft_type || 'Aircraft Option'}</Text>
                <Text style={t.acHeaderSub}>
                  OPTION  ·  A{idx + 1}
                  {opt.aircraft_registration ? `  ·  REG ${opt.aircraft_registration}` : ''}
                </Text>
              </View>
              <Text style={t.acBadge}>A{idx + 1}</Text>
            </View>
            <View style={t.acHeaderBandAccent} />

            <View style={t.acTableWrap}>
              <View style={t.acTable}>
                <View style={t.acRowFirst}>
                  <Text style={t.acLabelCell}>Aircraft type:</Text>
                  <Text style={t.acValueCell}>{opt.aircraft_type || '—'}</Text>
                </View>
                <View style={t.acRow}>
                  <Text style={t.acLabelCell}>Passengers' capacity:</Text>
                  <Text style={t.acValueCell}>
                    {opt.aircraft_specs?.pax ? `${opt.aircraft_specs.pax} seats` : '—'}
                  </Text>
                </View>
                <View style={t.acRow}>
                  <Text style={t.acLabelCell}>Baggage Capacity:</Text>
                  <Text style={t.acValueCell}>{opt.baggage_capacity || '—'}</Text>
                </View>
                {!!opt.aircraft_specs?.range && (
                  <View style={t.acRow}>
                    <Text style={t.acLabelCell}>Range:</Text>
                    <Text style={t.acValueCell}>{opt.aircraft_specs.range}</Text>
                  </View>
                )}
                {!!opt.estimated_duration && (
                  <View style={t.acRow}>
                    <Text style={t.acLabelCell}>Estimated Duration:</Text>
                    <Text style={t.acValueCell}>{opt.estimated_duration}</Text>
                  </View>
                )}
                <View style={t.acRow}>
                  <Text style={t.acPriceLabel}>Price (All-inclusive):</Text>
                  <Text style={t.acPriceValue}>{fmt(displayTotal, optCurrency)}</Text>
                </View>
                {!!opt.aircraft_notes && (
                  <View style={t.acRow}>
                    <Text style={t.acLabelCell}>Note:</Text>
                    <Text style={[t.acValueCell, { fontFamily: 'Helvetica-Bold', color: COLORS.blue }]}>
                      {opt.aircraft_notes}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Gallery */}
            <View style={t.acGallery}>
              {images.length === 0 ? (
                <View style={t.acImgPlaceholder}>
                  <Text style={t.acImgPlaceholderText}>AIRCRAFT  ·  INTERIOR  PHOTOGRAPHY</Text>
                </View>
              ) : images.length === 1 ? (
                <Image src={images[0]} style={t.acImgFull} />
              ) : (
                images.slice(0, 2).map((src: string, i: number) => (
                  <Image key={i} src={src} style={t.acImgHalf} />
                ))
              )}
            </View>

            {/* Features / inclusions teaser */}
            {(opt.aircraft_features?.length || inclusions.length > 0) && (
              <View style={t.acInclusions} wrap={false}>
                <Text style={t.acInclTitle}>WHAT'S INCLUDED IN THIS OFFER</Text>
                <View style={t.acInclGrid}>
                  <View style={{ flex: 1 }}>
                    {inclusions.slice(0, Math.ceil(inclusions.length / 2)).map((inc, i) => (
                      <View key={i} style={styles.inclusionRow}>
                        <Text style={styles.inclusionDot}>✓</Text>
                        <Text style={styles.inclusionText}>{inc}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    {inclusions.slice(Math.ceil(inclusions.length / 2)).map((inc, i) => (
                      <View key={i} style={styles.inclusionRow}>
                        <Text style={styles.inclusionDot}>✓</Text>
                        <Text style={styles.inclusionText}>{inc}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            <LetterFooter />
          </Page>
        );
      })}

      {/* ============ FINAL PAGE — TERMS & ACCEPTANCE ============ */}
      <Page size="A4" style={styles.page}>
        <View style={t.coverTopBar} fixed />

        <View style={t.closeHeader}>
          <Text style={t.closeEyebrow}>SECTION 01</Text>
          <Text style={t.closeTitle}>Terms &amp; Conditions</Text>
        </View>

        <View style={t.termsList}>
          {terms.map((tx, i) => (
            <View key={i} style={t.termLineRow} wrap={false}>
              <Text style={t.termLineNum}>{i + 1}</Text>
              <Text style={t.termLineText}>{tx}</Text>
            </View>
          ))}
        </View>

        <View style={t.acceptWrap}>
          <Text style={t.closeEyebrow}>SECTION 02</Text>
          <Text style={t.acceptHeading}>Offer Acceptance</Text>
          <View style={t.acceptHeadingAccent} />

          <View style={t.signTable}>
            <View style={t.signHeadRow}>
              <Text style={t.signHeadCell}>OFFER NUMBER</Text>
              <Text style={t.signHeadCell}>NAME</Text>
              <Text style={[t.signHeadCell, { borderRight: 'none' }]}>SIGNATURE</Text>
            </View>
            <View style={t.signBodyRow}>
              <View style={t.signBodyCell}>
                <View style={t.signBodyLine} />
                <Text style={t.signBodyCaption}>A1 / A2 / A3</Text>
              </View>
              <View style={t.signBodyCell}>
                <View style={t.signBodyLine} />
                <Text style={t.signBodyCaption}>FULL NAME</Text>
              </View>
              <View style={[t.signBodyCell, { borderRight: 'none' }]}>
                <View style={t.signBodyLine} />
                <Text style={t.signBodyCaption}>DATE  ·  SIGNATURE</Text>
              </View>
            </View>
          </View>

          <View style={t.acceptNote}>
            <Text style={t.acceptNoteStar}>✦</Text>
            <Text style={t.acceptNoteText}>
              By writing the offer number above and signing this quotation, we will check if the aircraft is
              available and send you the flight booking form to be signed.
            </Text>
          </View>
        </View>

        <LetterFooter />
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

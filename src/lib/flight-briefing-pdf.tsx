import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import logoDark from '@/assets/pf-logo.png';

const COLORS = {
  text: '#1A1A1A',
  muted: '#4A4A4A',
  border: '#333333',
  borderLight: '#999999',
  rowShade: '#EEEEEE',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 50, paddingHorizontal: 40, fontFamily: 'Helvetica', fontSize: 10, color: COLORS.text, backgroundColor: COLORS.white },

  contactBrand: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: COLORS.text, marginBottom: 3 },
  contactLine: { fontSize: 8.5, color: COLORS.text, lineHeight: 1.5 },

  logoWrap: { alignItems: 'center', marginTop: 16, marginBottom: 20 },
  logoImg: { width: 60, height: 60, objectFit: 'contain' },
  brandWord: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: 1, marginTop: 4 },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  brandRuleLine: { width: 14, height: 1, backgroundColor: COLORS.borderLight },
  brandRuleWord: { fontSize: 7, color: COLORS.muted, letterSpacing: 2, marginHorizontal: 5 },

  docTitle: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 22 },
  metaRow: { fontSize: 10.5, marginBottom: 3 },
  divider: { borderTop: `1 solid ${COLORS.text}`, marginTop: 10, marginBottom: 16 },
  introText: { fontSize: 10, lineHeight: 1.6, marginBottom: 20 },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 20, marginBottom: 8 },

  table: { border: `1 solid ${COLORS.border}` },
  headRow: { flexDirection: 'row', borderBottom: `0.5 solid ${COLORS.border}` },
  headGroupRow: { flexDirection: 'row' },
  headCell: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', paddingVertical: 6, paddingHorizontal: 5, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  bodyRow: { flexDirection: 'row', borderTop: `0.5 solid ${COLORS.border}`, minHeight: 26 },
  bodyCell: { fontSize: 9, paddingVertical: 7, paddingHorizontal: 5, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  labelCell: { fontSize: 9, fontFamily: 'Helvetica-Bold', paddingVertical: 7, paddingHorizontal: 5, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },

  twoColTable: { border: `1 solid ${COLORS.border}`, flexDirection: 'row' },
  twoColHalf: { flex: 1 },
  twoColCell: { fontSize: 9, paddingVertical: 8, paddingHorizontal: 8, borderTop: `0.5 solid ${COLORS.border}` },
  twoColCellFirst: { fontSize: 9, paddingVertical: 8, paddingHorizontal: 8 },
  twoColDivider: { width: 0.5, backgroundColor: COLORS.border },

  passTable: { border: `1 solid ${COLORS.border}` },
  passHeadCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 8, paddingHorizontal: 5, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  passBodyCell: { fontSize: 8.5, paddingVertical: 8, paddingHorizontal: 5, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },

  footer: { position: 'absolute', bottom: 24, left: 40, right: 40 },
  footerRule: { borderTop: `0.5 solid ${COLORS.borderLight}`, marginBottom: 6 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  footerText: { fontSize: 7.5, color: COLORS.muted, lineHeight: 1.5 },
  footerPageNum: { fontSize: 8, color: COLORS.text, fontFamily: 'Helvetica-Bold' },
});

export interface BriefingLeg {
  date: string;
  from: string;
  to: string;
}

export interface BriefingPassenger {
  full_name: string;
  nationality: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  is_vip: boolean;
}

export interface FlightBriefingData {
  briefingNumber: string;
  date: string;
  aircraftType: string;
  aircraftRegistration: string;
  legs: BriefingLeg[];
  departureTime: string;
  arrivalTime: string;
  flightDuration: string;
  paxNumber: number;
  handlingAgents: string;
  terminalsDepAirport: string;
  terminalsDepLocation: string;
  terminalsArrAirport: string;
  terminalsArrLocation: string;
  slotsPermits: Array<{ label: string; status: string }>;
  passengers: BriefingPassenger[];
}

const dash = (v?: string | null) => (v && v.trim() ? v : '—');

const Letterhead = () => (
  <View>
    <Text style={styles.contactBrand}>PRIVATE FLEET SERVICES</Text>
    <Text style={styles.contactLine}>KSA, Jeddah, King Abdulaziz Rd.</Text>
    <Text style={styles.contactLine}>M: +966559952727</Text>
    <Text style={styles.contactLine}>E: info@privatefleetservices.com</Text>
    <Text style={styles.contactLine}>www.privatefleetservices.com</Text>

    <View style={styles.logoWrap}>
      <Image src={logoDark} style={styles.logoImg} />
      <Text style={styles.brandWord}>PRIVATE FLEET</Text>
      <View style={styles.brandRule}>
        <View style={styles.brandRuleLine} />
        <Text style={styles.brandRuleWord}>SERVICES</Text>
        <View style={styles.brandRuleLine} />
      </View>
    </View>
  </View>
);

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

// Column widths shared between the header and body rows so they align.
// Departure/Arrival group widths equal their two sub-columns combined
// (12+18=30) so the two-row header lines up with the data row below it.
const W = { date: '12%', depTime: '12%', depAirport: '18%', arrTime: '12%', arrAirport: '18%', duration: '14%', pax: '14%' };
const GROUP = { departure: '30%', arrival: '30%' };

export function FlightBriefingDocument({ data }: { data: FlightBriefingData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Letterhead />

        <Text style={styles.docTitle}>Flight Briefing</Text>

        <Text style={styles.metaRow}>Date: {dash(data.date)}</Text>
        <Text style={styles.metaRow}>Flight Briefing No: {dash(data.briefingNumber)}</Text>
        <View style={styles.divider} />

        <Text style={styles.introText}>
          Kindly find the flight details for your booked trip on the aircraft {dash(data.aircraftType)} with registration
          number {dash(data.aircraftRegistration)}.
        </Text>

        <View style={styles.table}>
          <View style={styles.headGroupRow}>
            <Text style={[styles.headCell, { width: W.date }]}>Date</Text>
            <Text style={[styles.headCell, { width: GROUP.departure }]}>Departure</Text>
            <Text style={[styles.headCell, { width: GROUP.arrival }]}>Arrival</Text>
            <Text style={[styles.headCell, { width: W.duration }]}>Flight Duration</Text>
            <Text style={[styles.headCell, { width: W.pax, borderRight: 'none' }]}>Pax Number</Text>
          </View>
          <View style={styles.headRow}>
            <Text style={[styles.headCell, { width: W.date }]}></Text>
            <Text style={[styles.headCell, { width: W.depTime }]}>Time</Text>
            <Text style={[styles.headCell, { width: W.depAirport }]}>Airport</Text>
            <Text style={[styles.headCell, { width: W.arrTime }]}>Time</Text>
            <Text style={[styles.headCell, { width: W.arrAirport }]}>Airport</Text>
            <Text style={[styles.headCell, { width: W.duration }]}></Text>
            <Text style={[styles.headCell, { width: W.pax, borderRight: 'none' }]}></Text>
          </View>

          {(data.legs.length ? data.legs : [{ date: data.date, from: '', to: '' }]).map((leg, i) => (
            <View key={i} style={styles.bodyRow}>
              <Text style={[styles.bodyCell, { width: W.date }]}>{dash(leg.date)}</Text>
              <Text style={[styles.bodyCell, { width: W.depTime }]}>{dash(data.departureTime)}</Text>
              <Text style={[styles.bodyCell, { width: W.depAirport }]}>{dash(leg.from)}</Text>
              <Text style={[styles.bodyCell, { width: W.arrTime }]}>{dash(data.arrivalTime)}</Text>
              <Text style={[styles.bodyCell, { width: W.arrAirport }]}>{dash(leg.to)}</Text>
              <Text style={[styles.bodyCell, { width: W.duration }]}>{dash(data.flightDuration)}</Text>
              <Text style={[styles.bodyCell, { width: W.pax, borderRight: 'none' }]}>{data.paxNumber || ''}</Text>
            </View>
          ))}

          <View style={[styles.bodyRow, { backgroundColor: COLORS.rowShade }]}>
            <Text style={[styles.labelCell, { width: W.date }]}>Handling{'\n'}Agents</Text>
            <Text style={[styles.bodyCell, { width: '60%' }]}>{dash(data.handlingAgents)}</Text>
            <Text style={[styles.bodyCell, { width: W.duration }]}></Text>
            <Text style={[styles.bodyCell, { width: W.pax, borderRight: 'none' }]}></Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Terminals Location:</Text>
        <View style={styles.twoColTable}>
          <View style={styles.twoColHalf}>
            <Text style={styles.twoColCellFirst}>{data.terminalsDepAirport?.trim() ? data.terminalsDepAirport : '*Airport'}</Text>
            <Text style={[styles.twoColCell, { backgroundColor: COLORS.rowShade }]}>{data.terminalsDepLocation?.trim() ? data.terminalsDepLocation : '*Location'}</Text>
          </View>
          <View style={styles.twoColDivider} />
          <View style={styles.twoColHalf}>
            <Text style={styles.twoColCellFirst}>{data.terminalsArrAirport?.trim() ? data.terminalsArrAirport : '*Airport'}</Text>
            <Text style={[styles.twoColCell, { backgroundColor: COLORS.rowShade }]}>{data.terminalsArrLocation?.trim() ? data.terminalsArrLocation : '*Location'}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Slots &amp; Permits Status:</Text>
        <View style={styles.table}>
          <View style={styles.headRow}>
            <Text style={[styles.headCell, { width: '55%' }]}>County or Airport/ Type</Text>
            <Text style={[styles.headCell, { width: '45%', borderRight: 'none' }]}>Status</Text>
          </View>
          {(data.slotsPermits.length ? data.slotsPermits : [{ label: '', status: '' }]).map((row, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.bodyRow, { backgroundColor: COLORS.rowShade }] : styles.bodyRow}>
              <Text style={[styles.bodyCell, { width: '55%' }]}>{dash(row.label)}</Text>
              <Text style={[styles.bodyCell, { width: '45%', borderRight: 'none' }]}>{dash(row.status)}</Text>
            </View>
          ))}
        </View>

        <Footer />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionLabel}>Passengers Information:</Text>
        <View style={styles.passTable}>
          <View style={styles.headRow}>
            <Text style={[styles.passHeadCell, { width: '6%' }]}></Text>
            <Text style={[styles.passHeadCell, { width: '28%' }]}>Passengers Names</Text>
            <Text style={[styles.passHeadCell, { width: '15%' }]}>Nationality</Text>
            <Text style={[styles.passHeadCell, { width: '13%' }]}>D.O.B</Text>
            <Text style={[styles.passHeadCell, { width: '18%' }]}>Passport Number</Text>
            <Text style={[styles.passHeadCell, { width: '10%' }]}>Issue Date</Text>
            <Text style={[styles.passHeadCell, { width: '10%', borderRight: 'none' }]}>Expiry Date</Text>
          </View>
          {data.passengers.map((p, i) => (
            <View key={i} style={i % 2 === 1 ? [styles.bodyRow, { backgroundColor: COLORS.rowShade }] : styles.bodyRow}>
              <Text style={[styles.passBodyCell, { width: '6%' }]}>{i + 1}</Text>
              <Text style={[styles.passBodyCell, { width: '28%', textAlign: 'left' }]}>
                {p.full_name}{p.is_vip ? '  (VIP)' : ''}
              </Text>
              <Text style={[styles.passBodyCell, { width: '15%' }]}>{dash(p.nationality)}</Text>
              <Text style={[styles.passBodyCell, { width: '13%' }]}>{dash(p.date_of_birth)}</Text>
              <Text style={[styles.passBodyCell, { width: '18%' }]}>{dash(p.passport_number)}</Text>
              <Text style={[styles.passBodyCell, { width: '10%' }]}>{'—'}</Text>
              <Text style={[styles.passBodyCell, { width: '10%', borderRight: 'none' }]}>{dash(p.passport_expiry)}</Text>
            </View>
          ))}
          {data.passengers.length === 0 && (
            <View style={styles.bodyRow}>
              <Text style={[styles.passBodyCell, { width: '100%', borderRight: 'none' }]}>No passengers on file for this flight.</Text>
            </View>
          )}
        </View>

        <Footer />
      </Page>
    </Document>
  );
}

export async function generateFlightBriefingPdf(data: FlightBriefingData): Promise<Blob> {
  return await pdf(<FlightBriefingDocument data={data} />).toBlob();
}

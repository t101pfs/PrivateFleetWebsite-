import { Document, Page, Text, View, Image, Font, StyleSheet, pdf } from '@react-pdf/renderer';
import logoDark from '@/assets/pfs-crest.png';
import cairoRegular from '@/assets/fonts/Cairo-Regular.ttf';
import cairoBold from '@/assets/fonts/Cairo-Bold.ttf';

Font.register({
  family: 'CairoArabic',
  fonts: [
    { src: cairoRegular, fontWeight: 'normal' },
    { src: cairoBold, fontWeight: 'bold' },
  ],
});

const COLORS = {
  text: '#1A1A1A',
  muted: '#4A4A4A',
  border: '#333333',
  borderLight: '#999999',
  rowShade: '#EEEEEE',
  white: '#FFFFFF',
};

export interface ClientContractLeg {
  date: string;
  from: string;
  to: string;
  departureTime: string;
  passengers: number;
  duration?: string;
}

export interface ClientContractData {
  contractNumber: string;
  contractDateLabel: string;
  contractEndDate: string;
  secondPartyName: string;
  secondPartyCity?: string;
  secondPartyId?: string;
  aircraftType: string;
  paxCapacity: number | string;
  legs: ClientContractLeg[];
  mainPaxName: string;
  grossPrice: number;
  currency: string;
  signerName: string;
  signerTitle: string;
  /** When true, "Royal terminal" is listed as included in the gross charter
   * price instead of excluded from it. */
  royalTerminal?: boolean;
}

const fmtMoney = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n) + ' ' + currency;

// ============================================================
// ENGLISH DOCUMENT
// ============================================================

const enStyles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'Helvetica', fontSize: 10, color: COLORS.text, lineHeight: 1.3 },
  logoWrap: { alignItems: 'center', marginBottom: 14 },
  logoImg: { width: 55, height: 55, objectFit: 'contain' },
  brandWord: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: 1, marginTop: 4 },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  brandRuleLine: { width: 14, height: 1, backgroundColor: COLORS.borderLight },
  brandRuleWord: { fontSize: 7, color: COLORS.muted, letterSpacing: 2, marginHorizontal: 5 },

  title: { fontSize: 13, fontFamily: 'Helvetica-Bold', textAlign: 'center', textDecoration: 'underline', marginBottom: 10 },
  h2: { fontSize: 11, fontFamily: 'Helvetica-Bold', textDecoration: 'underline', marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 5, textAlign: 'justify' },
  bold: { fontFamily: 'Helvetica-Bold' },
  item: { marginBottom: 2, flexDirection: 'row' },
  itemLabel: { width: 16 },
  itemBody: { flex: 1, textAlign: 'justify' },

  table: { border: `1 solid ${COLORS.border}`, marginTop: 3, marginBottom: 5 },
  tRow: { flexDirection: 'row', borderTop: `0.5 solid ${COLORS.border}` },
  tRowFirst: { flexDirection: 'row', backgroundColor: COLORS.rowShade },
  tCell: { flex: 1, fontSize: 8.5, padding: 4, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  tCellLast: { flex: 1, fontSize: 8.5, padding: 4, textAlign: 'center' },
  tHead: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold', padding: 4, textAlign: 'center', borderRight: `0.5 solid ${COLORS.border}` },
  tHeadLast: { flex: 1, fontSize: 8.5, fontFamily: 'Helvetica-Bold', padding: 4, textAlign: 'center' },

  sigRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  sigCol: { width: '45%' },
  sigHeading: { fontSize: 10, textDecoration: 'underline', marginBottom: 8 },
  sigName: { fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  sigTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  sigLine: { marginBottom: 8 },

  pageNum: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: COLORS.muted },
});

const EnLetterhead = () => (
  <View style={enStyles.logoWrap}>
    <Image src={logoDark} style={enStyles.logoImg} />
    <Text style={enStyles.brandWord}>PRIVATE FLEET</Text>
    <View style={enStyles.brandRule}>
      <View style={enStyles.brandRuleLine} />
      <Text style={enStyles.brandRuleWord}>SERVICES</Text>
      <View style={enStyles.brandRuleLine} />
    </View>
  </View>
);

const EnPageNum = () => (
  <Text style={enStyles.pageNum} render={({ pageNumber }) => `${pageNumber}`} fixed />
);

function EnItem({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (
    <View style={enStyles.item}>
      <Text style={enStyles.itemLabel}>{letter}.</Text>
      <Text style={enStyles.itemBody}>{children}</Text>
    </View>
  );
}

function ClientContractDocumentEN({ data }: { data: ClientContractData }) {
  const legs = data.legs.length ? data.legs : [{ date: '', from: '', to: '', departureTime: '', passengers: 0 }];
  return (
    <Document>
      <Page size="A4" style={enStyles.page}>
        <EnLetterhead />
        <Text style={enStyles.title}>Charter flight Contract #{data.contractNumber}</Text>

        <Text style={enStyles.p}>
          On {data.contractDateLabel} an agreement was established by:
        </Text>
        <Text style={enStyles.p}>
          1. <Text style={enStyles.bold}>Private Fleet Services</Text> CR. No. (4030284062), Jeddah Al Murjan District, King
          Abdulaziz Rd, Phone No. 6512227, represented by Mr. {data.signerName}{'\n'}
          Hereby referred to as (the "First Party")
        </Text>
        <Text style={enStyles.p}>And</Text>
        <Text style={enStyles.p}>
          2. (Second Party Info: {data.secondPartyName}, KSA, {data.secondPartyCity || 'JEDDAH'}
          {data.secondPartyId ? `, ID#: ${data.secondPartyId}` : ''}){'\n'}
          Hereby referred to as (the "Second Party")
        </Text>

        <Text style={enStyles.h2}>Preamble</Text>
        <Text style={enStyles.p}>
          Where the First Party works within the field of aviation services and is capable to provide to the Second
          Party with the requested flights, upon the availability and ability of the operator. By such, Both Parties
          agree in their full competency and legal status to the terms and condition of this agreement as follows:
        </Text>

        <Text style={enStyles.h2}>Article (1):</Text>
        <Text style={enStyles.p}>
          The Preamble is an integral part of this contract, and is to be read and to be interpreted with it.
        </Text>

        <Text style={enStyles.h2}>Article (2): Subject of the Contract</Text>
        <Text style={enStyles.p}>
          Both Parties agree that the First Party is obliged to provide the Second Party proposed schedule: subject
          to schedule availability, over flight clearance/traffic rights and any other required authorizations
          and/or permits, for the performance of the flights to take place as the following:
        </Text>
        <Text style={{ marginBottom: 3 }}><Text style={enStyles.bold}>Aircraft type: </Text>{data.aircraftType}</Text>
        <Text style={{ marginBottom: 5 }}><Text style={enStyles.bold}>Passengers capacity: </Text>{data.paxCapacity}</Text>

        <View style={enStyles.table}>
          <View style={enStyles.tRowFirst}>
            <Text style={enStyles.tHead}>Date</Text>
            <Text style={enStyles.tHead}>Route</Text>
            <Text style={enStyles.tHead}>DepTime</Text>
            <Text style={enStyles.tHead}>Pax number</Text>
            <Text style={enStyles.tHeadLast}>Flight Duration</Text>
          </View>
          {legs.map((leg, i) => (
            <View key={i} style={enStyles.tRow}>
              <Text style={enStyles.tCell}>{leg.date || '00/00/2026'}</Text>
              <Text style={enStyles.tCell}>{leg.from && leg.to ? `${leg.from} - ${leg.to}` : ''}</Text>
              <Text style={enStyles.tCell}>{leg.departureTime || 'LT'}</Text>
              <Text style={enStyles.tCell}>{leg.passengers || ''}</Text>
              <Text style={enStyles.tCellLast}>{leg.duration || ''}</Text>
            </View>
          ))}
        </View>
        <Text style={enStyles.p}>The operating of the above schedule is subject to permits,</Text>

        <Text style={enStyles.h2}>Article (3): Duration of the Contract</Text>
        <Text style={enStyles.p}>
          Both Parties agree that the duration of this contract is measured by the duration of each flight, the
          contract comes to effect from the date of signatory and ends on ({data.contractEndDate}).
        </Text>

        <Text style={enStyles.h2}>Article (4): Main Pax Name: {data.mainPaxName}</Text>
        <Text style={enStyles.p}>
          Both Parties agree that the gross charter price is approved as (<Text style={enStyles.bold}>{fmtMoney(data.grossPrice, data.currency)}</Text>) which
          shall be paid directly after signing this agreement by the second party.{'\n'}
          Any additional charges will be incurred for payments received by Credit Card which will be determined and
          clarified on the Credit Card Confirmation Form.
        </Text>

        <Text style={[enStyles.p, enStyles.bold]}>The gross charter price mentioned above excludes prices of the following:</Text>
        <EnItem letter="a">Any changes to the above listed itinerary.</EnItem>
        <EnItem letter="b">Usage of internet, WIFI, or in-flight satellite telephone.</EnItem>
        <EnItem letter="c">Ground transportation for passenger.</EnItem>
        <EnItem letter="d">Royalties.</EnItem>
        <EnItem letter="e">Visas.</EnItem>
        <EnItem letter="f">Government fees{data.royalTerminal ? '' : ', Royal terminal'}.</EnItem>
        <EnItem letter="g">Charges customs or similar as charge to the Operator, fees for de-icing aircraft.</EnItem>

        <Text style={[enStyles.p, enStyles.bold, { marginTop: 6 }]}>The gross charter price mentioned above includes prices of the following:</Text>
        <EnItem letter="a">Use of aircraft.</EnItem>
        <EnItem letter="b">Fuel and oil.</EnItem>
        <EnItem letter="c">Handling landing permissions and flight fees.</EnItem>
        <EnItem letter="d">Overflight approvals.</EnItem>
        <EnItem letter="e">Flight planning fees.</EnItem>
        <EnItem letter="f">Crew expenses.</EnItem>
        <EnItem letter="g">Catering.</EnItem>
        {data.royalTerminal && <EnItem letter="h">Royal terminal.</EnItem>}

        <Text style={[enStyles.p, { marginTop: 6 }]}>
          All flights shall operate subject to the approval of the operator's Standard Terms and Conditions
          currently in force, provided by the first party.
        </Text>

        <Text style={enStyles.h2}>Article (5): Bank Account Details;</Text>
        <Text style={enStyles.p}>
          Transfer will be to the below bank account details:{'\n'}
          SNB Account Information:{'\n'}
          <Text style={enStyles.bold}>Bank Name: Saudi National Bank{'\n'}
          Name: Private Fleet Services{'\n'}
          Account: 13500000584200{'\n'}
          IBAN: SA1110000013500000584200{'\n'}</Text>
          Branch: Jeddah.
        </Text>

        <Text style={enStyles.h2}>Article (6): Documents</Text>
        <Text style={enStyles.p}>
          The Second Party is responsible for all passengers to carry the required documents (including but not
          limited to: passports, visas, health and other certificates) prior to the departure from the country of
          origin. If a passenger fails to provide the requisite travel documents, the First Party is not responsible
          and shall indemnify the Second Party for incurred losses and costs.
        </Text>

        <Text style={enStyles.h2}>Article (7): Cancellation / Change Fees</Text>
        <Text style={enStyles.p}>
          Both Parties agree that the applicable terms regarding cancellation (or the terms of the operator, if the
          fees are higher) shall be paid upon demand, calculated of the total charter price, as follows:
        </Text>
        <Text style={enStyles.p}>
          • 50% of the total price with immediate effect.{'\n'}
          • 75% of the total price for cancellations occurring less than 28 days prior to departure.{'\n'}
          • 100% of the total price for cancellations occurring less than 14 days prior to departure.{'\n'}
          • 100% of the total price for cancellations occurring less than 7 days prior to departure.
        </Text>

        <EnItem letter="a">
          Changes to the itinerary, as listed above, are not included in the mentioned prices as well as aircraft
          de-icing including on any positioning, de-positioning or ferry leg, any operator levied fuel surcharges,
          war risk insurance costs, any additional proceedings by the crew. Prices exclude any additional landings,
          re-routes, demurrage, or flight hours; as well as additional catering order, and the usage of the inflight
          telephone, internet access related charges, or ground transportation and royalties where applicable.
        </EnItem>
        <EnItem letter="b">Where any of the above costs are applicable, payments will be made by the Second Party upon receiving the invoice in respect to the related costs.</EnItem>
        <EnItem letter="c">All flights shall operate subject to the approval of the operator's Standard Terms and Conditions currently in force, provided by the first Party.</EnItem>
        <EnItem letter="d">The Second Party acknowledges that the aforesaid Flight is subject to all relevant authorities granting traffic rights and operational approvals, clearances and over flight permissions as required. This Flight is operated on charter for higher basis and subject to timely receipt of the requisite permissions.</EnItem>
        <EnItem letter="e">In case of cancellation by the Operator due to the above mentioned reasons, the Second Party will be compensated for the amount equal to the proportion of the unused hours (pro-rata) as applicable.</EnItem>
        <EnItem letter="f">In case of cancellation by the Operator due to AOG, the First Party will try his best to provide a replacement aircraft with the same price mentioned in this signed contract; in case the only available replacement aircraft has a higher cost, the second party has to pay the difference.</EnItem>
        <EnItem letter="g">The Second Party acknowledges that in the event the flight is postponed due to the actions of the Second Party or its representatives, the First Party has the right to consider the flight has been cancelled and to apply cancellation fees as per the above. The updated schedule will be considered as a new request subject to aircraft availability.</EnItem>
        <EnItem letter="h">The Second Party shall not hold the First Party responsible for the delay or cancellation of the flight due to Force Majeure, which might occur before or during the time of flight or transit.</EnItem>
        <EnItem letter="i">The Second Party acknowledges that the flight will be automatically cancelled if the Second Party or any of its members or representatives have infringed any of the regulations of the Kingdom of Saudi Arabia.</EnItem>

        <Text style={enStyles.h2}>Article (8): Liability</Text>
        <EnItem letter="a">The Second Party acknowledges and accepts that the First Party is not liable for the performance of the flight, and that the responsibility of the performance of the flights fall directly and solely on the operator of the flight.</EnItem>
        <EnItem letter="b">The Second Party will not hold the First Party accountable for any claim that shall be placed by the operator against the First Party which may result through any act or omission by the Second Party or that of its passengers.</EnItem>
        <EnItem letter="c">The Second Party acknowledges that in the event of Force Majeure, the First Party shall not be held responsible for the delay or cancellation of the flight due to Force Majeure, which might occur before or during the time of flight or transit.</EnItem>
        <EnItem letter="d">The First Party shall not be liable for any damages as a consequence of cancellation of the Flight due to insufficient approvals, clearances or any technical issues.</EnItem>
        <EnItem letter="e">The Second Party acknowledges that if they cause any damage in the aircraft, the First Party will evaluate the damage cost and the Second Party will settle all damage costs as per damage evaluation.</EnItem>
        <EnItem letter="f">The Second Party acknowledges that the First Party shall not be held liable for the actions of the Second Party, or its members or representatives.</EnItem>

        <Text style={enStyles.h2}>Article (9): Applicable Laws and Jurisdiction</Text>
        <EnItem letter="g">The Second Party acknowledges that this contract is governed by the laws and regulations of the Kingdom of Saudi Arabia.</EnItem>
        <EnItem letter="h">The Second Party acknowledge that the flight will be automatically cancelled if the representatives have infringed any of the Country's regulations.</EnItem>
        <EnItem letter="i">The First Party is not liable or responsible for our representatives' actions.</EnItem>
        <EnItem letter="j">The Second Party acknowledge that this contract is governed by the laws and regulations of the Kingdom of Saudi Arabia and International Aviation laws and regulations.</EnItem>
        <EnItem letter="k">The Second Party acknowledge that the flight will be automatically canceled if they or their representatives have infringed any of those regulations (such as smoking or getting pets on board without permission) the First Party is not liable for our representatives' actions.</EnItem>
        <EnItem letter="l">The Second Party acknowledges that in the event of dispute or difference arises in connection with the interpretation of performance of this contract, and where it cannot be resolved by way of friendly negotiation between the Parties, such disputes and differences shall be finally resolved through Arbitration. The Arbitration shall be performed by the "Saudi Center for Commercial Arbitration" in Jeddah, Saudi Arabia, where the official language of the arbitration shall be in Arabic. The arbitration cost shall be borne by the losing party.</EnItem>

        <Text style={enStyles.h2}>Article (10): Certification</Text>
        <Text style={enStyles.p}>
          The Second Party hereby certifies that it has read the foregoing Agreement, and that it has been
          thoroughly explained and that the Second Party fully understands the terms and conditions which
          constitute the entire contract. It is specifically agreed by both parties hereto that this contract shall
          be subject to modification only in writing and where it is approved and signed by both parties.
        </Text>

        <Text style={enStyles.h2}>Article (11): Contract Copies</Text>
        <Text style={enStyles.p}>
          This Contract is issued in two original copies, one for each of the parties to abide by.
        </Text>

        <View style={enStyles.sigRow} wrap={false}>
          <View style={enStyles.sigCol}>
            <Text style={enStyles.sigHeading}>The First Party</Text>
            <Text style={enStyles.sigName}>Mr. {data.signerName}</Text>
            <Text style={enStyles.sigTitle}>{data.signerTitle}</Text>
            <Text style={enStyles.sigLine}>Signature: ___________________</Text>
            <Text style={enStyles.sigLine}>Date: ___________________</Text>
          </View>
          <View style={enStyles.sigCol}>
            <Text style={enStyles.sigHeading}>The Second Party</Text>
            <Text style={enStyles.sigName}>Main Pax Representative:</Text>
            <Text style={enStyles.sigTitle}> </Text>
            <Text style={enStyles.sigLine}>Signature: ___________________</Text>
            <Text style={enStyles.sigLine}>Date: ___________________</Text>
          </View>
        </View>

        <EnPageNum />
      </Page>
    </Document>
  );
}

// ============================================================
// ARABIC DOCUMENT
// ============================================================

const arStyles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 40, paddingHorizontal: 44, fontFamily: 'CairoArabic', fontSize: 10, color: COLORS.text, lineHeight: 1.4 },
  logoWrap: { alignItems: 'center', marginBottom: 14 },
  logoImg: { width: 55, height: 55, objectFit: 'contain' },
  brandWord: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: COLORS.text, letterSpacing: 1, marginTop: 4 },
  brandRule: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  brandRuleLine: { width: 14, height: 1, backgroundColor: COLORS.borderLight },
  brandRuleWord: { fontSize: 7, color: COLORS.muted, letterSpacing: 2, marginHorizontal: 5 },

  companyName: { fontSize: 12, fontFamily: 'CairoArabic', fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  // The contract number sits right beside its Arabic label (not spread
  // across the full page width) while still being its own isolated Text
  // node, so it stays put instead of landing wherever bidi reordering
  // happens to place it inside one mixed-script line.
  titleRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6, marginBottom: 10 },
  titleNumber: { fontSize: 12, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' },
  title: { fontSize: 13, fontFamily: 'CairoArabic', fontWeight: 'bold', textDecoration: 'underline' },
  h2: { fontSize: 11, fontFamily: 'CairoArabic', fontWeight: 'bold', textDecoration: 'underline', marginTop: 8, marginBottom: 3, textAlign: 'right' },
  // Same isolated-value trick for a heading that ends in a Latin/mixed
  // value (e.g. a passenger's name) - the label (incl. its own trailing
  // colon) and the value are each their own Text node, packed together at
  // the right instead of one Text node where the value could land anywhere.
  h2Row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', gap: 6, marginTop: 8, marginBottom: 3 },
  h2RowLabel: { fontSize: 11, fontFamily: 'CairoArabic', fontWeight: 'bold', textDecoration: 'underline' },
  h2RowValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  // direction:'rtl' below is the actual fix for the mixed Arabic/Latin
  // scrambling bug (a name after "السيد/", an embedded date, etc.) -
  // react-pdf's text engine defaults every paragraph's bidi base direction
  // to 'ltr' unless its OWN style says otherwise (confirmed by reading its
  // source - this property isn't inherited from a parent/Page style the
  // way fontFamily or textAlign are, so it has to be set directly on a
  // style whose Text node actually mixes Arabic with Latin/digit content).
  // Pure single-script text was never affected (bidi-js resolves it the
  // same either way), which is why most of the document looked fine
  // already, and why this is applied only to the two styles (`p` and
  // `itemBody`) that host paragraphs with an embedded Latin/digit value -
  // adding it more broadly (table cells, labels, the signature block)
  // was tried and made those specific runs vanish from the rendered PDF
  // entirely, so it's deliberately NOT applied there.
  p: { marginBottom: 5, textAlign: 'right', direction: 'rtl' },
  // A leading value (a percentage, a count) isolated from the sentence that
  // follows it, same reasoning as h2Row - reused for the cancellation-fee
  // percentages, each its own row instead of one Text block of four lines.
  pctItem: { flexDirection: 'row-reverse', marginBottom: 2 },
  pctLabel: { fontFamily: 'CairoArabic', fontWeight: 'bold', marginLeft: 4 },
  // Same fix as the contract number: a Latin/numeric value (beneficiary
  // name, account number, IBAN) embedded in a right-aligned Arabic line
  // lands wherever bidi reordering puts it, not at the left margin. Each
  // value gets its own row instead, pinned left opposite its Arabic label.
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  detailLabel: { fontFamily: 'CairoArabic' },
  detailValue: { fontFamily: 'Helvetica' },
  bold: { fontWeight: 'bold' },
  item: { marginBottom: 2, flexDirection: 'row-reverse' },
  itemLabel: { width: 16, textAlign: 'right' },
  itemBody: { flex: 1, textAlign: 'right', direction: 'rtl' },

  table: { border: `1 solid ${COLORS.border}`, marginTop: 3, marginBottom: 5 },
  tRow: { flexDirection: 'row-reverse', borderTop: `0.5 solid ${COLORS.border}` },
  tRowFirst: { flexDirection: 'row-reverse', backgroundColor: COLORS.rowShade },
  tCell: { flex: 1, fontSize: 8.5, padding: 4, textAlign: 'center', borderLeft: `0.5 solid ${COLORS.border}` },
  tCellLast: { flex: 1, fontSize: 8.5, padding: 4, textAlign: 'center' },
  tHead: { flex: 1, fontSize: 8.5, fontFamily: 'CairoArabic', fontWeight: 'bold', padding: 4, textAlign: 'center', borderLeft: `0.5 solid ${COLORS.border}` },
  tHeadLast: { flex: 1, fontSize: 8.5, fontFamily: 'CairoArabic', fontWeight: 'bold', padding: 4, textAlign: 'center' },

  sigRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 20 },
  sigCol: { width: '45%', alignItems: 'flex-end' },
  sigHeading: { fontSize: 10, textDecoration: 'underline', marginBottom: 8 },
  sigName: { fontFamily: 'CairoArabic', fontWeight: 'bold', marginBottom: 1, textAlign: 'right', direction: 'rtl', width: '100%' },
  sigTitle: { fontFamily: 'CairoArabic', fontWeight: 'bold', marginBottom: 10 },
  sigLine: { marginBottom: 8 },

  pageNum: { position: 'absolute', bottom: 24, left: 0, right: 0, textAlign: 'center', fontSize: 9, color: COLORS.muted },
});

const ArLetterhead = () => (
  <View style={arStyles.logoWrap}>
    <Image src={logoDark} style={arStyles.logoImg} />
    <Text style={arStyles.brandWord}>PRIVATE FLEET</Text>
    <View style={arStyles.brandRule}>
      <View style={arStyles.brandRuleLine} />
      <Text style={arStyles.brandRuleWord}>SERVICES</Text>
      <View style={arStyles.brandRuleLine} />
    </View>
  </View>
);

const ArPageNum = () => (
  <Text style={arStyles.pageNum} render={({ pageNumber }) => `${pageNumber}`} fixed />
);

function ArItem({ letter, children }: { letter: string; children: React.ReactNode }) {
  return (
    <View style={arStyles.item}>
      <Text style={arStyles.itemLabel}>{letter}.</Text>
      <Text style={arStyles.itemBody}>{children}</Text>
    </View>
  );
}

function ArPercentItem({ pct, children }: { pct: string; children: React.ReactNode }) {
  return (
    <View style={arStyles.pctItem}>
      <Text style={arStyles.pctLabel}>{pct}</Text>
      <Text style={arStyles.itemBody}>{children}</Text>
    </View>
  );
}

function ClientContractDocumentAR({ data }: { data: ClientContractData }) {
  const legs = data.legs.length ? data.legs : [{ date: '', from: '', to: '', departureTime: '', passengers: 0 }];
  return (
    <Document>
      <Page size="A4" style={arStyles.page}>
        <ArLetterhead />
        <Text style={arStyles.companyName}>شركة الأسطول الخاص للطيران</Text>
        <View style={arStyles.titleRow}>
          <Text style={arStyles.titleNumber}>{data.contractNumber}</Text>
          <Text style={arStyles.title}>عقد ايجار طائرة رقم</Text>
        </View>

        <Text style={arStyles.p}>أبرم هذا العقد بتاريخ {data.contractDateLabel} بين كل من:</Text>
        {/* No literal "(" / ")" inside any wrapping Arabic paragraph below -
            react-pdf mis-renders a mirrored parenthesis as a wrong, unrelated
            glyph whenever line-wrapping happens to place it at the edge of a
            line (verified by rendering: reproduces with real test data, the
            exact wrap point shifts with name/city length so it isn't
            reliably avoidable any other way). Commas stand in for parens
            throughout this document instead. */}
        <ArItem letter="1">
          شركة الأسطول الخاص للطيران، سجل تجاري رقم 4030284062، وعنوانها جدة، حي المرجان، طريق الملك عبد
          العزيز، هاتف رقم 6512227، ويمثلها السيد/ {data.signerName}، يشار إليها فيما يلي باسم "الطرف الأول"
        </ArItem>
        <Text style={arStyles.p}>و</Text>
        <ArItem letter="2">
          معلومات الطرف الثاني: السيد/ {data.secondPartyName}، المملكة العربية السعودية، {data.secondPartyCity || 'جدة'}
          {data.secondPartyId ? `، رقم الهوية: ${data.secondPartyId}` : '، رقم الهوية: ..........'}
          ، يشار إليه فيما يلي باسم "الطرف الثاني"
        </ArItem>

        <Text style={arStyles.h2}>التمهيد</Text>
        <Text style={arStyles.p}>
          حيث يعمل الطرف الأول في مجال خدمات الطيران وقادر على تزويد الطرف الثاني بالرحلات المطلوبة، بناءً على توافر
          وقدرة المشغل. وبموجب هذا العقد، اتفق الطرفان وهما بكفاءتهما الكاملة ووضعهما القانوني على الشروط والأحكام
          الخاصة بهذا العقد على النحو التالي:
        </Text>

        <Text style={arStyles.h2}>المادة (1):</Text>
        <Text style={arStyles.p}>يعتبر التمهيد أعلاه جزءًا لا يتجزأ من هذا العقد، ويجب قراءتهما وتفسيرهما معًا.</Text>

        <Text style={arStyles.h2}>المادة (2): موضوع العقد</Text>
        <Text style={arStyles.p}>
          اتفق الطرفان على أن الطرف الأول ملزم بتقديم الجدول الزمني المقترح للطرف الثاني: وفقًا لتوافر الجدول الزمني،
          وتراخيص التحليق / حقوق المرور وأي تصاريح و/أو أذونات أخرى مطلوبة لأداء الرحلات الجوية على النحو التالي:
        </Text>
        <View style={arStyles.detailRow}>
          <Text style={arStyles.detailValue}>{data.aircraftType}</Text>
          <Text style={[arStyles.detailLabel, arStyles.bold]}>نوع الطائرة:</Text>
        </View>
        <View style={[arStyles.detailRow, { marginBottom: 5 }]}>
          <Text style={arStyles.detailValue}>{data.paxCapacity}</Text>
          <Text style={[arStyles.detailLabel, arStyles.bold]}>سعة الركاب:</Text>
        </View>

        <View style={arStyles.table}>
          <View style={arStyles.tRowFirst}>
            <Text style={arStyles.tHead}>التاريخ</Text>
            <Text style={arStyles.tHead}>المسار</Text>
            <Text style={arStyles.tHead}>وقت المغادرة</Text>
            <Text style={arStyles.tHead}>عدد الركاب</Text>
            <Text style={arStyles.tHeadLast}>مدة الرحلة</Text>
          </View>
          {legs.map((leg, i) => (
            <View key={i} style={arStyles.tRow}>
              <Text style={arStyles.tCell}>{leg.date || '2026/00/00'}</Text>
              <Text style={arStyles.tCell}>{leg.from && leg.to ? `${leg.from} - ${leg.to}` : ''}</Text>
              <Text style={arStyles.tCell}>{leg.departureTime || 'التوقيت المحلي'}</Text>
              <Text style={arStyles.tCell}>{leg.passengers || ''}</Text>
              <Text style={arStyles.tCellLast}>{leg.duration || ''}</Text>
            </View>
          ))}
        </View>
        <Text style={arStyles.p}>يخضع العمل بالجدول أعلاه للحصول على التصاريح،</Text>

        <Text style={arStyles.h2}>المادة (3): مدة العقد</Text>
        <Text style={arStyles.p}>
          اتفق الطرفان على قياس مدة هذا العقد بمدة كل رحلة، ويدخل العقد حيز التنفيذ من تاريخ التوقيع وينتهي في تاريخ
          {data.contractEndDate}.
        </Text>

        <View style={arStyles.h2Row}>
          <Text style={arStyles.h2RowValue}>{data.mainPaxName}</Text>
          <Text style={arStyles.h2RowLabel}>المادة (4): اسم الراكب الرئيسي:</Text>
        </View>
        <Text style={arStyles.p}>
          اتفق الطرفان على الموافقة على السعر الإجمالي للإيجار <Text style={arStyles.bold}>{fmtMoney(data.grossPrice, data.currency)}</Text> والذي يلتزم
          الطرف الثاني بدفعه مباشرة بعد توقيع هذا العقد. سيتم تكبد أي رسوم إضافية للمدفوعات المستلمة عن طريق بطاقة
          الائتمان والتي سيتم تحديدها وتوضيحها في نموذج تأكيد بطاقة الائتمان.
        </Text>

        <Text style={[arStyles.p, arStyles.bold]}>لا يشمل السعر الإجمالي للإيجار المذكور أعلاه الأسعار التالية:</Text>
        <ArItem letter="ا">أي تغييرات في خط سير الرحلة المذكورة أعلاه.</ArItem>
        <ArItem letter="ب">استخدام الإنترنت أو الواي فاي أو الهاتف عبر الأقمار الصناعية على متن الطائرة.</ArItem>
        <ArItem letter="ت">النقل البري للركاب.</ArItem>
        <ArItem letter="ث">حقوق امتياز الطائرة.</ArItem>
        <ArItem letter="ج">التأشيرات.</ArItem>
        <ArItem letter="ح">الرسوم الحكومية{data.royalTerminal ? '' : ' - الصالة الملكية'}.</ArItem>
        <ArItem letter="خ">الرسوم الجمركية أو ما شابه ذلك كرسوم على المشغل لإزالة الجليد عن الطائرات.</ArItem>

        <Text style={[arStyles.p, arStyles.bold, { marginTop: 6 }]}>يشمل السعر الإجمالي للإيجار المذكور أعلاه الأسعار التالية:</Text>
        <ArItem letter="ا">استخدام الطائرات.</ArItem>
        <ArItem letter="ب">الوقود والزيت.</ArItem>
        <ArItem letter="ت">معالجة أذونات الهبوط ورسوم الطيران.</ArItem>
        <ArItem letter="ث">موافقات التحليق.</ArItem>
        <ArItem letter="ج">رسوم تخطيط الرحلة.</ArItem>
        <ArItem letter="ح">نفقات الطاقم.</ArItem>
        <ArItem letter="خ">خدمات تقديم الطعام.</ArItem>
        {data.royalTerminal && <ArItem letter="د">الصالة الملكية.</ArItem>}

        <Text style={[arStyles.p, { marginTop: 6 }]}>
          يُسمح بجميع الرحلات الجوية حسب موافقة المشغل الخاصة بالشروط والأحكام القياسية السارية حاليًا والتي يقدمها
          الطرف الأول.
        </Text>

        <Text style={arStyles.h2}>المادة (5): المستندات</Text>
        <Text style={arStyles.p}>
          يتحمل الطرف الثاني المسؤولية عن حمل جميع الركاب المستندات المطلوبة، بما في ذلك على سبيل المثال لا الحصر:
          جوازات السفر والتأشيرات والشهادات الصحية وغيرها، قبل مغادرة بلدهم الأصلي. إذا أخفق الراكب في تقديم مستندات
          السفر المطلوبة، فلا يعتبر الطرف الأول مسؤولًا ويجب على الطرف الثاني التعويض عن الخسائر والتكاليف المتكبدة.
        </Text>

        <Text style={arStyles.h2}>المادة (6): تفاصيل الحساب البنكي:</Text>
        <Text style={arStyles.p}>إسم البنك: البنك الأهلي السعودي</Text>
        <View style={arStyles.detailRow}>
          <Text style={arStyles.detailValue}>Private Fleet Services</Text>
          <Text style={arStyles.detailLabel}>إسم المستفيد:</Text>
        </View>
        <View style={arStyles.detailRow}>
          <Text style={arStyles.detailValue}>13500000584200</Text>
          <Text style={arStyles.detailLabel}>رقم الحساب:</Text>
        </View>
        <View style={arStyles.detailRow}>
          <Text style={arStyles.detailValue}>SA1110000013500000584200</Text>
          <Text style={arStyles.detailLabel}>رقم الآيبان:</Text>
        </View>

        <Text style={arStyles.h2}>المادة (7): رسوم الإلغاء / التغيير</Text>
        <Text style={arStyles.p}>
          يتفق الطرفان على دفع الشروط المطبقة فيما يتعلق بالإلغاء، أو شروط المشغل إذا كانت الرسوم أعلى، عند الطلب،
          محسوبة من السعر الإجمالي للإيجار، على النحو التالي:
        </Text>
        <ArPercentItem pct="50٪">من السعر الإجمالي عند الإلغاء الفوري.</ArPercentItem>
        <ArPercentItem pct="75٪">من السعر الإجمالي لعمليات الإلغاء التي تحدث قبل أقل من 28 يومًا من المغادرة.</ArPercentItem>
        <ArPercentItem pct="100٪">من السعر الإجمالي لعمليات الإلغاء التي تحدث قبل أقل من 14 يومًا من المغادرة.</ArPercentItem>
        <ArPercentItem pct="100٪">من السعر الإجمالي لعمليات الإلغاء التي تحدث قبل أقل من 7 أيام من المغادرة.</ArPercentItem>

        <ArItem letter="ا">
          لا تدرج التغييرات في خط سير الرحلة، على النحو المذكور أعلاه، في الأسعار المذكورة بالإضافة إلى إزالة الجليد
          عن الطائرات بما في ذلك أي خدمات تحديد للموقع أو عدم تحديد المواقع أو الرحلات الخالية، وأي رسوم إضافية
          للوقود يفرضها المشغل، وتكاليف التأمين ضد مخاطر الحرب، وأي إجراءات إضافية من قبل الطاقم. ولا تشمل الأسعار أي
          عمليات هبوط أو إعادة توجيه أو غرامات تأخير أو ساعات طيران إضافية؛ بالإضافة إلى خدمات طلب تقديم الطعام
          الإضافي، واستخدام الهاتف على متن الطائرة، والرسوم المتعلقة بالوصول إلى الإنترنت، أو النقل البري وحقوق
          امتياز الطائرة عند الاقتضاء.
        </ArItem>
        <ArItem letter="ب">في حالة تطبيق أي من التكاليف المذكورة أعلاه، يدفع الطرف الثاني الفاتورة عند استلامها والتي تتعلق بالتكاليف ذات الصلة.</ArItem>
        <ArItem letter="ت">يُسمح بجميع الرحلات الجوية حسب موافقة المشغل الخاصة بالشروط والأحكام القياسية السارية حاليًا والتي يقدمها الطرف الأول.</ArItem>
        <ArItem letter="ث">يقر الطرف الثاني بأن الرحلة المذكورة أعلاه تخضع لجميع السلطات ذات الصلة التي تمنح حقوق المرور والموافقات التشغيلية والموافقات وتصاريح الطيران على النحو المطلوب. يتم تشغيل هذه الرحلة على أساس الإيجار حسب الأعلى وتخضع لاستلام الأذونات المطلوبة في الوقت المناسب.</ArItem>
        <ArItem letter="ج">في حالة الإلغاء من قبل المشغل للأسباب المذكورة أعلاه، سيعوض الطرف الثاني عن المبلغ المساوي لنسبة الساعات غير المستخدمة، بالتناسب، حسب الاقتضاء.</ArItem>
        <ArItem letter="ح">في حالة الإلغاء من قبل المشغل بسبب إخفاق الطائرة في العمل، سيبذل الطرف الأول قصارى جهده لتوفير طائرة بديلة بنفس السعر المذكور في هذا العقد الموقّع؛ وفي حالة وجود تكلفة أعلى للطائرة البديلة المتاحة، يتعين على الطرف الثاني دفع الفرق.</ArItem>
        <ArItem letter="خ">يقر الطرف الثاني بأنه في حالة تأجيل الرحلة بسبب تصرفات الطرف الثاني أو ممثليه، يحق للطرف الأول اعتبار الرحلة قد تم إلغاؤها مع تطبيق رسوم الإلغاء على النحو المذكور أعلاه. ويعتبر الجدول الزمني المحدّث طلبًا جديدًا رهنًا بتوافر الطائرات.</ArItem>
        <ArItem letter="د">لا يجوز للطرف الثاني تحميل الطرف الأول المسؤولية عن تأخير أو إلغاء الرحلة بسبب أحداث القوة القاهرة، والتي قد تحدث قبل أو أثناء وقت الرحلة أو المرور.</ArItem>
        <ArItem letter="ذ">يقر الطرف الثاني بأن الرحلة ستُلغى تلقائيًا إذا انتهك الطرف الثاني أو أي من أعضائه أو ممثليه أيًا من أنظمة المملكة العربية السعودية.</ArItem>

        <Text style={arStyles.h2}>المادة (8): المسؤولية</Text>
        <ArItem letter="ا">يقر الطرف الثاني ويقبل عدم مسؤولية الطرف الأول عن أداء الرحلة، وأن مسؤولية أداء الرحلات تقع بشكل مباشر وفقط على مشغل الرحلة.</ArItem>
        <ArItem letter="ب">لن يحاسب الطرف الثاني الطرف الأول عن أي مطالبة يقدمها المشغل ضد الطرف الأول والتي قد تنتج عن أي فعل أو إغفال من قبل الطرف الثاني أو ركابه.</ArItem>
        <ArItem letter="ت">يقر الطرف الثاني بأنه في حالة القوة القاهرة، لا يتحمل الطرف الأول المسؤولية عن تأخير أو إلغاء الرحلة بسبب القوة القاهرة، والتي قد تحدث قبل أو أثناء وقت الرحلة أو المرور.</ArItem>
        <ArItem letter="ث">لا يتحمل الطرف الأول المسؤولية عن أي أضرار ناتجة عن إلغاء الرحلة بسبب عدم كفاية الموافقات أو التصاريح أو أي مشاكل فنية.</ArItem>
        <ArItem letter="ج">يقر الطرف الثاني بأنه إذا تسبب في أي ضرر للطائرة، فسيقيّم الطرف الأول تكلفة الضرر وسيسوي الطرف الثاني جميع تكاليف الضرر وفقًا لتقييم الضرر.</ArItem>
        <ArItem letter="ح">يقر الطرف الثاني بأن الطرف الأول غير مسؤول عن تصرفات الطرف الثاني أو أعضائه أو ممثليه.</ArItem>

        <Text style={arStyles.h2}>المادة (9): القوانين المطبقة والاختصاص القضائي</Text>
        <ArItem letter="خ">يقر الطرف الثاني بأن هذا العقد يخضع لقوانين وأنظمة المملكة العربية السعودية.</ArItem>
        <ArItem letter="د">يقر الطرف الثاني بأنه سيتم إلغاء الرحلة تلقائيًا إذا انتهك الممثلون أيًا من لوائح الدولة.</ArItem>
        <ArItem letter="ذ">يعتبر الطرف الأول غير ملزم أو مسؤولًا عن تصرفات ممثلينا.</ArItem>
        <ArItem letter="ر">يقر الطرف الثاني بأن هذا العقد تحكمه قوانين ولوائح المملكة العربية السعودية وقوانين ولوائح الطيران الدولي.</ArItem>
        <ArItem letter="ز">يقر الطرف الثاني بأنه سيتم إلغاء الرحلة تلقائيًا إذا انتهك هو أو ممثلوه أيًا من تلك اللوائح، مثل التدخين أو اصطحاب الحيوانات الأليفة على متن الطائرة دون إذن، ولا يتحمل الطرف الأول مسؤولية تصرفات ممثلينا.</ArItem>
        <ArItem letter="س">يقر الطرف الثاني بأنه في حالة نشوء نزاع أو خلاف فيما يتعلق بتفسير أداء هذا العقد، وحيث لا يمكن حله عن طريق المفاوضات الودية بين الطرفين، يجب حل هذه النزاعات والخلافات بشكل نهائي من خلال التحكيم. يجرى التحكيم من قبل "المركز السعودي للتحكيم التجاري" في جدة، المملكة العربية السعودية، حيث تكون اللغة الرسمية للتحكيم هي اللغة العربية. يتحمل الطرف الخاسر تكلفة التحكيم.</ArItem>

        <Text style={arStyles.h2}>المادة (10): الشهادة</Text>
        <Text style={arStyles.p}>
          يشهد الطرف الثاني بموجب هذا العقد أنه قد قرأ الاتفاقية السابقة، وأنه تلقى شرحها بدقة وأن الطرف الثاني يفهم
          تمامًا الشروط والأحكام التي تشكل العقد بأكمله. اتفق الطرفان على هذا العقد على وجه التحديد على أن هذا العقد
          يجب أن يخضع للتعديل كتابةً فقط وحيث يتم الموافقة عليه وتوقيعه من قبل الطرفين.
        </Text>

        <Text style={arStyles.h2}>المادة (11): نسخ العقد</Text>
        <Text style={arStyles.p}>أصدر هذا العقد في نسختين أصليتين، بحيث يلتزم كل طرف بها.</Text>

        <View style={arStyles.sigRow} wrap={false}>
          <View style={arStyles.sigCol}>
            <Text style={arStyles.sigHeading}>الطرف الأول</Text>
            <Text style={arStyles.sigName}>السيد/ {data.signerName}</Text>
            <Text style={arStyles.sigTitle}>{data.signerTitle}</Text>
            <Text style={arStyles.sigLine}>التوقيع: ___________________</Text>
            <Text style={arStyles.sigLine}>التاريخ: ___________________</Text>
          </View>
          <View style={arStyles.sigCol}>
            <Text style={arStyles.sigHeading}>الطرف الثاني</Text>
            <Text style={arStyles.sigName}>ممثل الراكب الرئيسي:</Text>
            <Text style={arStyles.sigTitle}> </Text>
            <Text style={arStyles.sigLine}>التوقيع: ___________________</Text>
            <Text style={arStyles.sigLine}>التاريخ: ___________________</Text>
          </View>
        </View>

        <ArPageNum />
      </Page>
    </Document>
  );
}

export async function generateClientContractPdf(data: ClientContractData, lang: 'en' | 'ar'): Promise<Blob> {
  const Doc = lang === 'ar' ? ClientContractDocumentAR : ClientContractDocumentEN;
  return await pdf(<Doc data={data} />).toBlob();
}

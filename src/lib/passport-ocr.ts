import { createWorker } from 'tesseract.js';
import { parse as parseMrz } from 'mrz';

export interface ExtractedPassportData {
  fullName?: string;
  passportNumber?: string;
  nationality?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  passportExpiry?: string; // YYYY-MM-DD
}

export interface PassportOcrResult {
  success: boolean;
  data: ExtractedPassportData;
}

// ICAO 3-letter codes for nationalities most likely to appear on a Saudi
// charter operator's manifests. Falls back to the raw code (still useful,
// just less friendly) for anything not in this list - the field stays
// editable either way.
const MRZ_COUNTRY_NAMES: Record<string, string> = {
  SAU: 'Saudi', ARE: 'Emirati', QAT: 'Qatari', KWT: 'Kuwaiti', BHR: 'Bahraini', OMN: 'Omani',
  EGY: 'Egyptian', JOR: 'Jordanian', LBN: 'Lebanese', SYR: 'Syrian', IRQ: 'Iraqi', YEM: 'Yemeni',
  MAR: 'Moroccan', TUN: 'Tunisian', DZA: 'Algerian', TUR: 'Turkish', PAK: 'Pakistani', IND: 'Indian',
  BGD: 'Bangladeshi', PHL: 'Filipino', IDN: 'Indonesian', GBR: 'British', USA: 'American',
  CAN: 'Canadian', FRA: 'French', DEU: 'German', ITA: 'Italian', ESP: 'Spanish', CHE: 'Swiss',
  RUS: 'Russian', CHN: 'Chinese', JPN: 'Japanese', KOR: 'South Korean', AUS: 'Australian',
  ZAF: 'South African', NGA: 'Nigerian', SDN: 'Sudanese', ETH: 'Ethiopian', LKA: 'Sri Lankan',
  NPL: 'Nepali',
};

function mrzDateToIso(yymmdd: string | null | undefined, kind: 'birth' | 'expiry'): string | undefined {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  // Birthdates can be 1900s or 2000s - nobody is born in the future, so if
  // the 2-digit year is later than the current one, it must be last
  // century. Expiries are effectively always 2000s in practice.
  const century = kind === 'birth' ? (yy > currentYY ? 1900 : 2000) : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

// TD3 (passport) MRZ lines are 44 characters of A-Z, 0-9, and "<" - look
// for the last two lines in the OCR output matching that shape, since the
// MRZ always sits at the very bottom of a passport's data page.
function findMrzLines(text: string): string[] | null {
  const candidates = text
    .split('\n')
    .map((l) => l.trim().toUpperCase().replace(/\s+/g, ''))
    .filter((l) => l.length >= 40 && l.length <= 46 && /^[A-Z0-9<]+$/.test(l));
  if (candidates.length < 2) return null;
  return candidates.slice(-2);
}

/** Runs OCR entirely in the browser (no external service) and parses the
 * passport's machine-readable zone. Returns success: false rather than
 * throwing when nothing usable was found, so callers can fall back to
 * manual entry without treating it as an error. */
export async function extractPassportData(file: File): Promise<PassportOcrResult> {
  const worker = await createWorker('eng');
  try {
    await worker.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<' });
    const { data } = await worker.recognize(file);
    const lines = findMrzLines(data.text);
    if (!lines) return { success: false, data: {} };

    const result = parseMrz(lines, { autocorrect: true });
    if (!result.fields.documentNumber && !result.fields.lastName) {
      return { success: false, data: {} };
    }

    const fullName = [result.fields.firstName, result.fields.lastName].filter(Boolean).join(' ').trim();
    const nationalityCode = result.fields.nationality || undefined;

    return {
      success: true,
      data: {
        fullName: fullName || undefined,
        passportNumber: result.fields.documentNumber || undefined,
        nationality: nationalityCode ? (MRZ_COUNTRY_NAMES[nationalityCode] || nationalityCode) : undefined,
        dateOfBirth: mrzDateToIso(result.fields.birthDate, 'birth'),
        passportExpiry: mrzDateToIso(result.fields.expirationDate, 'expiry'),
      },
    };
  } finally {
    await worker.terminate();
  }
}

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRY_CODES, flagFromIso2 } from '@/data/countryCodes';

export { COUNTRY_CODES };

const DEFAULT_CODE = '+966';
// Longest code first so "+1" doesn't shadow-match a number that actually starts with "+1..." belonging to a longer code sharing that prefix.
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

// Some dial codes cover many countries (+1 is the whole NANP zone - US,
// Canada, Jamaica, ...; +7 is Russia and Kazakhstan). A stored number
// alone can't say which one it was, so pick the one most of this app's
// contacts actually mean - same as any phone-country picker defaulting
// "+1" to the US rather than American Samoa.
const CANONICAL_ISO2_BY_CODE: Record<string, string> = {
  '+1': 'US',
  '+7': 'RU',
};

function countryForCode(code: string) {
  const canonicalIso2 = CANONICAL_ISO2_BY_CODE[code];
  const byCanonical = canonicalIso2 && COUNTRY_CODES.find((c) => c.iso2 === canonicalIso2);
  return byCanonical || COUNTRY_CODES.find((c) => c.code === code) || COUNTRY_CODES[0];
}

function splitValue(value: string): { code: string; rest: string } {
  const trimmed = value.trim();
  const match = SORTED_CODES.find((c) => trimmed.startsWith(c.code));
  if (match) return { code: match.code, rest: trimmed.slice(match.code.length).trim() };
  return { code: DEFAULT_CODE, rest: trimmed };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
}

export function PhoneInput({ value, onChange, placeholder = '5X XXX XXXX', id }: PhoneInputProps) {
  const { code, rest } = splitValue(value);
  const selected = countryForCode(code);

  return (
    <div className="flex gap-2">
      <Select
        value={selected.iso2}
        onValueChange={(iso2) => {
          const newCode = COUNTRY_CODES.find((c) => c.iso2 === iso2)?.code ?? DEFAULT_CODE;
          onChange(rest ? `${newCode} ${rest}` : newCode);
        }}
      >
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{flagFromIso2(selected.iso2)}</span>
              <span className="font-mono text-sm">{selected.code}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.iso2} value={c.iso2} textValue={c.country}>
              <span className="flex items-center gap-2">
                <span>{flagFromIso2(c.iso2)}</span>
                <span className="font-mono text-sm">{c.code}</span>
                <span className="text-muted-foreground">{c.country}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        value={rest}
        onChange={(e) => onChange(`${selected.code} ${e.target.value}`.trim())}
        placeholder={placeholder}
        className="flex-1 min-w-0"
      />
    </div>
  );
}

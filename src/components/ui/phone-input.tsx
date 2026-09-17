import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// GCC first (where Private Fleet actually operates), then other markets
// charter clients commonly come from.
export const COUNTRY_CODES = [
  { code: '+966', flag: '🇸🇦', country: 'Saudi Arabia' },
  { code: '+971', flag: '🇦🇪', country: 'UAE' },
  { code: '+974', flag: '🇶🇦', country: 'Qatar' },
  { code: '+965', flag: '🇰🇼', country: 'Kuwait' },
  { code: '+973', flag: '🇧🇭', country: 'Bahrain' },
  { code: '+968', flag: '🇴🇲', country: 'Oman' },
  { code: '+20', flag: '🇪🇬', country: 'Egypt' },
  { code: '+962', flag: '🇯🇴', country: 'Jordan' },
  { code: '+961', flag: '🇱🇧', country: 'Lebanon' },
  { code: '+44', flag: '🇬🇧', country: 'UK' },
  { code: '+1', flag: '🇺🇸', country: 'US/Canada' },
  { code: '+33', flag: '🇫🇷', country: 'France' },
  { code: '+49', flag: '🇩🇪', country: 'Germany' },
  { code: '+41', flag: '🇨🇭', country: 'Switzerland' },
] as const;

const DEFAULT_CODE = '+966';
// Longest code first so "+1" doesn't shadow-match a number that actually starts with "+1..." belonging to a longer code sharing that prefix.
const SORTED_CODES = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);

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

  return (
    <div className="flex gap-2">
      <Select value={code} onValueChange={(newCode) => onChange(rest ? `${newCode} ${rest}` : newCode)}>
        <SelectTrigger className="w-[110px] shrink-0">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span>{COUNTRY_CODES.find((c) => c.code === code)?.flag}</span>
              <span className="font-mono text-sm">{code}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRY_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="flex items-center gap-2">
                <span>{c.flag}</span>
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
        onChange={(e) => onChange(`${code} ${e.target.value}`.trim())}
        placeholder={placeholder}
        className="flex-1"
      />
    </div>
  );
}

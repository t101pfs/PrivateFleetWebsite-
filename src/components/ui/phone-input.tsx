import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[110px] shrink-0 justify-between px-2 font-normal"
          >
            <span className="flex items-center gap-1.5 overflow-hidden">
              <span>{flagFromIso2(selected.iso2)}</span>
              <span className="font-mono text-sm truncate">{selected.code}</span>
            </span>
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country or code..." />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRY_CODES.map((c) => (
                  <CommandItem
                    key={c.iso2}
                    value={`${c.country} ${c.code}`}
                    onSelect={() => {
                      onChange(rest ? `${c.code} ${rest}` : c.code);
                      setOpen(false);
                    }}
                    className={cn(c.iso2 === selected.iso2 && 'bg-accent/50')}
                  >
                    <span className="flex items-center gap-2">
                      <span>{flagFromIso2(c.iso2)}</span>
                      <span className="font-mono text-sm w-12 shrink-0">{c.code}</span>
                      <span className="text-muted-foreground truncate">{c.country}</span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={rest}
        onChange={(e) => onChange(`${selected.code} ${e.target.value}`.trim())}
        placeholder={placeholder}
        className="flex-1 min-w-0"
      />
    </div>
  );
}

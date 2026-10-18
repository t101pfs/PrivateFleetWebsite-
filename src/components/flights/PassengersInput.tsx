import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

export interface PassengersValue {
  /** Always the top of whatever was typed - the number every capacity/
   * pricing calculation actually uses. */
  value: number;
  /** The original text, only set when it was actually a range ("6-8", "6
   * to 8") rather than a plain number - kept so it can be shown back
   * exactly as typed instead of silently collapsing to one number. */
  rangeText: string | null;
}

/** A plain number Input bound straight to a number value snaps back to that
 * number on every keystroke that makes it momentarily empty/invalid (typing
 * "" mid-edit resolves to NaN, `NaN || 1` forces it back to "1"), which makes
 * it impossible to clear the field and type a fresh number. This keeps its
 * own draft string while typing and only commits (or falls back to 1) once
 * the value is actually a valid positive number, or on blur.
 *
 * It's also plain text, not a native number input, so someone unsure of the
 * exact headcount can type a range like "6-8" or "6 to 8" - that text is
 * kept as-is (for display elsewhere) alongside the highest number in it
 * (what the aircraft actually has to fit), instead of collapsing to one
 * number the moment they finish typing. */
export function PassengersInput({ value, onChange }: { value: PassengersValue; onChange: (value: PassengersValue) => void }) {
  const [draft, setDraft] = useState(value.rangeText || String(value.value));

  useEffect(() => {
    setDraft(value.rangeText || String(value.value));
  }, [value.value, value.rangeText]);

  const parse = (text: string): PassengersValue | null => {
    const numbers = text.match(/\d+/g)?.map(Number) ?? [];
    if (numbers.length === 0) return null;
    const max = Math.max(...numbers);
    if (max < 1) return null;
    // Only a real range (more than one distinct number found) counts as
    // range text - "8" alone, or stray punctuation around a single number,
    // still resolves to a plain number with no range text kept.
    const isRange = new Set(numbers).size > 1;
    return { value: max, rangeText: isRange ? text.trim() : null };
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="e.g. 8 or 6-8"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => {
        const parsed = parse(draft);
        if (!parsed) {
          setDraft('1');
          onChange({ value: 1, rangeText: null });
        } else {
          setDraft(parsed.rangeText || String(parsed.value));
        }
      }}
    />
  );
}

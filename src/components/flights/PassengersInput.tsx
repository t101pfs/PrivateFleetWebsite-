import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

/** A plain number Input bound straight to a number value snaps back to that
 * number on every keystroke that makes it momentarily empty/invalid (typing
 * "" mid-edit resolves to NaN, `NaN || 1` forces it back to "1"), which makes
 * it impossible to clear the field and type a fresh number. This keeps its
 * own draft string while typing and only commits (or falls back to 1) once
 * the value is actually a valid positive number, or on blur.
 *
 * It's also plain text, not a native number input, so someone unsure of the
 * exact headcount can type a range like "6-8" or "6 to 8" - the highest
 * number in whatever was typed is what gets stored (the aircraft has to fit
 * the top of the range anyway), and the field settles back to that one
 * number once they move on. */
export function PassengersInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const highestNumberIn = (text: string): number | null => {
    const numbers = text.match(/\d+/g)?.map(Number) ?? [];
    return numbers.length > 0 ? Math.max(...numbers) : null;
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      placeholder="e.g. 8 or 6-8"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        const highest = highestNumberIn(e.target.value);
        if (highest !== null && highest > 0) onChange(highest);
      }}
      onBlur={() => {
        const highest = highestNumberIn(draft);
        if (highest === null || highest < 1) {
          setDraft('1');
          onChange(1);
        } else {
          setDraft(String(highest));
        }
      }}
    />
  );
}

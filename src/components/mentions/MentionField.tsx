import { useRef, useState, KeyboardEvent } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface MentionCandidate {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface ActiveMention {
  start: number;
  query: string;
}

interface MentionFieldProps {
  value: string;
  onChange: (value: string) => void;
  candidates: MentionCandidate[];
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
}

function candidateName(c: MentionCandidate): string {
  return c.full_name || c.email || 'User';
}

function getActiveMention(text: string, cursorPos: number): ActiveMention | null {
  const upToCursor = text.slice(0, cursorPos);
  const atIndex = upToCursor.lastIndexOf('@');
  if (atIndex === -1) return null;
  const between = upToCursor.slice(atIndex + 1);
  if (/\s/.test(between)) return null;
  return { start: atIndex, query: between };
}

export function MentionField({
  value,
  onChange,
  candidates,
  multiline = true,
  rows = 3,
  placeholder,
  className,
  disabled,
  onKeyDown,
}: MentionFieldProps) {
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = activeMention
    ? candidates
        .filter((c) => candidateName(c).toLowerCase().includes(activeMention.query.toLowerCase()))
        .slice(0, 6)
    : [];
  const isOpen = !!activeMention && matches.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    onChange(e.target.value);
    const cursorPos = e.target.selectionStart ?? e.target.value.length;
    setActiveMention(getActiveMention(e.target.value, cursorPos));
    setActiveIndex(0);
  };

  const selectCandidate = (candidate: MentionCandidate) => {
    if (!activeMention || !fieldRef.current) return;
    const name = candidateName(candidate);
    const cursorPos = fieldRef.current.selectionStart ?? value.length;
    const before = value.slice(0, activeMention.start);
    const after = value.slice(cursorPos);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setActiveMention(null);
    requestAnimationFrame(() => {
      const pos = before.length + name.length + 2;
      fieldRef.current?.setSelectionRange(pos, pos);
      fieldRef.current?.focus();
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement & HTMLInputElement>) => {
    if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectCandidate(matches[activeIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveMention(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div className="relative">
      {multiline ? (
        <Textarea
          ref={fieldRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
          rows={rows}
        />
      ) : (
        <Input
          ref={fieldRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
        />
      )}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full max-w-xs rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {matches.map((c, i) => (
            <button
              key={c.user_id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                selectCandidate(c);
              }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center justify-between',
                i === activeIndex ? 'bg-secondary/70' : 'hover:bg-secondary/50'
              )}
            >
              <span>{candidateName(c)}</span>
              {c.full_name && c.email && <span className="text-xs text-muted-foreground">{c.email}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

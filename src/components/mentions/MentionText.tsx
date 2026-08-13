import { Fragment } from 'react';
import type { MentionCandidate } from './MentionField';

interface MentionTextProps {
  text: string;
  candidates: MentionCandidate[];
}

/** Renders text with "@Full Name" substrings (matching known candidates) highlighted. */
export function MentionText({ text, candidates }: MentionTextProps) {
  const names = candidates
    .map((c) => c.full_name || c.email)
    .filter((n): n is string => !!n)
    .sort((a, b) => b.length - a.length);

  if (names.length === 0 || !text) return <>{text}</>;

  const pattern = new RegExp(`@(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const parts: Array<{ text: string; isMention: boolean }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index), isMention: false });
    parts.push({ text: match[0], isMention: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), isMention: false });

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part.isMention ? (
            <span className="font-medium text-primary bg-primary/10 rounded px-1">{part.text}</span>
          ) : (
            part.text
          )}
        </Fragment>
      ))}
    </>
  );
}

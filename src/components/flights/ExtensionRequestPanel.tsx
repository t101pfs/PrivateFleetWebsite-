import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Hourglass, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DeadlineExtensionRow } from '@/hooks/useDeadlineExtensions';

interface ExtensionRequestPanelProps {
  windowLabel: string;
  /** Whoever owns this stage can ask; everyone else just sees the status. */
  canRequest: boolean;
  ownerLabel: string;
  pending: DeadlineExtensionRow | null;
  lastDecline: DeadlineExtensionRow | null;
  isRequesting: boolean;
  onRequest: (reason: string) => void;
  /** False while the window is still running — shows a small, low-key
   * "ask for more time" trigger instead of the red "window has passed"
   * card, so the stage owner can get ahead of a deadline they can see
   * they won't make, rather than only being offered this after failing. */
  late?: boolean;
}

/** Once a stage's window has passed, this replaces its normal action —
 * the way forward is asking an Admin for more time, not a late upload.
 * Before that, pass `late={false}` to show a compact, optional prompt
 * alongside the stage's normal action instead. */
export function ExtensionRequestPanel({
  windowLabel,
  canRequest,
  ownerLabel,
  pending,
  lastDecline,
  isRequesting,
  onRequest,
  late = true,
}: ExtensionRequestPanelProps) {
  const [reason, setReason] = useState('');
  const [expanded, setExpanded] = useState(false);

  if (pending) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/10 p-3 space-y-1">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Hourglass className="h-3.5 w-3.5 text-warning" />
          Extension requested {formatDistanceToNow(new Date(pending.requested_at), { addSuffix: true })} — waiting for an Admin
        </p>
        <p className="text-xs text-muted-foreground">"{pending.reason}"</p>
      </div>
    );
  }

  if (!late) {
    if (!canRequest) return null;
    if (!expanded) {
      return (
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setExpanded(true)}>
          <Clock className="h-3.5 w-3.5 mr-1.5" />
          Won't make it in time? Ask for more time
        </Button>
      );
    }
    return (
      <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Ask an Admin for more time on the {windowLabel} window before it runs out.</p>
        {lastDecline && (
          <p className="text-xs text-muted-foreground">
            Last request was declined{lastDecline.decision_notes ? `: "${lastDecline.decision_notes}"` : '.'}
          </p>
        )}
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why do you need more time?"
          rows={2}
          className="text-sm"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              onRequest(reason);
              setReason('');
              setExpanded(false);
            }}
            disabled={!reason.trim() || isRequesting}
          >
            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Request Extension
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-2">
      <p className="text-xs text-destructive font-medium">
        The {windowLabel} window has passed. {canRequest ? 'Ask an Admin for more time to continue.' : `Waiting on ${ownerLabel} to request an extension.`}
      </p>
      {lastDecline && (
        <p className="text-xs text-muted-foreground">
          Last request was declined{lastDecline.decision_notes ? `: "${lastDecline.decision_notes}"` : '.'}
        </p>
      )}
      {canRequest && (
        <>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why do you need more time?"
            rows={2}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={() => {
              onRequest(reason);
              setReason('');
            }}
            disabled={!reason.trim() || isRequesting}
          >
            {isRequesting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Request Extension
          </Button>
        </>
      )}
    </div>
  );
}

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Hourglass } from 'lucide-react';
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
}

/** Shown in place of a stage's normal action once its window has passed —
 * the way forward is asking an Admin for more time, not a late upload. */
export function ExtensionRequestPanel({
  windowLabel,
  canRequest,
  ownerLabel,
  pending,
  lastDecline,
  isRequesting,
  onRequest,
}: ExtensionRequestPanelProps) {
  const [reason, setReason] = useState('');

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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const RULES: Array<{ stage: string; rule: string }> = [
  {
    stage: 'Accept',
    rule: 'Operations has 10 minutes to accept a request after Sales submits it. If nobody accepts, the request is locked for Operations and goes to the on-call Admin (see the shift schedule) to assign.',
  },
  {
    stage: 'Sourcing',
    rule: 'A separate 60-minute clock starts when Operations accepts. The first published option meets it. Drafts don’t count, and nothing can be added before the request is accepted.',
  },
  {
    stage: 'Client confirmation',
    rule: '60 minutes from when the quotation is issued. While it is running, Sales can extend it one hour at a time, with a comment each time; Operations is told to keep the aircraft on hold.',
  },
  {
    stage: 'Availability check',
    rule: 'After the client confirms, Operations confirms the aircraft with the operator (final price compared with the quote) or reports it unavailable. There is no timer on this step.',
  },
  {
    stage: 'Client Contract',
    rule: '30 minutes from when Operations confirms availability. It stays locked until then, and while a client discount is waiting for an Admin to decide.',
  },
  {
    stage: 'Operator Contract',
    rule: '30 minutes after the Client Contract is uploaded. The Admin can only sign once the client’s proof of payment is in: they download it, sign it, and upload the signed copy.',
  },
  {
    stage: 'Missed a window',
    rule: 'Ask an Admin for more time with a reason. An approval gives N minutes from the moment it is approved.',
  },
  {
    stage: 'After the flight',
    rule: 'Operator feedback (Operations) and client feedback (Sales) are due 3 days after the flight. Whoever is missing it is warned daily by notification and email.',
  },
];

/** Read-only summary of how the workflow timers behave, so it lives with the
 * other admin settings instead of being repeated on every flight. */
export function WorkflowTimersCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How the workflow timers work</CardTitle>
        <CardDescription>What each clock is, when it starts, and what happens when it runs out.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y">
          {RULES.map((r) => (
            <div key={r.stage} className="grid gap-1 sm:grid-cols-[11rem_1fr] py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-semibold">{r.stage}</dt>
              <dd className="text-sm text-muted-foreground">{r.rule}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

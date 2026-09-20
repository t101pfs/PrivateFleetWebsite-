import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export type FeedbackKind = 'operator' | 'client';

const COPY: Record<FeedbackKind, { title: string; prompt: string; visibility: string }> = {
  operator: {
    title: 'Operator Feedback',
    prompt: 'How did the operator and aircraft perform on this flight?',
    visibility: 'Only Operations and Admins can see this.',
  },
  client: {
    title: 'Client Feedback',
    prompt: 'What did the client think of the flight and the service?',
    visibility: 'Only Sales and Admins can see this.',
  },
};

interface FlightFeedbackCardProps {
  flightId: string;
  kind: FeedbackKind;
}

/** Feedback owed after a flight: Operations rates the operator, Sales
 * records the client's view. Due 3 days after the flight; the overdue
 * warnings themselves are sent by the daily background job. */
export function FlightFeedbackCard({ flightId, kind }: FlightFeedbackCardProps) {
  const { supabaseUser } = useAuth();
  const queryClient = useQueryClient();
  const copy = COPY[kind];
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [editing, setEditing] = useState(false);

  const { data: feedback, isLoading } = useQuery({
    queryKey: ['flight-feedback', flightId, kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_feedback')
        .select('id, rating, comments, submitted_by, submitted_at')
        .eq('flight_id', flightId)
        .eq('kind', kind)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: flight } = useQuery({
    queryKey: ['flight-feedback-flight', flightId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flight_requests')
        .select('departure_date, departure_time, flight_legs')
        .eq('id', flightId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (feedback) {
      setRating(feedback.rating);
      setComments(feedback.comments || '');
    }
  }, [feedback]);

  // Mirrors the server's rule: 3 days after the last leg, at departure time (Riyadh).
  let dueLabel = '';
  let overdue = false;
  if (flight) {
    const legs = Array.isArray(flight.flight_legs) ? (flight.flight_legs as Array<Record<string, string>>) : [];
    const legDates = legs.map((l) => l.date || l.departure_date).filter(Boolean).sort();
    const lastDate = legDates.length > 0 && legDates[legDates.length - 1] > flight.departure_date
      ? legDates[legDates.length - 1]
      : flight.departure_date;
    const due = addDays(parseISO(lastDate), 3);
    dueLabel = format(due, 'MMM d, yyyy');
    overdue = !feedback && new Date() > new Date(`${format(due, 'yyyy-MM-dd')}T${flight.departure_time || '00:00:00'}+03:00`);
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!supabaseUser) throw new Error('Not authenticated');
      if (rating < 1) throw new Error('Pick a rating from 1 to 5 stars');
      const { error } = await supabase.from('flight_feedback').upsert(
        {
          flight_id: flightId,
          kind,
          rating,
          comments: comments.trim() || null,
          submitted_by: supabaseUser.id,
        },
        { onConflict: 'flight_id,kind' }
      );
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: supabaseUser.id,
        action: 'flight_feedback_submitted',
        entity_type: 'flight_request',
        entity_id: flightId,
        details: { kind },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flight-feedback', flightId, kind] });
      queryClient.invalidateQueries({ queryKey: ['flight-feedback-exists', flightId, kind] });
      setEditing(false);
      toast.success(`${copy.title} saved`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;

  const showForm = !feedback || editing;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{copy.prompt} {copy.visibility}</p>
          </div>
          {feedback ? (
            <Badge variant="secondary" className="bg-success/10 text-success font-normal gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Submitted
            </Badge>
          ) : dueLabel ? (
            <Badge variant="secondary" className={cn('font-normal', overdue ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
              {overdue ? `Overdue — was due ${dueLabel}` : `Due by ${dueLabel}`}
            </Badge>
          ) : null}
        </div>

        {showForm ? (
          <div className="space-y-3">
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  onClick={() => setRating(n)}
                  className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star className={cn('h-6 w-6', n <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/40')} />
                </button>
              ))}
              {rating > 0 && <span className="text-sm text-muted-foreground ml-2">{rating} / 5</span>}
            </div>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Comments (optional)"
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submit.mutate()} disabled={rating < 1 || submit.isPending}>
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                {feedback ? 'Save Changes' : 'Submit Feedback'}
              </Button>
              {feedback && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setRating(feedback.rating);
                    setComments(feedback.comments || '');
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : feedback ? (
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={cn('h-5 w-5', n <= feedback.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')} />
              ))}
              <span className="text-sm text-muted-foreground ml-2">{feedback.rating} / 5</span>
            </div>
            {feedback.comments && <p className="text-sm whitespace-pre-wrap">{feedback.comments}</p>}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Submitted {format(new Date(feedback.submitted_at), 'MMM d, yyyy h:mm a')}</span>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>Edit</Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Supabase/Postgres errors reach the UI as thrown objects whose `.message`
 * is written for a database administrator, not a charter-ops user ("duplicate
 * key value violates unique constraint \"flight_options_pkey\"", "new row
 * violates row-level security policy for table \"flights\""). This maps the
 * common, generic failure classes (by Postgres/PostgREST error code first,
 * then by a few unmistakable message patterns) to plain English, and only
 * falls through to the raw message when it already reads like something a
 * person wrote on purpose (our own `throw new Error('...')` validation
 * messages elsewhere in the app) rather than something Postgres generated.
 */

const CODE_MESSAGES: Record<string, string> = {
  '23505': 'That already exists — check for a duplicate.',
  '23503': "That's linked to other records, so this can't be done right now.",
  '23502': 'A required field is missing.',
  '22P02': "That input wasn't valid - double check what you entered.",
  '42501': "You don't have permission to do that.",
  PGRST116: "Couldn't find that record — it may have been deleted.",
  PGRST301: 'Your session has expired — please sign in again.',
};

// Telltale signs the message came straight from Postgres/PostgREST rather
// than from our own code - these never get shown to the user as-is.
const RAW_DB_PATTERNS = [
  /violates .* constraint/i,
  /duplicate key value/i,
  /relation ".*" does not exist/i,
  /column ".*" does not exist/i,
  /permission denied for/i,
  /row-level security/i,
  /syntax error at or near/i,
  /invalid input syntax/i,
  /JWT/i,
];

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  if (typeof error === 'string') return error;
  return undefined;
}

/** A network failure (offline, DNS, CORS, server unreachable) - never a Postgres error. */
function isNetworkError(error: unknown): boolean {
  const message = getErrorMessage(error) || '';
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}

export function friendlyError(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return "Couldn't reach the server — check your connection and try again.";
  }

  const code = getErrorCode(error);
  if (code && CODE_MESSAGES[code]) {
    return CODE_MESSAGES[code];
  }

  const message = getErrorMessage(error);
  if (!message) return fallback;
  if (RAW_DB_PATTERNS.some((pattern) => pattern.test(message))) {
    return fallback;
  }
  return message;
}

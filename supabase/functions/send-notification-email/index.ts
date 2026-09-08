// Called by a Postgres trigger (notifications_send_email, see migration
// 20260908120000) every time a row is inserted into `notifications`.
// Not a user-facing endpoint - deployed with --no-verify-jwt, and instead
// gated on a shared secret set in Supabase Vault + this function's env.
//
// RESEND_API_KEY / NOTIFICATIONS_FROM_EMAIL are not set yet as of this
// deploy - until they are (via `supabase secrets set`), this function
// receives calls and no-ops (logs + returns 200) so nothing breaks.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface EmailPayload {
  to: string
  title: string
  message: string
  type: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedSecret = Deno.env.get('NOTIFICATIONS_WEBHOOK_SECRET')
  const providedSecret = req.headers.get('x-webhook-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: EmailPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { to, title, message } = payload
  if (!to || !title || !message) {
    return json({ error: 'Missing to/title/message' }, 400)
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('NOTIFICATIONS_FROM_EMAIL')

  if (!resendApiKey || !fromEmail) {
    console.log('Email not sent (Resend not configured yet):', title, '->', to)
    return json({ skipped: true, reason: 'RESEND_API_KEY or NOTIFICATIONS_FROM_EMAIL not set' })
  }

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: title,
      text: `${message}\n\n— Private Fleet`,
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    console.error('Resend send failed:', resendRes.status, errText)
    return json({ error: 'Resend send failed', detail: errText }, 502)
  }

  return json({ success: true })
})

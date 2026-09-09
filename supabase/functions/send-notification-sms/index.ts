// Called by a Postgres trigger (notifications_send_sms, see migration
// 20260909120000) whenever a breach/overdue notification is inserted.
// Not a user-facing endpoint - deployed with --no-verify-jwt, gated on
// the same shared secret as send-notification-email.
//
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are not set
// yet as of this deploy - until they are, this function receives calls
// and no-ops (logs + returns 200) so nothing breaks.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface SmsPayload {
  to: string
  title: string
  message: string
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

  let payload: SmsPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { to, title, message } = payload
  if (!to || !title || !message) {
    return json({ error: 'Missing to/title/message' }, 400)
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!accountSid || !authToken || !fromNumber) {
    console.log('SMS not sent (Twilio not configured yet):', title, '->', to)
    return json({ skipped: true, reason: 'Twilio secrets not set' })
  }

  const body = new URLSearchParams({
    To: to,
    From: fromNumber,
    Body: `${title}: ${message}`,
  })

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
  )

  if (!twilioRes.ok) {
    const errText = await twilioRes.text()
    console.error('Twilio send failed:', twilioRes.status, errText)
    return json({ error: 'Twilio send failed', detail: errText }, 502)
  }

  return json({ success: true })
})

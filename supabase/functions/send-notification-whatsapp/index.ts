// Called by a Postgres trigger (notifications_send_whatsapp, see
// migration 20260915140000) whenever a notification is inserted (same
// breadth as email - everything except chat_message). Not a user-facing
// endpoint - deployed with --no-verify-jwt, gated on the same shared
// secret as send-notification-email/sms.
//
// Every notification here is business-initiated (the user didn't just
// message us), so WhatsApp requires a pre-approved Content Template
// rather than freeform text - TWILIO_WHATSAPP_CONTENT_SID is the
// "pfs_notification_alert" template (two variables: title, message),
// submitted for WhatsApp approval 2026-09-16. If it's unset or not yet
// approved, Twilio rejects the send and this function reports that
// error rather than silently no-op'ing, so a still-pending approval is
// visible in logs rather than looking like silent success.
//
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM missing
// means this function receives calls and no-ops (logs + returns 200) so
// nothing breaks.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface WhatsAppPayload {
  to: string
  title: string
  message: string
  flight_id?: string | null
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

  let payload: WhatsAppPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { to, title, flight_id } = payload
  let { message } = payload
  if (!to || !title || !message) {
    return json({ error: 'Missing to/title/message' }, 400)
  }

  // WhatsApp auto-links any https:// URL in the message body - no template
  // change or re-approval needed, since the link lives in the variable
  // content, not the approved template text itself.
  const appBaseUrl = Deno.env.get('APP_BASE_URL')
  if (flight_id && appBaseUrl) {
    message = `${message}\n\n${appBaseUrl}/flights/${flight_id}`
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const contentSid = Deno.env.get('TWILIO_WHATSAPP_CONTENT_SID')

  if (!accountSid || !authToken || !fromNumber) {
    console.log('WhatsApp message not sent (Twilio not configured yet):', title, '->', to)
    return json({ skipped: true, reason: 'Twilio secrets not set' })
  }

  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  const body = contentSid
    ? new URLSearchParams({
        To: toWhatsApp,
        From: fromNumber,
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({ '1': title, '2': message }),
      })
    : new URLSearchParams({
        To: toWhatsApp,
        From: fromNumber,
        Body: `*${title}*\n${message}`,
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
    console.error('Twilio WhatsApp send failed:', twilioRes.status, errText)
    return json({ error: 'Twilio WhatsApp send failed', detail: errText }, 502)
  }

  return json({ success: true })
})

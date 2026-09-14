// Called by a Postgres trigger (notifications_send_whatsapp, see
// migration 20260915140000) whenever a notification is inserted (same
// breadth as email - everything except chat_message). Not a user-facing
// endpoint - deployed with --no-verify-jwt, gated on the same shared
// secret as send-notification-email/sms.
//
// Currently targets Twilio's WhatsApp Sandbox (TWILIO_WHATSAPP_FROM is
// the sandbox number) - only phone numbers that have joined the sandbox
// on their own phone will actually receive anything. Swapping to a real
// approved WhatsApp sender later is just a TWILIO_WHATSAPP_FROM change,
// no code change needed.
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

  const { to, title, message } = payload
  if (!to || !title || !message) {
    return json({ error: 'Missing to/title/message' }, 400)
  }

  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
  const fromNumber = Deno.env.get('TWILIO_WHATSAPP_FROM')

  if (!accountSid || !authToken || !fromNumber) {
    console.log('WhatsApp message not sent (Twilio not configured yet):', title, '->', to)
    return json({ skipped: true, reason: 'Twilio secrets not set' })
  }

  const toWhatsApp = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`

  const body = new URLSearchParams({
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

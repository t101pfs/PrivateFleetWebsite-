// Called by a Postgres trigger (notifications_send_push, see migration
// 20261102100000) every time a row is inserted into `notifications`.
// Not a user-facing endpoint - deployed with --no-verify-jwt, and instead
// gated on a shared secret set in Supabase Vault + this function's env
// (same NOTIFICATIONS_WEBHOOK_SECRET the email/WhatsApp functions use).
//
// Sends real phone push notifications via Firebase Cloud Messaging's HTTP
// v1 API. That API needs an OAuth2 access token minted from a Firebase
// service account (not a simple server key like the old legacy FCM API,
// which Google has since shut down), so this function signs its own
// service-account JWT with the Web Crypto API and exchanges it for a token
// on every call.
//
// FIREBASE_SERVICE_ACCOUNT_JSON is not set yet as of this deploy - until it
// is (via `supabase secrets set` or the Dashboard), this function receives
// calls and no-ops (logs + returns 200) so nothing breaks.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

interface PushPayload {
  tokens: string[]
  title: string
  message: string
  type: string
  flight_id?: string | null
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
  let str = ''
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  return data.access_token as string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const expectedSecret = Deno.env.get('NOTIFICATIONS_WEBHOOK_SECRET')
  const providedSecret = req.headers.get('x-webhook-secret')
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let payload: PushPayload
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { tokens, title, message, type, flight_id } = payload
  if (!tokens || tokens.length === 0 || !title || !message) {
    return json({ error: 'Missing tokens/title/message' }, 400)
  }

  const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')
  if (!serviceAccountJson) {
    console.log('Push not sent (Firebase not configured yet):', title, '->', tokens.length, 'device(s)')
    return json({ skipped: true, reason: 'FIREBASE_SERVICE_ACCOUNT_JSON not set' })
  }

  let serviceAccount: { client_email: string; private_key: string; project_id: string }
  try {
    serviceAccount = JSON.parse(serviceAccountJson)
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON')
    return json({ error: 'Invalid FIREBASE_SERVICE_ACCOUNT_JSON' }, 500)
  }

  let accessToken: string
  try {
    accessToken = await getAccessToken(serviceAccount)
  } catch (err) {
    console.error('Firebase token exchange failed:', err)
    return json({ error: 'Firebase auth failed' }, 502)
  }

  const results = await Promise.all(
    tokens.map(async (token) => {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body: message },
              data: { type, flight_id: flight_id ?? '' },
              android: { priority: 'high' },
            },
          }),
        }
      )
      if (!res.ok) {
        const errText = await res.text()
        console.error('FCM send failed for a token:', res.status, errText)
        return { token, ok: false }
      }
      return { token, ok: true }
    })
  )

  return json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length })
})

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const results: { email: string; ok: boolean; error?: string }[] = []
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    for (const u of data.users) {
      const { error: uErr } = await admin.auth.admin.updateUserById(u.id, { password: '12345678' })
      results.push({ email: u.email ?? u.id, ok: !uErr, error: uErr?.message })
    }
    if (data.users.length < perPage) break
    page++
  }

  return new Response(JSON.stringify({ count: results.length, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

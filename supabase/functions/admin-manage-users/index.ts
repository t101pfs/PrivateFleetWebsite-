import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

type Role = 'sales' | 'operations' | 'admin' | 'super_admin'

interface CreatePayload {
  action: 'create'
  email: string
  password: string
  full_name: string
  role: Role
}

interface DeletePayload {
  action: 'delete'
  targetUserId: string
}

type Payload = CreatePayload | DeletePayload

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Identify the caller from their own JWT, then look up their role with the
  // service-role client (avoids relying on RLS for this check).
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: callerData, error: callerError } = await callerClient.auth.getUser()
  if (callerError || !callerData.user) return json({ error: 'Invalid session' }, 401)
  const callerId = callerData.user.id

  const { data: callerRoleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', callerId)
    .maybeSingle()
  const callerRole = callerRoleRow?.role as Role | undefined
  const callerIsAdmin = callerRole === 'admin' || callerRole === 'super_admin'
  const callerIsSuperAdmin = callerRole === 'super_admin'

  if (!callerIsAdmin) return json({ error: 'Admin access required' }, 403)

  const payload = (await req.json()) as Payload

  if (payload.action === 'create') {
    const { email, password, full_name, role } = payload
    if (!email || !password || !full_name || !role) {
      return json({ error: 'Missing required fields' }, 400)
    }
    if ((role === 'admin' || role === 'super_admin') && !callerIsSuperAdmin) {
      return json({ error: 'Only super_admin can assign admin or super_admin roles' }, 403)
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createError || !created.user) {
      return json({ error: createError?.message || 'Failed to create user' }, 500)
    }

    const newUserId = created.user.id

    // handle_new_user trigger already created the profile + default 'sales' role.
    const { error: profileError } = await admin
      .from('profiles')
      .update({ must_change_password: true, full_name })
      .eq('user_id', newUserId)
    if (profileError) console.error('Failed to update profile:', profileError.message)

    if (role !== 'sales') {
      const { error: roleError } = await admin
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUserId)
      if (roleError) console.error('Failed to set role:', roleError.message)
    }

    return json({ success: true, userId: newUserId })
  }

  if (payload.action === 'delete') {
    if (!callerIsSuperAdmin) return json({ error: 'Only super_admin can delete users' }, 403)
    const { targetUserId } = payload
    if (!targetUserId) return json({ error: 'Missing targetUserId' }, 400)
    if (targetUserId === callerId) return json({ error: 'Cannot delete your own account' }, 400)

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId)
    if (deleteError) return json({ error: deleteError.message }, 500)

    return json({ success: true })
  }

  return json({ error: 'Unknown action' }, 400)
})

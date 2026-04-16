// Edge Function: invite-user (LIT-65).
//
// POST /functions/v1/invite-user
// Body: { email: string, full_name?: string, role: 'admin' | 'ventas' }
//
// Authenticates the caller via the bearer token, confirms they have
// role='admin' in public.profiles, then calls supabase.auth.admin
// .inviteUserByEmail with the service-role key. The handle_new_user
// trigger creates the profile with the default ventas role; if the
// caller requested admin, this function bumps the role afterward.
//
// All errors are typed as { error: <code>, message: string } so the
// client can map them to localized toasts.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

interface InviteBody {
  email?: string
  full_name?: string | null
  role?: string
}

type InviteErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_payload'
  | 'invalid_email'
  | 'invalid_role'
  | 'already_invited'
  | 'rate_limited'
  | 'partial_role_update'
  | 'unknown'

interface InviteErrorBody {
  error: InviteErrorCode
  message: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonError({ error: 'invalid_payload', message: 'POST required' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonError(
      { error: 'unknown', message: 'Edge Function misconfigured: missing Supabase env vars' },
      500
    )
  }

  // Authenticate the caller using the bearer token they sent in.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonError({ error: 'unauthorized', message: 'Missing Authorization header' }, 401)
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userErr } = await callerClient.auth.getUser()
  if (userErr || !userData?.user) {
    return jsonError({ error: 'unauthorized', message: 'Invalid session' }, 401)
  }

  const { data: profile, error: profileErr } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileErr) {
    return jsonError({ error: 'unknown', message: profileErr.message }, 500)
  }
  if (profile?.role !== 'admin') {
    return jsonError({ error: 'forbidden', message: 'Solo administración puede invitar' }, 403)
  }

  let body: InviteBody
  try {
    body = (await req.json()) as InviteBody
  } catch {
    return jsonError({ error: 'invalid_payload', message: 'Cuerpo JSON inválido' }, 400)
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const fullName = body.full_name?.trim() || null
  const role = body.role

  if (!email || !EMAIL_RE.test(email)) {
    return jsonError({ error: 'invalid_email', message: 'Correo inválido' }, 400)
  }
  if (role !== 'admin' && role !== 'ventas') {
    return jsonError({ error: 'invalid_role', message: 'Rol inválido' }, 400)
  }

  // Resolve the app URL embedded in the invite email.
  //
  // APP_BASE_URL is a per-project Supabase secret pointing at the
  // canonical app for this environment (staging URL on staging
  // Supabase, prod URL on prod). We prefer it over the request Origin
  // because the caller's browser shouldn't decide where the recipient
  // lands — an admin inviting from localhost dev would otherwise embed
  // an unreachable URL in the email (LIT-76).
  //
  // Fallback to Origin keeps `supabase functions serve` against a local
  // app working out of the box, with no secret configured.
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? '').replace(/\/+$/, '')
  const origin = req.headers.get('origin')
  const redirectBase = appBaseUrl || origin
  const redirectTo = redirectBase ? `${redirectBase}/auth/update-password?flow=invite` : undefined

  const adminClient: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const inviteMeta: Record<string, unknown> = {}
  if (fullName) inviteMeta.full_name = fullName

  const { data: invitedData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { data: inviteMeta, redirectTo }
  )

  if (inviteErr) {
    const lower = (inviteErr.message ?? '').toLowerCase()
    if (lower.includes('rate') || lower.includes('limit')) {
      return jsonError({ error: 'rate_limited', message: inviteErr.message }, 429)
    }
    if (lower.includes('already') || lower.includes('exists') || lower.includes('registered')) {
      return jsonError({ error: 'already_invited', message: inviteErr.message }, 409)
    }
    return jsonError({ error: 'unknown', message: inviteErr.message }, 500)
  }

  // The handle_new_user trigger has already created the profile with
  // role='ventas'. Bump to admin if requested.
  if (role === 'admin' && invitedData?.user) {
    const { error: roleErr } = await adminClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', invitedData.user.id)

    if (roleErr) {
      return jsonError(
        {
          error: 'partial_role_update',
          message: `Invitación enviada, pero no se pudo asignar el rol de admin: ${roleErr.message}`,
        },
        207
      )
    }
  }

  return new Response(
    JSON.stringify({
      user: {
        id: invitedData?.user?.id ?? null,
        email: invitedData?.user?.email ?? email,
        role,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } }
  )
})

function jsonError(payload: InviteErrorBody, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

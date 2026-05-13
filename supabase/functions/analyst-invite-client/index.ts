import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface InviteBody {
  email: string;
  display_name?: string;
  organization?: string;
  countries?: string[];
  regions?: string[];
  services?: string[];
  welcome_note?: string;
  redirect_to?: string;
}

const DEFAULT_SERVICES = ['intel_feed', 'alerts', 'briefings', 'travel', 'bespoke'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: 'Invalid session' }, 401);
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Caller must be analyst or super_admin
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);
    const allowed = (roles ?? []).some((r: any) => r.role === 'analyst' || r.role === 'super_admin');
    if (!allowed) return json({ error: 'Forbidden: analyst access required' }, 403);

    const body = (await req.json()) as InviteBody;
    if (!body?.email) return json({ error: 'email is required' }, 400);

    const services = body.services?.length ? body.services : DEFAULT_SERVICES;

    // Try invite (creates user + sends magic link). If exists, fall back to lookup.
    let userId: string | null = null;
    let alreadyExisted = false;
    let inviteLink: string | null = null;

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      body.email,
      {
        data: {
          display_name: body.display_name ?? null,
          organization: body.organization ?? null,
          welcome_note: body.welcome_note ?? null,
        },
        redirectTo: body.redirect_to,
      },
    );

    if (invited?.user) {
      userId = invited.user.id;
    } else {
      // Lookup existing user
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users.find((u) => u.email?.toLowerCase() === body.email.toLowerCase());
      if (!found) return json({ error: inviteErr?.message ?? 'Invite failed' }, 400);
      userId = found.id;
      alreadyExisted = true;

      // Generate a magic link they can use to sign in
      const { data: link } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: body.email,
        options: { redirectTo: body.redirect_to },
      });
      inviteLink = link?.properties?.action_link ?? null;
    }

    // Ensure profile row exists with display_name
    if (body.display_name) {
      await admin.from('profiles').upsert(
        { user_id: userId, display_name: body.display_name },
        { onConflict: 'user_id' },
      );
    }

    // Replace any existing role with 'client'
    await admin.from('user_roles').delete().eq('user_id', userId);
    await admin.from('user_roles').insert({ user_id: userId, role: 'client' });

    // Upsert assignment
    const { error: assignErr } = await admin.from('client_assignments').upsert(
      {
        client_user_id: userId,
        analyst_user_id: callerId,
        countries: body.countries ?? [],
        regions: body.regions ?? [],
        services,
        is_active: true,
      },
      { onConflict: 'client_user_id' },
    );
    if (assignErr) return json({ error: assignErr.message }, 400);

    return json({ ok: true, user_id: userId, already_existed: alreadyExisted, invite_link: inviteLink });
  } catch (e) {
    console.error('analyst-invite-client error', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AppRole = 'analyst' | 'client' | 'super_admin';

interface InviteBody {
  email: string;
  role: AppRole;
  display_name?: string;
  // Only used when role === 'client'
  countries?: string[];
  regions?: string[];
  services?: string[];
}

const ALLOWED_ROLES: AppRole[] = ['analyst', 'client', 'super_admin'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    // Verify caller is a super_admin using their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: 'Invalid session' }, 401);
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleRow) {
      return json({ error: 'Forbidden: super_admin only' }, 403);
    }

    const body = (await req.json()) as InviteBody;
    if (!body?.email || !body?.role) {
      return json({ error: 'email and role are required' }, 400);
    }
    if (!ALLOWED_ROLES.includes(body.role)) {
      return json({ error: 'Invalid role' }, 400);
    }

    // Send Supabase magic-link invite. Creates auth user if not present.
    const { data: invited, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(body.email, {
        data: { display_name: body.display_name ?? null },
      });

    if (inviteErr || !invited?.user) {
      // If the user already exists, fetch them to assign role/assignment anyway
      const { data: existing } = await admin.auth.admin.listUsers();
      const found = existing?.users.find(
        (u) => u.email?.toLowerCase() === body.email.toLowerCase(),
      );
      if (!found) {
        return json({ error: inviteErr?.message ?? 'Invite failed' }, 400);
      }
      await upsertRoleAndAssignment(admin, found.id, body);
      return json({ ok: true, user_id: found.id, already_existed: true });
    }

    await upsertRoleAndAssignment(admin, invited.user.id, body, callerId);
    return json({ ok: true, user_id: invited.user.id });
  } catch (e) {
    console.error('admin-invite-user error', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json({ error: msg }, 500);
  }
});

async function upsertRoleAndAssignment(
  admin: ReturnType<typeof createClient>,
  userId: string,
  body: InviteBody,
  callerId?: string,
) {
  // The handle_new_user trigger inserts a default 'analyst' role on signup.
  // For invited users, replace it with the requested role.
  await admin.from('user_roles').delete().eq('user_id', userId);
  await admin.from('user_roles').insert({ user_id: userId, role: body.role });

  if (body.role === 'client') {
    await admin.from('client_assignments').upsert(
      {
        client_user_id: userId,
        analyst_user_id: callerId ?? userId,
        countries: body.countries ?? [],
        regions: body.regions ?? [],
        services:
          body.services ?? [
            'intel_feed',
            'alerts',
            'briefings',
            'travel',
            'bespoke',
          ],
        is_active: true,
      },
      { onConflict: 'client_user_id' },
    );
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
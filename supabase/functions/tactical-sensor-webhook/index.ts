// Tactical sensor webhook — accepts alerts from external CCTV / IoT / badge /
// panic / perimeter systems and inserts them into tactical_sensor_alerts for
// the target user. Authenticated via a shared secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SensorKind = "camera" | "motion" | "perimeter" | "badge" | "panic" | "environmental" | "vehicle" | "door" | "other";
type Severity = "low" | "medium" | "high" | "critical";

interface Payload {
  user_id: string;
  source_kind?: SensorKind;
  device_id?: string;
  device_name?: string;
  severity?: Severity;
  message: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  occurred_at?: string;
  raw?: Record<string, unknown>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_KINDS: SensorKind[] = ["camera","motion","perimeter","badge","panic","environmental","vehicle","door","other"];
const ALLOWED_SEV: Severity[] = ["low","medium","high","critical"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sharedSecret = Deno.env.get("TACTICAL_WEBHOOK_SECRET") || "";

  // Auth — accept either a shared webhook secret OR a logged-in analyst's JWT.
  const headerSecret = (req.headers.get("x-webhook-secret") || "").trim();
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  let authorized = false;
  if (sharedSecret && headerSecret && headerSecret === sharedSecret) {
    authorized = true;
  } else if (bearer && bearer !== anonKey) {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data } = await userClient.auth.getUser(bearer);
    if (data?.user) authorized = true;
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: Payload;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (!body || typeof body !== "object" || !UUID_RE.test(String(body.user_id || ""))) {
    return new Response(JSON.stringify({ error: "user_id (uuid) required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const msg = String(body.message || "").trim();
  if (!msg) {
    return new Response(JSON.stringify({ error: "message required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const kind: SensorKind = ALLOWED_KINDS.includes(body.source_kind as SensorKind) ? body.source_kind! : "other";
  const sev: Severity = ALLOWED_SEV.includes(body.severity as Severity) ? body.severity! : "medium";

  const admin = createClient(url, serviceKey);
  const { data, error } = await admin.from("tactical_sensor_alerts").insert({
    user_id: body.user_id,
    source_kind: kind,
    device_id: body.device_id ? String(body.device_id).slice(0, 120) : null,
    device_name: body.device_name ? String(body.device_name).slice(0, 200) : null,
    severity: sev,
    message: msg.slice(0, 2000),
    location: body.location ? String(body.location).slice(0, 300) : null,
    latitude: Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
    longitude: Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null,
    occurred_at: body.occurred_at && !Number.isNaN(Date.parse(body.occurred_at))
      ? new Date(body.occurred_at).toISOString() : new Date().toISOString(),
    raw: body.raw && typeof body.raw === "object" ? body.raw : {},
  }).select("id").single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true, id: data?.id }), {
    status: 201, headers: { ...CORS, "Content-Type": "application/json" },
  });
});
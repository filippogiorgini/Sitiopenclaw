// Supabase Edge Function: track-event
// Purpose: lightweight event capture for static pages (page_view, area_login_success, cta_click, etc.)
//
// Required secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// Optional:
// - NM_TRACK_TOKEN (if set, client must send header x-nm-token)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Payload = {
  event_type: string;
  cid?: string;
  mini_guide_slug?: string | null;
  page_path?: string | null;
  referrer?: string | null;
  meta?: Record<string, unknown>;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type, x-nm-token",
      "access-control-allow-methods": "POST, OPTIONS",
    },
  });
}

function normalizeSlug(s?: string | null) {
  const v = (s || "").trim();
  return v || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const token = Deno.env.get("NM_TRACK_TOKEN");
  if (token) {
    const got = req.headers.get("x-nm-token") || "";
    if (got !== token) return json(401, { error: "Unauthorized" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: "Missing Supabase env" });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const eventType = (payload.event_type || "").trim();
  if (!eventType) return json(400, { error: "event_type is required" });

  // Basic allowlist (extend as needed)
  const allowed = new Set([
    "page_view",
    "cta_click",
    "lead_submit_click",
    "area_login_success",
    "area_login_failed",
  ]);
  if (!allowed.has(eventType)) return json(400, { error: "event_type not allowed" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const slug = normalizeSlug(payload.mini_guide_slug);

  let miniGuideId: string | null = null;
  if (slug) {
    const { data: mg, error: mgErr } = await supabase
      .from("mini_guides")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (mgErr) return json(500, { error: `mini_guides lookup failed: ${mgErr.message}` });
    miniGuideId = mg?.id ?? null;
  }

  // Note: We don't resolve lead_id here (anonymous). We'll store cid and other context in meta.
  const meta = {
    ...(payload.meta || {}),
    cid: payload.cid || null,
    page_path: payload.page_path || null,
    referrer: payload.referrer || null,
    ua: req.headers.get("user-agent"),
  };

  const { error: insErr } = await supabase.from("tracking_events").insert({
    event_type: eventType,
    mini_guide_id: miniGuideId,
    meta,
  });

  if (insErr) return json(500, { error: `insert failed: ${insErr.message}` });

  return json(200, { ok: true });
});

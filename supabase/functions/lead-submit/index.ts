// Supabase Edge Function: lead-submit
// Purpose: capture lead, subscribe to mini-guide, email password via Resend, track events.
//
// Required secrets (Supabase -> Edge Functions -> Secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - RESEND_API_KEY
// - RESEND_FROM (e.g. "Naturalma <noreply@naturalma.net>")
// - RESEND_REPLY_TO (optional)
// - NM_LEAD_TOKEN (optional; if set, client must send header x-nm-token)
// - NM_MINI_GUIDE_PASSWORD_MELISSA_ROUTINE_SERALE (plaintext password for slug melissa-routine-serale)
//
// Notes:
// - mini_guides.password_hash is stored in DB; plaintext is not retrievable.
//   For MVP we store the plaintext password as a function secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Payload = {
  mini_guide_slug: string;
  name?: string;
  email: string;
  source?: string;
  page_path?: string;
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function sendResendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      reply_to: args.replyTo,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json(200, { ok: true });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const nmToken = Deno.env.get("NM_LEAD_TOKEN");
  if (nmToken) {
    const got = req.headers.get("x-nm-token") || "";
    if (got !== nmToken) return json(401, { error: "Unauthorized" });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM = Deno.env.get("RESEND_FROM");
  const RESEND_REPLY_TO = Deno.env.get("RESEND_REPLY_TO") || undefined;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, { error: "Missing Supabase env" });
  }
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return json(500, { error: "Missing Resend env" });
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const slug = (payload.mini_guide_slug || "").trim();
  const email = (payload.email || "").trim();
  const name = (payload.name || "").trim();
  const source = (payload.source || "landing").trim();
  const pagePath = (payload.page_path || "").trim();

  if (!slug) return json(400, { error: "mini_guide_slug is required" });
  if (!email) return json(400, { error: "email is required" });

  const emailNorm = normalizeEmail(email);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Fetch mini-guide
  const { data: mg, error: mgErr } = await supabase
    .from("mini_guides")
    .select("id, slug, title, is_active, password_version")
    .eq("slug", slug)
    .maybeSingle();

  if (mgErr) return json(500, { error: `mini_guides lookup failed: ${mgErr.message}` });
  if (!mg) return json(404, { error: "Mini-guide not found" });
  if (!mg.is_active) return json(403, { error: "Mini-guide not active" });

  // Upsert lead
  const { data: leadUp, error: leadErr } = await supabase
    .from("leads")
    .upsert(
      {
        email,
        email_normalized: emailNorm,
        name: name || null,
        source,
        metadata: { page_path: pagePath },
      },
      { onConflict: "email_normalized" }
    )
    .select("id")
    .single();

  if (leadErr) return json(500, { error: `lead upsert failed: ${leadErr.message}` });

  // Upsert subscription
  const { data: subUp, error: subErr } = await supabase
    .from("lead_mini_guide_subscriptions")
    .upsert(
      {
        lead_id: leadUp.id,
        mini_guide_id: mg.id,
        status: "ACTIVE",
        source,
        metadata: { page_path: pagePath },
      },
      { onConflict: "lead_id,mini_guide_id" }
    )
    .select("id")
    .single();

  if (subErr) return json(500, { error: `subscription upsert failed: ${subErr.message}` });

  // Track lead_submit
  await supabase.from("tracking_events").insert({
    event_type: "lead_submit",
    lead_id: leadUp.id,
    mini_guide_id: mg.id,
    subscription_id: subUp.id,
    meta: { source, page_path: pagePath },
  });

  // Password (MVP secret)
  let passwordSecretName = "";
  if (slug === "melissa-routine-serale") {
    passwordSecretName = "NM_MINI_GUIDE_PASSWORD_MELISSA_ROUTINE_SERALE";
  }
  if (!passwordSecretName) {
    return json(500, { error: "Password secret not configured for this mini-guide" });
  }
  const password = Deno.env.get(passwordSecretName);
  if (!password) return json(500, { error: `Missing secret ${passwordSecretName}` });

  const areaUrl = `https://preview.naturalma.net/area/${encodeURIComponent(slug)}/`;

  const subject = `La tua password per la mini‑guida Naturalma`;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5">
      <p>Ciao${name ? ` ${name}` : ""},</p>
      <p>Grazie! Ecco la password per accedere alla mini‑guida <strong>${mg.title}</strong>:</p>
      <p style="font-size:18px"><strong>${password}</strong></p>
      <p>Apri l’area riservata: <a href="${areaUrl}">${areaUrl}</a></p>
      <hr/>
      <p style="font-size:12px;color:#555">
        Avvertenze: gli integratori alimentari non vanno intesi come sostituti di una dieta varia ed equilibrata e devono essere utilizzati nell’ambito di uno stile di vita sano. Non superare la dose giornaliera raccomandata. Tenere fuori dalla portata dei bambini.
      </p>
    </div>
  `;

  try {
    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      from: RESEND_FROM,
      to: email,
      subject,
      html,
      replyTo: RESEND_REPLY_TO,
    });
  } catch (e) {
    // Track failure
    await supabase.from("tracking_events").insert({
      event_type: "password_send_failed",
      lead_id: leadUp.id,
      mini_guide_id: mg.id,
      subscription_id: subUp.id,
      meta: { error: String(e) },
    });
    return json(502, { error: "Email send failed" });
  }

  // Track password_sent + update subscription
  await supabase.from("lead_mini_guide_subscriptions").update({
    password_sent_at: new Date().toISOString(),
  }).eq("id", subUp.id);

  await supabase.from("tracking_events").insert({
    event_type: "password_sent",
    lead_id: leadUp.id,
    mini_guide_id: mg.id,
    subscription_id: subUp.id,
    meta: { to: email },
  });

  return json(200, { ok: true });
});

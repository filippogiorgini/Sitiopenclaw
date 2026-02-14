# Naturalma static site (MVP) — deployment notes

This folder contains a minimal static site scaffold for the first funnel:

- Blog article: `/blog/melissa-rilassamento-e-sonno/`
- Landing: `/l/melissa-routine-serale/`
- Gated area: `/area/melissa-routine-serale/`

## How to serve (Nginx example)

Point the document root to this folder:

- `/data/.openclaw/workspace/naturalma-site`

Example server block snippet:

```nginx
server {
  server_name naturalma.net www.naturalma.net;

  root /data/.openclaw/workspace/naturalma-site;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

## Lead submit endpoint (Edge Function)

Landing JS expects a global variable:

```js
window.NATURALMA_LEAD_ENDPOINT = "https://<project-ref>.functions.supabase.co/lead-submit";
```

Set it by injecting a small inline script before the landing page script, or by server-side templating.

### Required behavior
The endpoint should:
- Upsert into `public.leads` (dedupe by `email_normalized`)
- Upsert into `public.lead_mini_guide_subscriptions`
- Send the mini-guide password via Resend
- Write `public.tracking_events`: `lead_submit`, `password_sent`

## Gating (MVP)

The area page uses a client-side SHA-256 hash check.
This is OK for MVP but not a strong security mechanism.
Recommended next iteration:
- verify password server-side (Edge Function)
- return a signed token
- fetch guide content via token


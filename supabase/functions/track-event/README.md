# track-event (Edge Function)

Endpoint: `POST /track-event`

Purpose: capture lightweight anonymous events from static pages.

## Payload

```json
{
  "event_type": "page_view",
  "cid": "<client id>",
  "mini_guide_slug": "melissa-routine-serale",
  "page_path": "/l/melissa-routine-serale/",
  "referrer": "...",
  "meta": {"any":"thing"}
}
```

## Secrets
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NM_TRACK_TOKEN` (optional)

## Notes
Events are stored in `public.tracking_events.meta` with `cid`.
Later we can attribute to leads by also saving `cid` in `leads.metadata` during lead-submit.

# lead-submit (Edge Function)

Endpoint: `POST /lead-submit`

## Payload

```json
{
  "mini_guide_slug": "melissa-routine-serale",
  "name": "Filippo",
  "email": "filippo@...",
  "source": "landing",
  "page_path": "/l/melissa-routine-serale/"
}
```

## Secrets (required)

Set in Supabase Dashboard → Edge Functions → Secrets (or via CLI):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM`
- `RESEND_REPLY_TO` (optional)
- `NM_MINI_GUIDE_PASSWORD_MELISSA_ROUTINE_SERALE`
- `NM_LEAD_TOKEN` (optional)

## Security

If `NM_LEAD_TOKEN` is set, the client must send header `x-nm-token`.

## Notes

Password is stored as plaintext only in function secret (MVP). DB keeps hash only.

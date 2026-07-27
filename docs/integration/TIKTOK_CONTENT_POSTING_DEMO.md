# TikTok Content Posting API — Review Demo

Minimal end-to-end integration proving out TikTok's OAuth ("Login Kit") plus
the Content Posting API, built for TikTok's app-review process. It is fully
self-contained: it does not touch the trading-journal app's own user
accounts, database, or session cookie.

## Files

- `src/lib/tiktok/auth.ts` — OAuth authorize-URL builder, token exchange /
  refresh, and an encrypted, httpOnly session cookie holding the TikTok
  tokens (separate from the app's own `session` cookie).
- `src/lib/tiktok/tiktok.ts` — thin Content Posting API client: creator info,
  init upload/post, status fetch. Throws `TikTokApiError` on TikTok's
  `{error: {code, message}}` envelope.
- `src/lib/tiktok/upload.ts` — chunked binary video upload per TikTok's
  media-transfer rules.
- `src/app/api/tiktok/**` — route handlers: OAuth `start`/`callback`, `me`
  (connection status), `logout`, `upload`, `status`.
- `src/app/tiktok-demo/page.tsx` + `src/components/tiktok/tiktok-demo-client.tsx`
  — the demo page itself.

## Setup

1. In the TikTok Developer Portal, open an app with the **Login Kit** and
   **Content Posting API** products added.
2. Add a **Redirect URI** — must be `https://`, no fragment, and on a domain
   you've completed **domain verification** for. A verification static file
   already lives at `public/tiktokXiNgW7wl0BElAGNaUYWzdbpvUhczhavQ.txt`.
3. Under **Sandbox**, add up to 10 real **target user** test accounts —
   required to test an app that hasn't passed TikTok's audit yet.
4. Set these environment variables (server-side only — never expose
   `TIKTOK_CLIENT_SECRET` to the client):

   | Variable | Required | Notes |
   |---|---|---|
   | `TIKTOK_CLIENT_KEY` | yes | from the app's Login Kit config |
   | `TIKTOK_CLIENT_SECRET` | yes | server-side only |
   | `TIKTOK_REDIRECT_URI` | yes | must exactly match what's registered in the portal |
   | `TIKTOK_ENABLE_DIRECT_POST` | no | `"true"` to allow Direct Post (adds the `video.publish` scope); defaults to Inbox/Draft-only (`video.upload`) |
   | `TIKTOK_SESSION_SECRET` | recommended | signs the httpOnly cookie holding TikTok's tokens; falls back to `SESSION_SECRET` / a dev default if unset |
   | `NEXT_PUBLIC_SITE_URL` | yes (shared with the rest of the app) | used to build the default redirect URI |

5. `npm run dev`, then open `/tiktok-demo`.

## Demo flow (for the review video)

1. Open `/tiktok-demo`.
2. Click **Login with TikTok** and complete OAuth as one of your sandbox's
   target-user test accounts.
3. Pick a local `.mp4`.
4. Click **Upload**.
5. Watch the status move *Uploading…* → *Processing…* → done.
6. By default the video is sent to the account's **TikTok inbox as a
   draft** — open the TikTok app to see/post it. Set
   `TIKTOK_ENABLE_DIRECT_POST=true` to instead publish directly (capped to
   `SELF_ONLY` visibility and 5 users/24h until the app passes TikTok's
   audit — see TikTok's Content Sharing Guidelines).
7. Record steps 1–6 as a 1–2 minute screen capture for the review
   submission.

## Design notes / known constraints

- **Token storage**: TikTok's tokens live in their own encrypted, httpOnly
  cookie (`tiktok_session`), fully separate from this app's own login
  system. Access tokens auto-refresh ~5 minutes before expiry
  (`getValidAccessToken()` in `auth.ts`).
- **Minimum scopes**: `user.info.basic,video.upload` by default.
  `video.publish` (needed for `creator_info/query` and Direct Post) is only
  requested when `TIKTOK_ENABLE_DIRECT_POST=true`.
- **Upload progress**: the server performs the full chunked upload to
  TikTok inside one request, so the UI shows *Uploading…* (indeterminate)
  rather than a byte-accurate progress bar, then polls TikTok's status
  endpoint roughly every 2.5s for *Processing…* until a terminal state.
  This keeps the client trivial and avoids exposing TikTok's raw
  `upload_url` to the browser, which the API isn't designed for.
- **File-size ceiling**: capped at 200MB in `api/tiktok/upload/route.ts` for
  this demo — well under TikTok's 4GB API limit. Your hosting platform's own
  serverless request-body limit may be smaller than either number; if a
  large file fails in production, test with a smaller clip or run locally
  via `npm run dev`.
- **Error handling**: TikTok's `{error: {code, message}}` envelope surfaces
  as `TikTokApiError` and is returned as a plain JSON `{error}` string to
  the client; a terminal `FAILED` status includes TikTok's own
  `fail_reason` code (e.g. `duration_check_failed`, `file_format_check_failed`).

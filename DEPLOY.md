# Deploying NorthUnity — free tier

**Vercel** serves the built PWA from its CDN and runs the API as a serverless
function. **Supabase** free provides Postgres and the file storage for avatars
and donation slips. One origin, so the app's relative `/api` calls just work.

Total cost: nothing, and **no credit card**.

> Render was the original target and its config is still in `render.yaml` — the
> app runs unmodified on either. It was dropped because Render now requires card
> verification before running even a free service.

This deploys the app as a **closed pilot**: registration requires an invite code.
See [Why the invite code is mandatory](#why-the-invite-code-is-mandatory).

---

## Status

| Step | |
|---|---|
| Git repo, pushed to GitHub | ✅ `kalainilavan314/northunity` (private, branch `main`) |
| Supabase project + `npm-uploads` bucket | ✅ `gsmeprfwwhcexzhzafui`, Sydney |
| All 8 migrations applied | ✅ 920 GN divisions, 34 DS, 5 districts, 4 seeded events |
| API verified against live Supabase | ✅ 14/14, through the serverless path |
| **Vercel project** | ⬜ **the remaining step** |

---

## Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub. No card required.
2. **Add New → Project** → import `kalainilavan314/northunity`. Grant access to
   the repo if prompted (it is private).
3. Vercel reads `vercel.json`, so leave the build settings alone. It builds the
   frontend with `npm ci --prefix app && npm run build --prefix app`, serves
   `app/dist`, and exposes `api/[...path].js` at `/api/*`.
4. Add these **Environment Variables** before deploying:

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | the Supabase **transaction pooler** URI — see below |
   | `JWT_SECRET` | any long random string |
   | `NIC_PEPPER` | a long random string — **see the warning** |
   | `SIGNUP_INVITE_CODE` | the code you give pilot testers, e.g. `PILOT-2026` |
   | `SUPABASE_URL` | `https://gsmeprfwwhcexzhzafui.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | the `service_role` key |
   | `SUPABASE_BUCKET` | `npm-uploads` |

   Generate the two secrets:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

5. Deploy.

### Which pooler, and why

Supabase offers three connection endpoints. The choice matters:

| | Host / port | Use |
|---|---|---|
| Direct connection | `db.<ref>.supabase.co:5432` | ❌ IPv6-only on the free plan |
| **Transaction pooler** | `...pooler.supabase.com:6543` | ✅ **serverless runtime** — a new connection per invocation is exactly what it is for |
| Session pooler | `...pooler.supabase.com:5432` | ✅ **migrations** — holds a session across the multi-statement files |

So use port **`6543`** for `DATABASE_URL` on Vercel, and port `5432` when running
migrations from your machine. Same host, same credentials, different port.

> **Do not append `?sslmode=require`.** pg builds its config as
> `Object.assign({}, config, parse(connectionString))`, so parameters in the URL
> override the ones passed alongside it — `sslmode` silently replaces the pinned
> Supabase CA and the connection then fails. TLS is configured in code; leave the
> URL bare.

> **`NIC_PEPPER` is set once and never changed.** It salts every stored NIC hash,
> and the NIC is the login identity. Change it later and every member is
> permanently locked out — there is no recovery path. Put it in your password
> manager.

The function refuses to start in production if `JWT_SECRET`, `NIC_PEPPER`,
`DATABASE_URL` or `SIGNUP_INVITE_CODE` is missing — deliberately, so a
misconfigured deploy fails loudly instead of running on dev defaults.

## Check it works

Open the deployment URL:

- `…/api/health` returns `{"ok":true,…}`
- The sign-up screen shows an **Invite code** field. It only renders when
  `/api/config` reports `inviteRequired: true`, so seeing it proves the gate is live.
- Create an account, then check the **Events** list is populated — that proves
  the geo hierarchy loaded.
- Set a profile photo, hard-refresh, confirm it survives. If it vanishes, the
  Supabase storage variables are not reaching the function and it fell back to a
  local disk that does not persist.
- Install to the home screen — proves the service worker is served correctly.

## The upload size cap

Vercel caps request bodies at **4.5 MB**. Images are posted as base64 JSON, which
inflates bytes by 4/3, so the API enforces its own ceilings under that:

| | Server limit | Client compresses to |
|---|---|---|
| Avatars | 2 MB | ≤ 2 MB, 512px |
| Donation slips | 2.5 MB | ≤ 2 MB, 1280px |

`compressImage` steps quality down and then dimensions until the photo fits, so
in practice a phone photo lands far below the ceiling. Anything still over it
gets a clean `413 image_too_large` rather than an opaque failure at the edge.

These limits widen automatically on a host with a real process — the code keys
off `process.env.VERCEL`.

## Running the migrations

Already done for the current schema. For future ones, from your machine, using
the **session pooler** (port `5432`):

```bash
cd server && DATABASE_URL="<session pooler URI>" npm run migrate
```

PowerShell:
```powershell
cd server; $env:DATABASE_URL="<session pooler URI>"; npm run migrate
```

Flags:
- `--status` — show applied vs pending, change nothing.
- `--baseline` — record migrations as applied **without running them**, for a
  database whose schema already exists. The local dev database is already
  baselined; `0001_init.sql` is not idempotent and would fail if re-run there.

Migrations do **not** run on deploy. Apply them before shipping code that needs
them.

---

## Why the invite code is mandatory

`POST /api/auth/signup` performs **no identity verification at all**. There is an
OTP endpoint, but nothing consumes the code it issues — the signup handler never
checks it. Anyone who can reach the URL can create an account against any NIC
number.

For a closed pilot, `SIGNUP_INVITE_CODE` is what makes that acceptable: it is
required, compared in constant time, and the function will not boot in production
without it. It is a shared secret, not identity — it stops strangers, not a
tester who passes the code on.

**Before any public launch**, one of these has to happen first:
- wire a real SMS gateway (Dialog, Mobitel, Text.lk — none are free) and make
  signup actually consume a verified OTP; or
- keep registration invite-only and issue codes through ward coordinators.

## What "free" actually costs

| Limit | Effect |
|---|---|
| Vercel serverless cold starts | First request after idle waits ~1–3s. Far better than Render free's 30–60s. |
| Vercel Hobby: 4.5 MB request bodies | See [the upload cap](#the-upload-size-cap). |
| Vercel Hobby: non-commercial use only | A party membership app is a grey area in Vercel's terms. Worth reading before a public launch. |
| Supabase free pauses after ~7 days idle | The database stops. Resume from the dashboard — data is retained, app is down until you do. |
| Supabase free: 500 MB database | Ample — the geo hierarchy plus members is a few MB. |
| Supabase free: 1 GB storage | Donation slips are the growth driver. Roughly 2,000–5,000 compressed photos. |
| Database in Sydney, functions in Washington by default | Cross-region latency per query. Set the Vercel function region to Sydney (`syd1`) in project settings to avoid it. |

## Updating

Push to `main`; Vercel rebuilds automatically. New migrations must be applied
manually first, as above.

## Regenerating the geo reference data

`server/migrations/0000_geo_reference.sql` is generated from the GIS database,
not hand-written. If the division hierarchy changes:

```bash
cd server && node scripts/export-geo.mjs migrations/0000_geo_reference.sql
```

It reads `DATABASE_URL` (your local GIS database) and exports codes and names
only — no geometry — for the connected `LK*` hierarchy.

## The pinned Supabase CA

Supabase terminates Postgres TLS with its own private CA, so the system trust
store cannot verify it. Rather than disabling verification, that one certificate
is trusted explicitly: `server/src/supabase-ca.js` (inlined so serverless
bundling includes it), with `server/certs/supabase-root-2021.crt` kept as the
provenance record. It is byte-identical to the dashboard download:

```
SHA-256 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F
        82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
```

Valid until 26 Apr 2031. When it is rotated, download the new one and regenerate
the module.

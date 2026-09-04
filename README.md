# CDF Muhoozi 2031 — National Candidate Endorsement & Digital Signature Portal

A modern, mobile-first web application for the grassroots digital signature drive
endorsing **CDF General Muhoozi Kainerugaba for 2031**. Built with Next.js (App
Router), React, Tailwind CSS, Lucide icons, a **Supabase** backend
(`supporters` + `signatures` tables), and **Africa's Talking** SMS for real OTP
verification of Ugandan phone numbers.

The app runs in two modes automatically:

- **Live mode** — when Supabase + Africa's Talking credentials are set in
  `.env.local`, endorsements are saved to Postgres and real OTP SMS are sent.
- **Demo mode** — without credentials it runs fully client-side (localStorage)
  with simulated SMS and test OTP code **1234**, so it works out of the box.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in keys to enable live mode
npm run dev                         # http://localhost:3000
npm run build && npm start          # production
```

## Backend setup

### 1. Supabase database + storage

Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. It
creates:

| Object                               | Purpose                                                                 |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `endorsements` table                 | One endorser per row (name, **`phone_number`** as E.164, **`nin`**, district, sub_county, village, **`signature_url`**, `status` enum, `otp_verified`, `ip_address`, `user_agent`, timestamps) with `UNIQUE(nin)` / `UNIQUE(phone_number)` constraints and an `updated_at` trigger. |
| `signatures` storage bucket          | Public bucket (2 MB max, `image/svg+xml`/png/jpeg) where each signature SVG is uploaded; its public URL is stored in `signature_url`. |
| `otp_verifications` table            | Server-only OTP records (code stored as a SHA-256 hash only), attempts, expiry, Africa's Talking status. |
| `public_supporter_wall` view         | Privacy-masked public feed — names masked by SQL (`J*** D***`), verified rows only. Feeds `GET /api/supporter-wall`. |
| `get_regional_endorsement_stats()`   | `SECURITY DEFINER` RPC returning verified counts per district. Feeds `GET /api/stats`. |

RLS: `endorsements` allows anon insert + authenticated admin access; storage
bucket allows public upload/read; `otp_verifications` is server-only. The API
routes additionally write with the service-role key after OTP verification.
On submission the server uploads the signature SVG to Storage
(`signatures/sig-<ts>-<rand>.svg`) and inserts a verified `endorsements` row.

Env vars required:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server only
```

### 2. Africa's Talking SMS

The OTP routes use the Africa's Talking Messaging API
(`POST https://api.africastalking.com/version1/messaging`). Codes are
cryptographically random 4 digits, expire after 5 minutes, and are rate-limited
(30 s resend cooldown, max 5 attempts). Configure:

```
AT_USERNAME=sandbox          # use "sandbox" for testing
AT_API_KEY=...
AT_SENDER_ID=Muhoozi2031     # optional
```

Without these keys the app simulates the gateway and accepts demo code **1234**.

## API routes

| Method | Endpoint                | Description |
| ------ | ----------------------- | ----------- |
| GET    | `/api/endorsements`     | Admin/full listing (`?search=&status=&region=`), newest first. |
| POST   | `/api/endorsements`     | Upload signature SVG to Storage + create a verified `endorsements` row. Requires an OTP token (`401` unverified, `409` duplicate NIN/phone, `400` field errors). Captures `ip_address`/`user_agent`. |
| POST   | `/api/otp/request`      | Generate a 4-digit OTP (E.164 `+256…`), store its hash, send SMS via Africa's Talking (returns `devCode` only in sandbox mode). |
| POST   | `/api/otp/verify`       | Verify a code; returns a signed, time-limited token used by the POST above. |
| GET    | `/api/supporter-wall`   | Masked public feed from the `public_supporter_wall` view. |
| GET    | `/api/stats`            | Verified counts per district from the `get_regional_endorsement_stats()` RPC. |

Server modules live in `lib/server/` (`store.ts` — Supabase + in-memory
fallback for the `endorsements` table and `signatures` bucket, `sms.ts`,
`otp.ts`, `supabaseAdmin.ts`).

## Features

### Public Portal
- **Hero & live tally** — animating "Total Endorsements Captured: 148,920+" with
  live trickle ticker, a live/Demo mode status chip, and smooth-scroll CTA.
- **3-step form**: supporter details (name, validated `+256` MTN/Airtel phone,
  14-char NIN, district dropdown, sub-county) → touchscreen signature pad → SMS OTP.
- **Signature pad** — DPR-aware HTML5 canvas with pointer events (finger/stylus/
  mouse), undo/clear, typed-signature mode, serialized as crisp SVG.
- **Anti-duplicate logic** enforced in the UI **and** by unique database indexes;
  duplicates surface a toast ("This NIN has already submitted an endorsement
  signature.") and a `409` API response.
- **Supporter wall** — masked name/phone/NIN, district, relative timestamps,
  signature thumbnails.
- **Regional analytics** — chart/table for Central, Western, Northern, Eastern.
- USSD `*255#` / SMS `8226` fallback notice for feature phones.

### Admin Dashboard (header toggle)
- Search by NIN/phone/name/district, status & region filters, signature SVG
  preview modal, Supabase sync button, and **Export All Records to CSV**.

### Technical
- Endorsements persist in **Supabase** (live mode) with localStorage as offline
  cache/demo store; first visit is seeded with mock supporters.
- Reusable components: `SignaturePad`, `VerificationModal`, `SupporterWall`,
  `AdminDashboard`, `Toaster`, `Header`, `Hero`, `EndorsementForm`, `Footer`.
- Fonts self-hosted via Fontsource (Anton display, Inter body, Dancing Script
  for typed signatures).

> OTP SMS, gateway delivery, and the national tally are simulated in demo mode.
> Wire up Supabase and Africa's Talking env keys to run the real backend.

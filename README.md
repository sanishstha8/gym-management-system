# gym management system

Front-desk dashboard for a single gym: members, check-in by **RFID card, QR code or thumbprint**, renewal reminders, attendance, follow-ups and add-ons.

**Stack:** React 19 · Vite · TypeScript · Tailwind v4 · shadcn/ui · TanStack Router / Query / Table / Form · Supabase (Postgres, Auth, RLS, Realtime, pg_cron, Edge Functions).

## Quick start (demo mode, no backend)

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with `owner@shrawngym.demo` (any password). Without Supabase keys the app runs on a **browser-local demo backend** seeded with 26 fictional members. Reset it from the user menu → *Reset demo data*.

## Going live with Supabase

1. Create a project at [supabase.com](https://supabase.com) (or run `npx supabase start` locally — requires Docker).
2. Apply the schema: `npx supabase db push` (or paste `supabase/migrations/*.sql` then `supabase/seed.sql` into the SQL editor). Enable the **pg_cron** extension first if pasting by hand.
3. Create `.env.local` (see `.env.example`):

   ```bash
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

4. In Supabase Auth, add users. **The first user to sign up becomes the owner**; later users are staff.
5. (Optional) `npx supabase functions deploy send-reminder` for SMS/email delivery — the function is a stub that logs; plug in Sparrow SMS / an email provider in `supabase/functions/send-reminder/index.ts`.

## How check-in works

Every method goes through one database function, `check_in(method, value)`, which finds the credential, checks the membership, ignores repeat scans inside the duplicate window, and logs the attempt (accepted or denied with a reason).

| Method | At the desk | Real hardware later |
| --- | --- | --- |
| Card | USB RFID readers type the UID + Enter into the focused field on **Check-in → Card** | Works today with any keyboard-wedge reader |
| QR | Webcam scanner on **Check-in → QR**; members show the QR from their portal link | Any camera or QR scanner |
| Thumb | Simulated sensor (hold the pad, pick the member) | A fingerprint SDK/bridge calls `check_in('fingerprint', <device user id>)` |
| Gate QR | **Check-in → Gate QR screen** shows a code rotating every 60 s; members scan it with their phone after opening their portal link once | — |
| Assisted | Staff search a member and check them in | — |

Gate QR across devices needs Supabase; in demo mode data lives in one browser.

## Renewal reminders

`generate_reminders()` runs daily at 07:00 Nepal time (pg_cron) and creates one reminder per membership at each threshold in **Settings → Renewal reminders** (default 7, 3 and 0 days before expiry) plus one overdue reminder. Staff send them from **Renewals → Reminders** (SMS / email / marked as told in person). Renewing dismisses pending reminders and extends from the current end date if the membership is still running.

## Project layout

```text
src/
  data/api.ts            GymApi interface (everything the UI needs)
  data/supabase/         Supabase adapter
  data/demo/             Browser-local adapter + seed data
  data/queries.ts        TanStack Query options, mutations, invalidation
  lib/domain.ts          Access, renewal and reminder rules (mirrored in SQL)
  routes/                File-based routes (TanStack Router)
  features/              Check-in, members, renewals, dashboard components
supabase/
  migrations/            Schema, RLS, check-in / renewal / reminder functions, cron
  functions/send-reminder Edge Function stub for SMS/email
```

## Scripts

- `npm run dev` — dev server
- `npm run build` — type-check and production build
- `npm run lint` — oxlint

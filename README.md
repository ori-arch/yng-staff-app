# YNG Aesthetics Lounge — Staff App

A Progressive Web App for daily operations: task checklists, equipment logging,
inventory/restocking, treatment protocols, internal messaging, time off, and
shift swaps. Built with Next.js and Supabase.

See the full functional and technical spec in the YNG project doc
`claude/yng-staff-app-spec.md` for the complete plan.

## First-time setup (after deploying to Vercel)

1. Run `supabase/schema.sql` in your Supabase project's SQL Editor.
2. Run `supabase/seed.sql` to create the initial rooms (Room 1, Room 2) and
   employees (Ori, Bree, Lexi, Megan, Nielie).
3. Open the deployed app. On the home screen, tap "Ori" and then "Set up my PIN"
   to claim the owner/admin account — this is the only account that starts
   unlocked for self-setup.
4. Once logged in as Ori, use the Admin Panel to set PINs for the other
   employees (each of their accounts also starts with no PIN, so the same
   "Set up my PIN" flow works for them the first time they log in too).

## Environment variables

Copy `.env.example` to `.env.local` for local development, or set these in
Vercel's Project Settings → Environment Variables for deployment:

- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — the service_role key (keep secret — full DB access)
- `SESSION_SECRET` — a random 32+ byte hex string, used to sign login session
  cookies. Generate one with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Architecture notes

- All database access goes through Next.js API routes using the Supabase
  service_role key — never the anon key directly from the browser. Authorization
  (who can do what) is enforced in application code via a signed session cookie,
  not Postgres Row Level Security.
- PINs are hashed with scrypt (see `lib/pin.ts`), never stored in plain text.
- The app is installable as a PWA (Add to Home Screen) on both iOS (16.4+) and
  Android — this is required for push notifications to work on iPhone.

## Status

Foundation is in place: PIN login (with self-service first-time PIN setup),
role-based dashboard, and admin flag support. The feature screens (checklists,
equipment log, inventory, protocols, messages, time off, shift swap, admin
panel) are scaffolded as placeholders and are being built out next, in the
order listed in the spec's "Suggested build order" section.

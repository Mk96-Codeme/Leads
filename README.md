[README.md](https://github.com/user-attachments/files/31986484/README.md)
# DispatchLeads

A locksmith lead-reselling platform: a marketing site, a login-gated client
dashboard, and an owner-only admin panel. Built as a plain Node.js/Express
app with server-rendered pages (EJS) and a SQLite database — no build step,
no framework lock-in, easy to self-host.

## How the business logic maps to the code

- **No self-serve signup, no payment on the site.** The public `/apply` page
  only captures interest (name, business, coverage area, bundle interest)
  and stores it in the `interest_submissions` table. You follow up by email
  outside the app.
- **Client accounts are created manually, after payment.** Only the admin
  panel (`/admin/clients/new`) can create a client login. It auto-generates
  a password and shows it to you once — that's the credential you hand off.
  There is no "forgot password" flow by design; use "Reset Password" on a
  client's admin page if needed.
- **Every lead passes through you first.** You log each incoming lead in
  `/admin/leads/new`, assign it to a client by coverage area, and enter both
  the wholesale cost (what you paid) and the resale cost (what the client is
  charged). The wholesale number is never shown outside the admin panel — it
  never reaches a client view or the public site.
- **Clients only see their own data.** The client dashboard queries leads
  and transactions scoped to `req.session.clientId`; there's no client-side
  filtering of a shared list, so one client can't see another's leads by
  tampering with the page.

## Project layout

```
server.js              App entry point
routes/public.js        Homepage, pricing, apply form, client login
routes/client.js         Client dashboard (login-gated)
routes/admin.js          Admin panel (login-gated)
middleware/auth.js       Session-check middleware for the two logins
db/schema.sql            Table definitions
db/connection.js         Opens the SQLite file, applies the schema on boot
scripts/seed.js          Creates the first admin login + optional demo data
config/bundles.js        Client-facing pricing tiers (edit this for real pricing)
views/                   EJS templates
public/css/style.css     The whole design system, one file
```

## Local setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env
```

Open `.env` and set a real `SESSION_SECRET` (the file tells you how to
generate one) and change `ADMIN_PASSWORD` before you seed.

```bash
npm run seed     # creates the admin login (and demo client/leads data)
npm start        # runs on http://localhost:3000
```

The seed script prints the admin and demo client logins to the console.
It's safe to re-run — it skips anything that already exists.

To start clean later (e.g. once you're ready to remove the demo data),
delete `db/dispatchleads.db*` and re-run `npm run seed` with `ADMIN_USERNAME`
/ `ADMIN_PASSWORD` set to what you actually want, or just delete the demo
client manually from `/admin/clients`.

## First things to change before going live

1. **Pricing** — `config/bundles.js` has placeholder numbers for the
   Starter / Crew / Fleet tiers. Replace with your real pricing.
2. **Admin password** — log in at `/admin/login` with the seeded admin
   account and treat it as the only credential that matters; there's no
   password-reset flow for the admin account by design (this is a private
   tool, not a public product). If you need to change it, the simplest path
   is to delete the row from `admin_users` in the database and re-run
   `npm run seed` with a new `ADMIN_PASSWORD` in `.env`.
3. **Copy** — the homepage, pricing page, and apply page all have real
   marketing copy written in an ops/dispatch voice. Swap in your own numbers
   (years in business, delivery time, etc.) in `views/home.ejs`.
4. **SESSION_SECRET** — make sure this is a long random string in
   production, not the default placeholder.

## Deploying

This app needs somewhere with a **persistent filesystem**, because it writes
to a SQLite file (`db/dispatchleads.db`) and to session files on disk.
Pure-serverless platforms (Vercel, Netlify Functions) will NOT work as-is,
because their filesystem is wiped between requests.

Straightforward options:

- **Railway / Render / Fly.io** — attach a small persistent volume, mount it
  at e.g. `/data`, and set `DATABASE_PATH=/data/dispatchleads.db` in your
  environment variables. All three have a free or low-cost tier that's
  enough for a low-traffic internal tool like this.
- **A basic VPS** (DigitalOcean, Linode, etc.) — clone the repo, run
  `npm install --production`, set up `.env`, and run it behind a process
  manager like `pm2` and a reverse proxy like Caddy or nginx for HTTPS.
  This is the simplest "no surprises" option if you're comfortable with a
  terminal.

Whichever you choose:

```bash
npm install --production
# set real env vars: SESSION_SECRET, NODE_ENV=production, DATABASE_PATH, etc.
npm run seed   # once, to create your real admin login
npm start
```

Put the app behind HTTPS (Railway/Render/Fly all do this for you
automatically; on a VPS, Caddy gets you HTTPS with almost no config). The
session cookie is marked `secure` whenever `NODE_ENV=production`, so it
will refuse to work over plain HTTP in production — that's intentional.

## A note on how this was built

I wasn't able to actually run `npm install` or start the server inside the
sandboxed environment I built this in — it has no network access to the npm
registry. Every file was written carefully and I syntax-checked all the
JavaScript, traced the route/middleware logic by hand (and fixed one real
bug that only shows up at request-routing time — see below), and checked
the templating library's include behavior against its source directly, but
none of that replaces actually booting the app. Please run through the
basic flows once after `npm install` — apply form, client login, admin
login, logging a lead, creating a client — before you rely on this for
real leads. If something doesn't run cleanly, the error message plus this
README should make it quick to track down.

(The one bug I caught in review: the client-auth middleware was originally
registered as a blanket check on a router mounted at `/`, which would have
silently intercepted every request — including `/admin/*` — before it
reached the admin panel. It's fixed to only guard `/dashboard` and
`/activity` now, but it's a good example of the kind of routing bug that's
easy to introduce and easy to miss without actually running the server, so
don't skip the smoke test above.)

# Deploying Marked to Vercel + Supabase

A complete walkthrough, from nothing to a live site with your data in it. Read Part 1 and Part 2
in order — the steps depend on each other.

**Time:** about 20 minutes.
**Cost:** free on both tiers for one student's use.

| Account | Free tier gives you | What limits you will hit |
| --- | --- | --- |
| [Supabase](https://supabase.com) | 500 MB database, 2 projects | Pauses after 7 days of no traffic (fixed below) |
| [Vercel](https://vercel.com) | 1 GB storage, 300 s functions, 100 GB transfer | 4.5 MB per upload request |

## The two rules that break most deployments

1. **`DATABASE_URL` must be set in Vercel before your first deploy.** The build reads it while
   compiling. If it is missing, the deploy fails with `Error: DATABASE_URL is required`.
2. **Fluid Compute must be on** in Vercel. New projects have it on by default. Without it, function
   durations are capped at 60 s and a deploy requesting 300 s fails outright with
   `Serverless Functions must have a maxDuration between 1 and 60`.

Both are covered in Part 2.

---

## Part 1 — Supabase: the database

### 1.1 Create the project

1. Sign up at <https://supabase.com>, then **New project**.
2. Pick an organisation, a name (`marked` is fine), and a strong **database password**.
   **Save this password now** — Supabase does not show it again.
3. Choose a **region**. This matters: your Vercel functions run in one region, and every database
   query pays the round trip between them. See 2.2 for how to make them match.
4. Wait for the project to finish provisioning.

### 1.2 Understand the three connection strings

Supabase gives you three ways in, and choosing wrong is the single most common cause of
"my app works locally but not on Vercel". Get them from
**Project Settings → Database → Connection string**.

| | Session pooler | Transaction pooler | Direct |
| --- | --- | --- | --- |
| Host | `aws-0-<region>.pooler.supabase.com` | same host | `db.<ref>.supabase.co` |
| Port | **5432** | **6543** | 5432 |
| Username | `postgres.<project-ref>` | `postgres.<project-ref>` | `postgres` |
| Works over IPv4 | yes | yes | **no — IPv6 only** |
| Prepared statements | yes | no | yes |
| Built for serverless | reasonable | best | no |

**Use the Session pooler.** Copy it from the **Session pooler** tab — never type it by hand, because
the username must include your project reference and the region prefix varies (`aws-0-`, `aws-1-`).

It looks like:

```
postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

Why this one:

- **It works over IPv4**, so it connects from Vercel *and* from your own laptop. The direct
  connection is IPv6-only and silently fails on many networks.
- **It has no feature restrictions**, so the schema setup that runs on first boot works unchanged.
  The transaction pooler forbids some session-level features.
- The app already caps each serverless instance at 3 connections (`PG_POOL_MAX`), so the session
  pooler's connection count is not a problem at one student's traffic.

TLS is handled for you: `src/db/index.ts` turns on SSL automatically for any host that is not
`localhost`. You do not need `?sslmode=require` in the URL.

If you ever see `too many connections`, switch to the **Transaction pooler** tab (port 6543) and use
that string instead — nothing else in the app needs to change.

### 1.3 Put the password in, correctly

Replace `[YOUR-PASSWORD]` with your real database password. **If the password contains any of
`@ : / # ? %`, those characters must be percent-encoded**, or the URL parses wrongly and you get
`password authentication failed`:

| Character | Write |
| --- | --- |
| `@` | `%40` |
| `:` | `%3A` |
| `/` | `%2F` |
| `#` | `%23` |
| `?` | `%3F` |
| `%` | `%25` |

Simplest fix: set a database password that is long but only letters and digits. You can change it
under **Project Settings → Database → Reset database password**.

### 1.4 Create the tables

You have two options. **Option A is the good one.**

**Option A — create them now, from your machine.** With the project open on your computer:

```bash
# from the project root, using your session pooler string
npx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts --url "<SESSION_POOLER_URL>"
```

You should see `[✓] Changes applied`. This command reads `src/db/schema.ts` and creates every table,
so it always matches the code you are deploying.

**Option B — let the app create them.** Do nothing. On the first request after deploying, the app
runs the same schema itself. This works, but the very first page load takes a few seconds longer,
and if two cold starts race, one logs a harmless duplicate error. Prefer Option A.

### 1.5 Where your data actually lives

Everything is in Postgres: your papers, the photos of your answers, the marking reports, tutor
chats, notes and the calendar. Nothing is stored on the serverless filesystem, so nothing is lost
between requests, cold starts or redeploys. Back up with
**Database → Backups** on the Pro plan, or `pg_dump` the session pooler URL yourself.

---

## Part 2 — Vercel: the hosting

### 2.1 Get the code into GitHub

Vercel deploys from a Git repository.

```bash
cd <your project folder>
git init
git add .
git commit -m "Marked: ISC practice and marking"
```

Then create a repository at <https://github.com/new> (Private is fine) and follow the commands
GitHub shows you, which will be along the lines of:

```bash
git remote add origin https://github.com/<you>/marked.git
git branch -M main
git push -u origin main
```

Check that `.gitignore` contains `.env` and `.next` before you push, so your database password and
API keys are not published. A suitable `.gitignore`:

```
node_modules
.next
.env
.env.local
```

### 2.2 Import the project

1. At <https://vercel.com/new>, import the repository you just pushed.
2. Vercel detects **Next.js** and fills in the build settings. Leave them alone.
3. Before clicking Deploy, expand **Root Directory** and confirm it points at the folder containing
   `package.json`.
4. Note the **region** shown under the build settings. If it is far from your Supabase region —
   for example functions in `iad1` (US East) and a database in `ap-south-1` (Mumbai) — every query
   pays about 200 ms of round trip. Either recreate the Supabase project near your Vercel region,
   or set the function region in `vercel.json`:

   ```json
   { "regions": ["bom1"] }
   ```

   Vercel region codes: `bom1` Mumbai, `sin1` Singapore, `iad1` / `sfo1` US, `fra1` Frankfurt,
   `lhr1` London.

### 2.3 Add the environment variable — before deploying

Still on the import screen, open **Environment Variables** and add:

| Name | Value | Environments |
| --- | --- | --- |
| `DATABASE_URL` | your session pooler URL from 1.3 | Production **and** Preview |

Optionally add any AI key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`OPENROUTER_API_KEY`, `NVIDIA_API_KEY`) so marking works before you add a key in the UI. This is
optional — you can add keys in the app after it is live, and keys you add in the app are tried
first.

`PG_POOL_MAX` is optional and defaults to 3.

### 2.4 Deploy

Click **Deploy**. The build takes a couple of minutes. When it finishes you get a URL like
`https://marked.vercel.app`.

### 2.5 Confirm Fluid Compute is on

Open the project in Vercel → **Settings → Functions** → check that **Fluid Compute** is enabled.
New projects have it on by default. If it is off, enable it and redeploy.

This is what lets marking run for up to 300 seconds. Without it, a deploy that asks for 300 s
fails, and long papers would time out at 60 s.

### 2.6 What the configuration files are doing

You do not need to change these; this is so you know what they are.

- `vercel.json` gives the marking route 300 s and 2 GB of memory, the tutor and question generator
  their own limits, and runs a **daily cron against `/api/health`**. That cron exists because a
  Supabase free project pauses after 7 days without a query — one request a day keeps it awake.
- `src/app/api/attempts/[id]/grade/route.ts` exports `maxDuration = 300` and wraps the marking job
  in `after()` from `next/server`, which maps to Vercel's `waitUntil`. That is what stops the
  function from being frozen the moment the HTTP response is sent, so marking continues after the
  page has loaded.
- `next.config.ts` lists `pdfjs-dist` and `@napi-rs/canvas` in `serverExternalPackages`, which keeps
  them out of the bundled server code so they run as normal Node modules on the server.
- The server bundle is about 25 MB, well inside Vercel's 250 MB limit.

---

## Part 3 — Verify it works

Do these in order. Each one catches a different class of problem.

1. **`https://<your-site>/api/health`**

   You should get:

   ```json
   { "ok": true, "database": "connected", "schema": "ready", "missing": [], "tables": [ ... ] }
   ```

   - `database: "unreachable"` → the connection string or password is wrong. See the table below.
   - `schema: "incomplete"` with tables in `missing` → run the command in 1.4.

2. **Open the site.** The dashboard loads, the countdown to the boards is showing, and the calendar
   has the eight 2027 board dates in it.

3. **API keys → add a key.** It should verify and show as Working within a few seconds. If it says
   `Could not reach …`, Vercel cannot reach that provider.

4. **Library → upload a specimen paper.** If it fails with a size error, the PDF is over 4 MB —
   Vercel caps any request body at 4.5 MB. Compress it or upload photos of the pages.

5. **New paper → start the clock → finish → upload answer photos → Mark my paper.** This is the real
   test. It takes one to four minutes and you can leave the page.

6. **Tutor → ask it something.** It should know about the paper you just marked.

---

## Part 4 — Troubleshooting

Ordered by how often each one happens.

| What you see | Why | Fix |
| --- | --- | --- |
| Deploy fails: `DATABASE_URL is required` | The env var was not set before the build | Settings → Environment Variables → add it → Redeploy |
| Deploy fails: `maxDuration between 1 and 60` | Fluid Compute is off | Settings → Functions → enable Fluid Compute → Redeploy |
| `database: unreachable` on `/api/health` | Wrong string or password | Use the session pooler string; percent-encode the password (1.3) |
| `password authentication failed for user` | Password not encoded, or you used plain `postgres` with the pooler | The pooler username must be `postgres.<project-ref>` |
| `could not translate host name` | Typo, or you used the direct `db.<ref>.supabase.com` host | Use the pooler host from the dashboard |
| `self signed certificate in certificate chain` | TLS verification | Already handled by `src/db/index.ts`; if you see it, you replaced that file |
| `too many connections` | Many instances each holding sessions | Switch to the transaction pooler (port 6543), or lower `PG_POOL_MAX` to 1 |
| Site suddenly returns 500 after a week unused | Supabase free project paused | Restore it in Supabase; the daily cron in `vercel.json` prevents this |
| Upload fails around 4 MB | Vercel's request body limit | Vercel caps a request at 4.5 MB. Photos are compressed in the browser first; for PDFs, stay under 4 MB |
| Marking stops with `ran out of output space` | The paper has many parts and the model spent its budget thinking | Run the marking again, or mark a shorter paper |
| Marking stops with `content safety screening` | A provider's filter rejected the input | Marking retries automatically with text instead of images. If it persists, add a key from another provider |
| Marking never finishes | The function hit its duration cap | Confirm Fluid Compute is on and the route is the one with `maxDuration = 300` |
| Cold start feels slow (1–3 s) | First request after idle spins up a function | Normal on serverless. The next request is fast |

Logs are in Vercel → your project → **Logs**. Filter by the route that failed. Marking failures
print `[grader] attempt <id> failed`, tutor failures print `[tutor]`.

---

## Part 5 — Living with it

**Redeploying after code changes.** Commit and push to `main`. Vercel builds and deploys
automatically. Your data is untouched — it is in Supabase, not in the deployment.

**Updating the schema after a code change.** If a new version adds tables or columns, run the
command from 1.4 again against your session pooler URL. The app also creates anything missing on
boot, so for a small change you can simply redeploy and reload.

**Keeping Supabase awake.** The daily cron in `vercel.json` hits `/api/health` at 03:00 UTC. If you
removed it, either use the site at least weekly or expect the free project to pause.

**Backing up.** On Supabase free tier there are no automatic backups. Your data is one student's
exam record, so take it seriously:

```bash
pg_dump "<SESSION_POOLER_URL>" --format=custom --file=marked-backup.dump
```

**Moving to a bigger database later.** Point `DATABASE_URL` at the new one, run the command in 1.4,
and restore your dump. Nothing else changes.

**Custom domain.** Vercel → Settings → Domains → add it. Follow the DNS records it asks for.

---

## Security, honestly

This app has **no login**. Anyone who has the URL can use the site, spend your AI keys and read
your papers, mistakes and notes. That is acceptable for a private link you keep to yourself. It is
not acceptable if the URL becomes public.

Two things worth doing:

- Keep the Vercel deployment URL private, and do not put it in a public repo's README.
- Remember that AI keys you add in the app are stored in the database as plain text.

If you ever need it public, add Vercel's password protection (Pro plan) or a sign-in in front of
the app first.

---

## Quick reference

```bash
# create or update the tables on Supabase
npx drizzle-kit push --dialect postgresql --schema ./src/db/schema.ts \
  --url "<SESSION_POOLER_URL>"

# back up everything
pg_dump "<SESSION_POOLER_URL>" --format=custom --file=marked-backup.dump

# check the site is healthy
curl https://<your-site>/api/health

# run locally against Supabase
DATABASE_URL="<SESSION_POOLER_URL>" npm run dev
```

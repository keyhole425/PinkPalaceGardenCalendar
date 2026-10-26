# Deploying figgy

figgy runs on **Vercel**, with its database on **Turso** (hosted libSQL). This
is the whole of it: setting both up once, moving the garden across from the
home server, getting the first person in, and looking after it afterwards.

## What lives where

| | |
|---|---|
| The app | Vercel, region `syd1` (`vercel.json`) |
| The data | Turso: one database for production, one for previews |
| Passwords | Better Auth's `account` table, hashed |
| Each household's Anthropic key | `household_ai_credential`, sealed with `FIGGY_ENCRYPTION_KEY` |
| Backups | Turso's point-in-time history, plus a nightly encrypted dump (`.github/workflows/backup.yml`) |

Functions sit next to the database, not next to the people: a page makes
several round trips to the database and one to the browser.

## Once: Turso

```bash
brew install tursodatabase/tap/turso
turso auth signup
turso db locations          # pick the one closest to Sydney
```

If Turso has a Sydney location, use it and leave `vercel.json` on `syd1`. If
not, pick the nearest and move `regions` in `vercel.json` to the Vercel region
beside it.

A preview database, so a pull request can never touch the real garden:

```bash
turso db create figgy-preview --location <location>
turso db show figgy-preview --url
turso db tokens create figgy-preview
```

The production database is made from the home garden; see [Moving the garden
across](#moving-the-garden-across).

## Once: Vercel

1. Import the repository. Vercel finds Next.js on its own; leave the build
   settings alone. `package.json` has a `vercel-build` script, which Vercel
   runs instead of `build`: it migrates and re-seeds that environment's
   database, then builds.
2. **Environment variables.** Mark every one *Sensitive*. Each environment
   gets its own values, never shared:

   | Variable | Production | Preview |
   |---|---|---|
   | `TURSO_DATABASE_URL` | `libsql://figgy-…turso.io` | the `figgy-preview` URL |
   | `TURSO_AUTH_TOKEN` | `turso db tokens create figgy` | `turso db tokens create figgy-preview` |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | a different one |
   | `BETTER_AUTH_URL` | `https://` + your domain | *unset* - previews use their own address |
   | `FIGGY_ENCRYPTION_KEY` | `openssl rand -base64 32` | a different one |

   **Never set** `ANTHROPIC_API_KEY` (figgy does not read it, and a key there
   is a key somebody could spend), `TZ` (reserved on Vercel; figgy works out
   Adelaide's date itself), `FIGGY_TODAY`, or anything starting `FIGGY_DEV_`.

   figgy refuses to start on Vercel without `TURSO_DATABASE_URL` or
   `BETTER_AUTH_SECRET`, and refuses to seal a key without
   `FIGGY_ENCRYPTION_KEY`, rather than quietly running on development
   defaults.
3. **Deployment Protection** → turn on *Vercel Authentication* for preview
   deployments, so a preview is only reachable by you.
4. **Domain** → add it, then set `BETTER_AUTH_URL` to match.

Keep a copy of the production `FIGGY_ENCRYPTION_KEY` somewhere safe outside
Vercel. Lose it, and every household has to enter its Anthropic key again.

## Moving the garden across

The garden is in the old Docker volume, `ops_figgy-data`. With the containers
stopped nothing is writing to it, so the database and its journal can be
copied out together:

```bash
docker volume ls | grep figgy        # ops_figgy-data
mkdir -p cutover
docker run --rm -v ops_figgy-data:/data -v "$PWD/cutover":/out alpine \
  sh -c 'cp /data/garden.db /data/garden.db-wal /data/garden.db-shm /out/ 2>/dev/null; ls -l /out'
```

Bring it up to date locally first, where it is easy to look at and easy to
throw away:

```bash
TURSO_DATABASE_URL=file:./cutover/garden.db npm run db:migrate
TURSO_DATABASE_URL=file:./cutover/garden.db npm run db:seed
TURSO_DATABASE_URL=file:./cutover/garden.db npm run admin:list
```

`admin:list` should show household 1, *Pink Palace*, with nobody in it yet.
Migration 0004 moves every existing row into it; the migration test holds it
to losing nothing. Then hand it to Turso, which wants it in WAL mode:

```bash
cp cutover/garden.db cutover/figgy.db
sqlite3 cutover/figgy.db 'PRAGMA journal_mode=WAL;'
turso db import cutover/figgy.db      # makes a database called figgy
turso db show figgy --url
turso db tokens create figgy
```

(If your Turso CLI has no `import`, `turso db create figgy --from-file
cutover/figgy.db` does the same.) Put the URL and token in Vercel's
Production environment and deploy. Keep `cutover/` - it is the last copy of
the garden as it was at home.

## Getting the first person in

There is no sign-up form. The first admin comes from an invite minted on the
command line, against production:

```bash
vercel env pull .env.production.local --environment=production
npx tsx --env-file=.env.production.local scripts/admin/invite.ts --household 1 --role admin
```

Open the link it prints, make your account, then make yourself a site admin -
the one thing the app itself cannot do:

```bash
npx tsx --env-file=.env.production.local scripts/admin/site-admin.ts grant you@example.com
rm .env.production.local
```

From there, everything is in the app: invite your household from Settings,
start gardens for friends from *New gardens*, and add an Anthropic key under
*Looking things up* if you want Claude.

## Deploying changes

Pushing to `main` deploys production; a pull request gets a preview on the
preview database. Either way `vercel-build` migrates first, so:

- **Migrations must be additive.** The old deployment keeps serving while the
  new one builds, and Vercel's instant rollback goes back to old code on the
  new schema. Add columns and tables; remove them in a later release, once
  nothing reads them.
- **drizzle-kit drops triggers when it rebuilds a table.** If a generated
  migration rebuilds any household table, the tenancy test fails until the
  triggers from 0005 are put back in that migration.
- Re-seeding on every deploy is safe: it leaves anyone's edits alone, and an
  unchanged seed rule keeps its id, so work recorded against it stays ticked.

## Backups

**Turso** keeps point-in-time history; how far back depends on the plan, so
check yours. Going back makes a new database from the old one at a moment in
time - `turso db create --help` lists the flags, which have changed between
CLI versions - and then you point production's `TURSO_DATABASE_URL` and token at `figgy-restored`
and redeploy.

**The nightly dump** (`.github/workflows/backup.yml`) is for the day Turso
itself is the problem. It needs three repository secrets: `TURSO_API_TOKEN`
(`turso auth api-tokens mint figgy-backup`), `TURSO_DATABASE` (`figgy`) and
`AGE_RECIPIENT`, the public half of a key from `age-keygen`. Keep the private
half off GitHub. Dumps are kept 30 days, and a failed run emails you. To
restore one:

```bash
age -d -i figgy-backup.key figgy-2026-11-02.sql.gz.age | gunzip > figgy.sql
turso db create figgy-restored
turso db shell figgy-restored < figgy.sql
```

Do one restore before relying on it.

## Secrets, when they need changing

- **`BETTER_AUTH_SECRET`**: change it and redeploy. Everyone is signed out.
- **`FIGGY_ENCRYPTION_KEY`**: move the old value to
  `FIGGY_ENCRYPTION_KEY_PREVIOUS`, put a new one in `FIGGY_ENCRYPTION_KEY`,
  redeploy. Saved keys still open with the old one; each household admin
  re-saving their key moves it onto the new one. Remove `…_PREVIOUS` once
  they have.
- **`TURSO_AUTH_TOKEN`**: mint a new one, swap it in, redeploy, then
  `turso db tokens invalidate figgy`.
- **Someone forgot their password**: `scripts/admin/invite.ts --reset
  them@example.com` prints a one-time link. They are signed out everywhere
  when they use it.

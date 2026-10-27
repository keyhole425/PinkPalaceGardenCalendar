# Deploying figgy

figgy runs on **Vercel**, with its database on **Turso** (hosted libSQL). This
is the whole of it: setting both up once, getting the first person in, and
looking after it afterwards.

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

## In order

Going live is three steps, each needing something from the one before:

1. [Turso](#once-turso): an account and two databases.
2. [Vercel](#once-vercel): the project, its settings and its secrets.
3. [Getting the first person in](#getting-the-first-person-in).

Before step 2, merge this work into `main`. Vercel builds production from the
repository's default branch, and until the merge `main` has no `vercel.json`,
no `vercel-build` and no Turso.

## Once: Turso

```bash
brew install tursodatabase/tap/turso
turso auth signup
turso db locations          # pick the one closest to Sydney
```

If Turso has a Sydney location, use it and leave `vercel.json` on `syd1`. If
not, pick the nearest and move `regions` in `vercel.json` to the Vercel region
beside it.

Two databases, so a pull request can never touch the real garden:

```bash
turso db create figgy --location <location>
turso db create figgy-preview --location <location>
turso db show figgy --url
turso db tokens create figgy
turso db show figgy-preview --url
turso db tokens create figgy-preview
```

Keep the URLs and tokens to hand for Vercel. Both start empty, and that is
all they need: the first deploy to each migrates it and seeds the Pink Palace
in as household 1, with its beds, plants and care rules. Nothing comes across
from the copy on your laptop.

## Once: Vercel

### An account

Sign up at vercel.com with GitHub. The free Hobby plan is enough: it is for
personal, non-commercial use, which a household garden is, and its functions
may run for up to 300 seconds, which is what researching a plant asks for.

### Importing the project

**Add New → Project**, then pick the repository. The first time, Vercel asks
to install its GitHub app; give it *Only select repositories* and choose
`PinkPalaceGardenCalendar`, not the whole account.

On *Configure Project*:

- **Project name**: `figgy`. It becomes the address, `figgy.vercel.app` or
  `figgy-<something>.vercel.app` if that is taken.
- **Framework Preset**: Next.js, found on its own. **Root Directory**: `./`.
- **Build and Output Settings**: leave them alone. `package.json` has a
  `vercel-build` script, which Vercel runs instead of `build`: it migrates and
  re-seeds that environment's database, then builds.
- **Environment Variables**: leave this empty. Anything entered here goes to
  production and previews alike, and figgy keeps them apart.

Press **Deploy**. This first build fails at the migration step, with
*TURSO_DATABASE_URL is not set, and Vercel has no disk to keep a file on* -
that is figgy refusing to run without a database, and it has touched nothing.

### Settings

In the project's **Settings**:

1. **Environment Variables.** Add each one twice, once ticked for
   *Production* only and once for *Preview* only - never *Development* - and
   mark every one *Sensitive*. Sensitive values can be replaced but never
   read back, from the dashboard or the CLI, so keep the production ones in a
   password manager as you go.

   | Variable | Production | Preview |
   |---|---|---|
   | `TURSO_DATABASE_URL` | `turso db show figgy --url` | `turso db show figgy-preview --url` |
   | `TURSO_AUTH_TOKEN` | `turso db tokens create figgy` | `turso db tokens create figgy-preview` |
   | `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | a different one |
   | `BETTER_AUTH_URL` | `https://` + the address people will use | *unset* - previews use their own address |
   | `FIGGY_ENCRYPTION_KEY` | `openssl rand -base64 32` | a different one |

   `BETTER_AUTH_URL` is the custom domain if there will be one, otherwise the
   project's `.vercel.app` address. Leave *Automatically expose System
   Environment Variables* ticked: previews find their address from
   `VERCEL_URL` and `VERCEL_BRANCH_URL`.

   **Never set** `ANTHROPIC_API_KEY` (figgy does not read it, and a key there
   is a key somebody could spend), `TZ` (reserved on Vercel; figgy works out
   Adelaide's date itself), `FIGGY_TODAY`, or anything starting `FIGGY_DEV_`.

   figgy refuses to start on Vercel without `TURSO_DATABASE_URL` or
   `BETTER_AUTH_SECRET`, and refuses to seal a key without
   `FIGGY_ENCRYPTION_KEY`, rather than quietly running on development
   defaults.
2. **Build and Deployment → Node.js Version**: the newest offered. CI tests on
   Node 26.
3. **Functions**: leave *Fluid compute* on, as it is for a new project.
   Without it Hobby stops a function at 60 seconds, and the deploy is refused
   because the plant pages ask for 300. The region shown should be Sydney
   (`syd1`), from `vercel.json`.
4. **Deployment Protection**: *Vercel Authentication* on, at *Standard
   Protection*. New projects start this way; check it. Previews and each
   deployment's own address then need you signed in to Vercel, while the
   production address stays open to the garden.
5. **Environments → Production**: the branch is `main`.
6. **Domains**, if there is one: add it, put the records Vercel shows in at
   the domain's registrar, and wait for it to say *Valid Configuration*. Then
   set production's `BETTER_AUTH_URL` to match.

Keep a copy of the production `FIGGY_ENCRYPTION_KEY` somewhere safe outside
Vercel. Lose it, and every household has to enter its Anthropic key again.

### The first real deploy

**Deployments**, the failed one, **⋯ → Redeploy**. In the build log,
`figgy: migrations applied to figgy-….turso.io` says it found the production
database. Open the production address: it should go to sign-in.

Any time a variable changes, redeploy the same way; a running deployment
keeps the values it was built with.

## Getting the first person in

There is no sign-up form. The first admin comes from an invite minted on the
command line, against production. Vercel will not hand back its Sensitive
values, so the scripts take theirs from Turso, with a token that lapses
tomorrow:

```bash
export TURSO_DATABASE_URL="$(turso db show figgy --url)"
export TURSO_AUTH_TOKEN="$(turso db tokens create figgy --expiration 1d)"
export BETTER_AUTH_URL=https://your.address
npm run admin:invite -- --household 1 --role admin
```

Each script names the database it worked on; check it says `figgy-…`, not
`figgy-preview-…`. Open the link it prints, make your account, then make
yourself a site admin - the one thing the app itself cannot do - and close
that terminal:

```bash
npm run admin:grant -- you@example.com
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

  The library's evidence and suggestions are keyed by hashes made with this
  key. While `…_PREVIOUS` is set, a grow found under its old hash is
  rewritten under the new one the next time anything happens to it, and a
  garden that stops sharing has rows under either hash deleted. Rows no
  household touches in that time keep their old hash, and once `…_PREVIOUS`
  is gone a garden that stops sharing can no longer delete those. So keep
  `…_PREVIOUS` for a season, not a day.
- **`TURSO_AUTH_TOKEN`**: mint a new one, swap it in, redeploy, then
  `turso db tokens invalidate figgy`.
- **Someone forgot their password**: with the three exports from [Getting
  the first person in](#getting-the-first-person-in), `npm run admin:invite
  -- --reset them@example.com` prints a one-time link. They are signed out everywhere
  when they use it.

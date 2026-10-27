# figgy

A garden calendar for the Pink Palace, in Adelaide.

Plants live in **growing environments** — the orchard, outdoor beds, the
hothouse — and each one needs certain actions in certain months. figgy keeps
that schedule, tells you what is due, and records what you actually did.

It began as a spreadsheet, `ORCHARD SCHEDULE.numbers`: eleven fruit trees, three
actions each, twelve months across. That grid is now the seed data.

## Running it

```bash
npm install
npm run db:migrate   # creates data/garden.db
npm run db:seed      # loads the orchard
FIGGY_DEV_EMAIL=gardener@figgy.test FIGGY_DEV_PASSWORD='a long e2e password' \
  npm run admin:dev-user   # someone to sign in as
npm run dev          # http://localhost:3000
```

The database is libSQL: a local SQLite file at `data/garden.db` by default, or
Turso when `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set. Every query is
async, and nothing relies on a foreign-key cascade, because a hosted
connection may not enforce one.

## Households

Every garden is a **household**, and every row in the database belongs to one.
No household can see another's plants, schedule, records or what Claude
was asked. The household always comes from whoever is signed in, never from
a form, and every query and action is scoped by it. The database holds the
same line with triggers that refuse a row pointing into another garden.

What crosses that line, and only in one direction, is what a garden gives
the shared library (below): anonymous outcomes of its grows, and its
suggestions. A household admin can stop that in Settings, and stopping deletes
everything the garden gave.

The Pink Palace is household 1, with its orchard. A new household starts with
a copy of the library's starter set and one bed.

## The library

What figgy knows about growing things is kept once, in the **library**, and
shared by every garden. It is the one part of the database that belongs to no
household: every household reads it and none writes it. Only the seed and a
site admin change it, the site admin from `/library`.

**It learns from what grows.** Nothing new is typed in. Each grow of a library
plant already says when it went in, when it was first picked, how often, and
whether it made it, and `lib/library/evidence.ts` turns that into one row per
grow. The row stores no household, planting, person, label or exact date:
only months, durations, the kind of place, and keyed hashes. The hashes let a
grow be updated, a garden's rows be deleted, and four grows in one garden be
told apart from one in each of four gardens. Nobody can work back from them.
Notes go in with the garden's own names taken out (its name, its people, its
places, what it calls its plants), and only a site admin reads them. No
other garden ever sees another's evidence, only what the library says.

**Gardens suggest; a site admin decides.** These become suggestions,
anonymous in the same way:
- changing a library plant's months,
- keeping a Claude look-up of one,
- having a plant the library lacks,
- writing a note from an article ("Suggest something").

Plain rules (`lib/library/flags.ts`) point out where the evidence disagrees
with the library: picked from a month it says not to sow in, a sowing month
that keeps failing, or a harvest well sooner or later than it says. Nothing
changes until a site admin accepts it. Accepting publishes it, and every
garden that hasn't made that rule its own follows, with an "Updated from the
library" line on the plant's page. A plant a garden added itself can join the
library as a plant of its own, as a kind of another, or filed with one it
already has. The garden's copy is then linked, and its earlier grows count
too.

A garden's plants are copies. A copy follows the library until someone in
that garden edits it, action by action, which is the same promise seeding has
always kept: change your tomato's sowing and sowing is yours. Following never
puts the old window back, and an unchanged rule keeps its id, so anything
recorded against it stays ticked. The orchard is not in the library. It is
the Pink Palace's own, copied from its spreadsheet.

A plant can have **varieties**, one level deep: chilli, then habanero, bird's
eye and Carolina Reaper. A variety stores only what differs from its parent.
Its rules for an action replace the parent's, and any action it doesn't
mention is the parent's. `lib/library/resolve.ts` fills a variety in, and
everything else reads the result.

Windows are kept per **region**, because the same month means different
things in Adelaide and in Hobart. Every household has one. There is only
Adelaide so far, described in `lib/ai/locale.ts`, which every prompt to
Claude starts from.

## The first visit

Everyone new is offered a tour: setting up, for whoever runs a household
(name it, lay out the places, decide about Claude, invite people), then a look
round, for everyone. The steps are data in `lib/tour/steps.ts`, each pointing
at a `data-tour` element. It can be put off, declined for good, or brought back
from Settings.

## Getting in

figgy is invite-only. There is no sign-up form: an account is only ever made
from an invite link, which works once, for a week, and is stored only as a
hash. Three kinds:

- **Join a household**, made by that household's admins on `/settings`.
- **Start a new garden**, made only by a site admin.
- **Choose a new password**, made from the command line - figgy sends no
  email, so this is what "forgot my password" means.

Site admin is granted and revoked from the command line only, and every check
reads it from the database rather than trusting a cookie.

| | |
|---|---|
| `npm run admin:invite -- --new-garden` | an invite to start a garden |
| `npm run admin:invite -- --household 1 --role admin` | an invite into household 1 |
| `npm run admin:invite -- --reset them@example.com` | a new-password link |
| `npm run admin:grant -- you@example.com` / `admin:revoke` | site admin on or off |
| `npm run admin:list` | every household and who is in it |

They act on whatever `TURSO_DATABASE_URL` points at, and build links from
`BETTER_AUTH_URL`.

## How the schedule is stored

A care window is a **12-bit month mask** — bit `m-1` set means month `m`. The
orchard's windows are discrete (`{1,3,9,11}`), contiguous (`5-8`) and
year-wrapping (`{11,12,1,2}`), and a mask handles all three without special
cases.

Mutually exclusive windows — *prune in August **or** September* — are sibling
rules sharing an `altGroup`. Doing any one of them satisfies the group for that
season.

Dates are stored as plain `YYYY-MM-DD` strings, never timestamps. Adelaide sits
at a half-hour UTC offset, which turns naive date arithmetic into off-by-one-day
bugs; the timezone is consulted in exactly one place, `lib/dates.ts`.

## Scripts

| | |
|---|---|
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build, and serving it |
| `npm run db:generate` | write a migration after changing `lib/db/schema.ts` |
| `npm run db:migrate` | apply migrations |
| `npm run db:seed` | load seed data (safe to re-run; never overwrites your edits) |
| `npm run db:reset` | delete the database and rebuild it from scratch |
| `npm run db:studio` | browse the database |
| `npm test` | unit tests |
| `npm run test:e2e` | Playwright smoke flows against a production build |
| `npm run lint` / `npm run format` | Biome |
| `npm run typecheck` | `tsc --noEmit` |

`FIGGY_TODAY=2026-08-15 npm run dev` pins "today", for looking at the schedule
from another month.

## Beds and the hothouse

Plants live in **growing environments**: the orchard, outdoor beds, the
hothouse. An environment carries a climate profile, and the one that matters
most is `windowShiftMonths` — how far ahead of the open garden it runs. The
hothouse is `-1`, so any window that does not name the hothouse is shifted a
month earlier there. The same tomato is sowable in July inside and August out,
without being entered twice.

A rule scoped to an environment kind wins outright and is not shifted: it
already means what it says.

`/now` also says what **could** go in this month. That works from the crops
figgy knows and the places open to them, rather than from plantings — it
cannot tell you to sow beans by looking at beans you have not sown.

The vegetable sowing months in the seed are a general temperate-Australia
guide, not this garden. They are meant to be corrected, by hand or by asking
Claude to research the crop properly.

## Looking after the garden with words

`/now` takes a sentence — "netted the cherries and picked about 2 kg off the
lemon" — and proposes records from it, matched against the plants figgy
actually has. **It proposes; you confirm.** Nothing is written until you have
looked at the sheet, and anything Claude could not match to a specific plant
cannot be committed at all.

`/ask` answers questions about your own records. Every tool it can reach is
read-only and takes enumerated arguments, so a confused question gives a
confused answer and nothing worse.

Both need the household's Anthropic key (see below). Without it they explain
themselves.

## Weather

`/now` shows the week from the Bureau of Meteorology's Adelaide forecast, with
[Open-Meteo](https://open-meteo.com) — free, no key — filling in the wind the
Bureau leaves out and standing in for it when it can't be reached. The card
says which one answered. It then says the two things worth saying: frost coming, a scorcher on Thursday,
enough rain that watering is a waste. Those judgements are made here rather
than asked of a model: frost is frost, and an answer that works offline and
costs nothing beats a clever one that needs an API key.

## Deploying

figgy runs on Vercel with its data on Turso. [docs/DEPLOY.md](docs/DEPLOY.md)
has all of it: setting both up, getting the first person in, backups, and
changing secrets.

## Layout

```
app/          routes
app/fonts/    the two typefaces, committed as .woff2
actions/      server actions: everything that writes
components/   UI
components/ui/ the primitives everything else is built from
lib/ai/       the Claude features: research, asking, reading a sentence
lib/db/       schema, client, queries
lib/schedule/ month masks and the due-date engine
lib/weather/  the Bureau and Open-Meteo, and what to say about them
lib/ui/       class-name helpers and the action colours
db/seed/      the orchard, transcribed from the spreadsheet
db/migrations SQL, generated by drizzle-kit
e2e/          Playwright smoke flows
docs/         written-down knowledge, one folder per area (docs/README.md)
```

The fonts are committed rather than fetched. `next/font/google` downloads at
build time, which would make `npm run build` - and so the e2e suite, which
builds before it runs - depend on reaching a Google server.
`npm run build` needs no network at all.

## Colour

figgy is built on three named colours, all of them OPI *Wicked* lacquer shades:
Rejoicify `#cd7baa` is the pink on the cover and the harvest, Glinda `#f0a19a`
is pruning and every warning, and Wickedest `#abc590` is feeding and every
confirmation. The values and the seven rules that govern where each may appear
live in [app/globals.css](app/globals.css), and no component defines a colour of
its own.

The whole design language - principles, colour and type, the components, page
patterns, voice and accessibility, and a log of the decisions behind them - is
written up in [docs/design/](docs/design/README.md).

## Looking a plant up

figgy can research a plant's care for Adelaide and propose a schedule. It needs
an Anthropic API key, and figgy has none of its own to lend: **each household
brings its own.** An admin adds it under Settings → Looking things up, it is
checked with a free call before it is saved, and the whole household uses it.
It is sealed in the database with AES-256-GCM against `FIGGY_ENCRYPTION_KEY`,
bound to that household, and only its last four characters ever leave the
server. figgy never reads `ANTHROPIC_API_KEY` from its environment; for working
on figgy itself, `FIGGY_DEV_ANTHROPIC_API_KEY` stands in, outside production
only.

Without a key, every AI surface explains itself - to an admin, where to add
one; to anyone else, who to ask - and the manual path works exactly as before.
Nothing else in figgy depends on it.

Research runs after the response, so the proposal page opens straight away and
fills itself in. A run is stopped at 270 seconds, under the platform's limit,
and anything still marked running after ten minutes is given up on.

It works in two passes. The first searches the web, located near the garden,
and reports back in prose with its sources. The second turns that prose into
the month-by-month windows figgy stores. They are separate because web-search
citations and constrained JSON output cannot be asked for in one request — and
because it means the research notes survive in readable form next to each
proposed window.

**Nothing Claude produces reaches the schedule on its own.** A lookup writes a
proposal and nothing else; the schedule changes only when you tick windows and
press accept. Web pages are treated as material to summarise, never as
instructions.

`/settings` shows what has been spent, per lookup and in total.

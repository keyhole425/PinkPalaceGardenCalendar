# Design decisions

A log of what was decided about how figgy looks and reads, why, and what it
cost. Newest first. The commit bodies hold the full reasoning; this is the
index of it.

**Adding an entry:** when a change alters a token, a primitive, a pattern or a
voice rule, add an entry here in the same commit. Keep the shape:

```md
### YYYY-MM-DD - short name (commit)
**Context:** what was wrong or missing, with numbers if there are any.
**Decision:** what figgy does now.
**Cost:** what it gave up, recorded rather than quietly worked around.
```

---

## Open

Known gaps between these docs and the code, or between the code and its own
rules. Not fixed yet - each is a candidate change of its own.

- **Ask is unreachable on a phone.** `lib/nav.ts` says "Ask stays in the
  header", but the header's route links are `hidden` below `sm`, and Ask isn't
  one of the four `TABS`. Nothing else links to `/ask`.
- **Plant pages hand-roll their section headings.** `app/plants/[slug]/page.tsx`
  and `app/plants/[slug]/edit/page.tsx` write `<h2 className="font-semibold
  text-lg">` without `font-serif`, so they read differently from every `Card`
  heading; a `Card` (or `font-serif`) would fix it. The edit page also
  spaces its sections with `space-y-8` rather than `space-y-rhythm`.
- **A stale link.** "What it needs" on a plant page links to `/beds`, which now
  redirects to `/garden`.
- **`Button` variants `danger` and `pill` are unused.** The Ask suggestions are
  hand-rolled outlined pills (`components/ai/AskGarden.tsx`). Either the pill
  variant should match them, or they should use it.
- **Badge tone `warn` is unused.** Its one user was the "that is getting old"
  backup badge on `/settings`, which went with the home server. Keep it for the
  next stale-or-wrong fact, or remove it.
- **`Icon.tsx`'s doc comment says "nine shapes"**; there are fourteen.
- **PWA icons are missing.** `app/manifest.ts` lists `/icon-192.png` and
  `/icon-512.png`; `public/` only has `icon.svg`.
- **Harvest text on its fill is 4.22:1** - accepted (see 2026-09-28 below), but
  it is the one AA shortfall, so any new use of text on `bg-harvest` at small
  sizes needs the same redundancy.

---

### 2026-10-27 - the whole year on a phone
**Context:** at 375px the year grid showed under three months. Its scroll box
is 333px wide, and the sticky Plant and Action columns took 192px of it, so
July, August and most of September fitted and the rest was a sideways scroll
away. Truncating plant names would have bought 32px - less than one more
month - and turned "Unidentified tree" into "Unidenti…".
**Decision:** below `sm` the plant is a heading row of its own, the action
chip is a 64px column, and the twelve months share the rest at about 22px
each, headed by one letter. The whole year is on screen and you can read
down this month's column again. The wide table is unchanged from `sm` up.
Both tables draw their cells through one `MonthCell`. Cell labels lost their
`uppercase` ("or", as the page's description already wrote it), which closes
the last uppercase in the app.
**Cost:** two tables in the DOM, one hidden. The grid is 2,856px tall on a
phone, against 2,306px, because each plant's name row is a 44px tap target.
Months are one letter, with the full name in the `abbr`. A partial tick shows
only its fraction ("2/3") on a phone because "✓2/3" doesn't fit; the title
and screen-reader text say it in full.

### 2026-10-26 - sources only where there is one to open
**Context:** plant pages said where things came from even when that told
the gardener nothing: "From ORCHARD SCHEDULE.numbers, kept word for word"
under the notes, "from the spreadsheet" beside each starting rule, "the
spreadsheet left gaps" on needs review, and "the spreadsheet's *or* cells" in
the rule editor. Meanwhile a looked-up rule was labelled "yours", and an
accepted proposal no longer showed the pages Claude read.
**Decision:** the spreadsheet is no longer mentioned anywhere on screen.
A rule shows "yours" if someone made it, "looked up" plus the sites it came
from if Claude did, and nothing if figgy started with it. A looked-up plant's
notes say so and link to its proposal, which now keeps `SourcesRead` open
after it is accepted. `hostOf` moved to `lib/ui/` to be shared.
**Cost:** the sites are read back out of the rule's free-text `source_ref`
rather than stored as their own column. Good enough while accepting a
proposal is the only thing that writes it.

### 2026-10-26 - Overdue only when something is
**Context:** `/now` opened with an alert-toned Overdue list even when it was
empty, so the first thing read on most visits was "Nothing missed in the last
three months."
**Decision:** Overdue is left out when empty, the way Recently done already
was. The tour's `board` anchor moved to wrap Overdue and Due now together, so
it always has something to point at.
**Cost:** no positive "nothing missed" reassurance; an absent list has to say
it by not being there. The empty-state rule in [patterns.md](patterns.md)
now names this exception.

### 2026-10-26 - a first-run tour you can say no to
**Context:** people arriving from an invite have never seen figgy, and the
person who starts a garden has setting up to do that nobody else does.
**Decision:** two tours as data - setting up, for admins, then a look round,
for everyone - chosen on the server so a member never sees admin steps and
nobody is shown Claude in a household without a key. It begins as an offer in
a `palace-50` note at the top of the page, not a dialog, so nothing is
interrupted and nothing takes focus that was not asked for. Saying yes moves
a card from place to place; the thing it means gets the marker ring
(`palace-500`, as round the current month) rather than a dimmed page, so the
page stays readable and usable. On a phone the card is a sheet above the tab
bar, and the page gains that much room at its end so nothing near the bottom
is trapped under it. "Not now" lasts the visit, "No thanks" and "Skip the
tour" last until Settings brings it back, Esc puts it away and keeps the place.
**Cost:** an outline on a card that already has a border reads as two lines;
the 4px offset keeps them apart. A step whose element is missing - the
weather when the forecast failed - shows in the middle of the screen instead.

### 2026-10-26 - each household brings its own key
**Context:** figgy's Claude features ran on one key in the server's
environment. With households of friends that is somebody else's bill.
**Decision:** "Looking things up" on `/settings` is where an admin adds,
checks, replaces and removes the household's key; the page only ever shows
its last four characters. Every switched-off surface ends with `KeyNeeded`,
which points an admin at Settings and anyone else at their admin, instead of
naming an environment variable nobody using figgy can set. A proposal that is
still researching refreshes itself every four seconds rather than asking to be
reloaded.
**Cost:** a household with no key has no Claude features at all, and
somebody has to make an Anthropic account to get them.

### 2026-10-26 - accounts, and a link shown once
**Context:** figgy is moving to the internet and will hold more than one
garden, so it needs people to sign in, and a way in that nobody can find on
their own.
**Decision:** `/login` and `/join/[token]` live in an `(auth)` layout: the
same pink cover with the wordmark and nothing to tap, because every link
would lead back there. An invite link is shown once, in a `palace-50` note box
with Copy, and the page says figgy will not show it again - true, since only
its hash is kept. Removing someone sits behind a `<details>` "Remove", like
every other form that does more than the common case. Errors on these forms
are `role="alert"` so a screen reader hears a refused password.
**Cost:** a lost invite link cannot be shown again; the admin makes another.
On a 375px screen the invite form stacks the email above the role and the
button rather than sharing a row, which squeezed the email field to 58px.

### 2026-10-26 - no more home server
**Context:** figgy is moving from a Docker container on a Mac to Vercel. The
Backups card on `/settings` described a nightly sidecar that no longer exists,
and `rounded-lg` was still a token although rule 7 allows two radii and nothing
used it.
**Decision:** the Backups card is gone; backups become the hosted database's
job. `rounded-lg` is reset to `initial` like the larger radii, so it no longer
compiles. Copy that said "restart" now says "redeploy".
**Cost:** `/settings` no longer shows the age of the last backup, which was the
one warning that a backup job had died quietly. The hosted database's own
restore window has to stand in for it.

## 2026-10-26 - the design written down as docs

**Context:** the design language lived in the comment atop `globals.css`, in
each primitive's doc comment, and in commit bodies. Nothing gathered it.
**Decision:** `docs/design/` explains it; the code stays the source of truth for
values. A `figgy-ui-design` skill works from these docs.
**Cost:** two places to keep in step. Mitigated by the docs never copying
values, and by the rule that a design change updates its doc in the same
commit.

### 2026-09-28 - Rejoicify, Glinda and Wickedest (`6cc72ed`)
**Context:** the palette was a generic pink plus the spreadsheet's
green/orange/pink, and `palace-700` on the cover was 3.69:1.
**Decision:** three named OPI *Wicked* shades. The palace ramp anchored on
Rejoicify (326°). Each action colour gets soft / base / deep; harvest has no
deep because it *is* the palace pink. Fills carry `text-ink`. net, spray, water
and note go grey - a colour without a meaning is grey.
**Cost:** the three are nearly one colour to a red-green colourblind reader
(ΔE 3–7). Meaning moved into words and titles; hue only speeds scanning. Harvest
text on fill is 4.22:1.

### 2026-09-28 - the weather card reads like weather (`82ad56f`)
**Context:** "The week" over five bare numbers; nothing said weather.
**Decision:** a cloud and the city on the title, a sky icon per day from the
forecast, high over low, a caption for units, at most two advisories with only
frost and heat coloured, the source named.
**Cost:** a little more height on the rail.

### 2026-09-28 - the log behind a button (`567d335`)
**Context:** an open textarea above What's on took the top of the page and
pushed the whole rail down.
**Decision:** a dashed "Add a note" button inside the left column; the panel is
a `note` Card. Side-text hidden below `sm`.
**Cost:** one more tap to log a sentence.

### 2026-09-28 - say what "or…" opens (`7c2d9eb`)
**Context:** 11px of underlined "or…" in a 96px column.
**Decision:** "Date or note" with a pencil, a real target; the panel opens over
the card on `palace-50`, with Today/Yesterday and the date echoed in long form.
Still a `<details>`.
**Cost:** none worth recording.

### 2026-09-28 - settings is a cog (`3e76b11`)
**Context:** "Settings" read like a sixth place in the garden.
**Decision:** a 36px cog with an `aria-label`; the row is left to destinations.
**Cost:** 36px, under the 44px `tap` - accepted to keep the cover thin.

### 2026-09-28 - figgy's first icons (`28ac532`)
**Context:** every affordance was a word, some of them bad ones.
**Decision:** fourteen drawn paths in one file, one grid and weight,
`currentColor`. An icon is decoration (`aria-hidden`) or it is the control
(`title`). No third case.
**Cost:** new icons must be drawn, not installed.

### 2026-09-28 - scientific names in the serif (`e867c72`)
**Context:** binomials in the sans italic.
**Decision:** Fraunces italic via `ScientificName` - the one place the serif
appears outside a heading. Rows went to `text-sm` so the serif's smaller
x-height sits level.
**Cost:** a second italic file to carry.

### 2026-09-26 - cap the note on a task card (`94300f8`), stop Plum swallowing the year (`c9d1384`)
**Context:** long notes set the height of everything around them (a 1,312px
grid row; 118px cards against a median of 83).
**Decision:** clamp to two lines, the whole note on hover and on the plant's
page. Every row the same height.
**Cost:** the note is a hover away.

### 2026-09-26 - make what's on fit on a screen (`101472b`)
**Context:** 3,815px tall at 1440px wide; Done 1,300px from its plant.
**Decision:** a column of jobs and a rail of ambient things; Coming up folds;
long lists show eight. Recently done stays open as the proof a tap landed.
**Cost:** two layouts to think about, phone and desktop.

### 2026-09-26 - one garden (`8b303da`)
**Context:** Beds and Places were two pages over the same rows; the orchard had
no view.
**Decision:** one Garden page; Plants says it is the catalogue, not the garden;
rows say "2 growing" / "none planted"; an empty bed slot offers to sow.
**Cost:** old routes kept as redirects.

### 2026-09-26 - fonts vendored (`0ce6ad7`)
**Context:** `next/font/google` made every build need the network.
**Decision:** commit the `.woff2` files; latin subset; wght-only Fraunces.
**Cost:** the bytes live in the repo.

### 2026-09-26 - a garden notebook, written down as rules (`a8f9a6a`), and the same door for every page (`4839096`)
**Context:** nineteen colour tokens, no shared components; the primary button
copy-pasted into fourteen files, five drifted.
**Decision:** the seven rules in `globals.css`; scale tokens reuse Tailwind's
names; shadows deleted; the `components/ui/` primitives, with fourteen
buttons, twelve empty states, ~28 inputs, ~22 badges and four action maps
folded into them. `min-h-11` became `min-h-tap`.
**Cost:** none - the retune restyled ~300 call sites without touching them.

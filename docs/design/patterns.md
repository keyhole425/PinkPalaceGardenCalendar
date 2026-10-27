# Patterns

How the primitives are put together. Each pattern names a screen that already
does it - copy that, rather than this page, when in doubt.

## Page anatomy

Every page is:

```tsx
<Frame width="…">                          // pick by what the page holds
  <PageHeader title="…" description="…" actions={…} />   // or back={…}
  <div className="space-y-rhythm">
    <Card title="…">…</Card>
    <Card title="…">…</Card>
  </div>
</Frame>
```

- **One `<h1>`**, from `PageHeader`. Cards and sections are `<h2>`.
- **The description is one or two sentences** that say what the page *is*,
  especially when it could be confused with another ("This is the reference,
  not the garden").
- **`back`** on any page you reach by drilling in (a plant, a bed, a proposal,
  Add a plant): `'← Plants'`, `'← The garden'`.
- **`actions`** holds at most one primary action, or a status badge.
- The shell gives `main` its top padding and enough bottom padding to clear the
  phone tab bar. Don't add your own.

### Two columns: the board and the rail

What's on puts the jobs in a column and the ambient things - weather, what's in
season, what could go in - in a 20rem rail beside them:

```tsx
<div className="grid items-start gap-x-10 gap-y-rhythm lg:grid-cols-[minmax(0,1fr)_20rem]">
  <div className="space-y-rhythm">{/* what you have to do */}</div>
  <aside className="space-y-rhythm">{/* what is worth knowing while you do it */}</aside>
</div>
```

**Both columns start at the top of the page** - that is the whole argument for
having two. Don't put a full-width block above the grid. On a phone the rail
stacks under the column, so the column must hold what matters first.

### Fit the screen

A page should show what matters without scrolling, and the action should be
beside the thing it acts on. (What's on was 3,815px tall with Done 1,300px from
its plant; it is now 1,719px.) Tools for that:

- **`max`** on a list: show eight, fold the rest behind "Show the other 12".
- **`collapsible`** for a group worth knowing but not worth scrolling past
  (Coming up). Open it by default when there's nothing more pressing.
- **Keep confirmation open:** Recently done stays open because it is the proof
  a tap landed and the only way back from a mis-tap. Cap it instead.
- **Clamp long notes** to two lines (`line-clamp-2`) with the whole note in
  `title` and in full on the thing's own page. One long note must never set
  the height of everything around it (Plum's 2,526-character note once made
  its grid row 1,312px).
- **Things you use once a visit go behind a button**, not open on the page
  (Add a note).
- **Hide explanatory side-text below `sm`** if it wraps and costs more than it
  explains; the button should say enough on its own.

## Looking something up

`/plants` is the pattern:

- **A plain GET form** (`<search>` around a `<form action="/plants">`). The
  field is wrapped in its label ("Look up a plant"), with a real placeholder
  ("tomato, habanero or Solanum"), and **Look up** is the primary button
  beside it. It works before JavaScript loads, and a search is an address you
  can come back to.
- **Every word has to match something**: a name, a scientific name, a
  family, another name it goes by, or the plant it is a kind of. Plants come
  before their kinds, and your own plants before the library's.
- **Results are one ruled list** titled `Matching “chilli”` with a count. In
  results, a plant you already have says **yours**.
- **Nothing found** is an `EmptyState` that names what was typed, then
  offers both ways to add it: **Let figgy look it up** (`add` variant, with
  the name carried over) and **Or say what you know**.

## An article

A page about a thing, not a list of records (`/plants/[slug]`):

- **What you came to do goes first.** For a plant you grow, that's **Your
  garden** with its jobs. For one you don't, it's **Add to my garden** in the
  header.
- **Article text goes through `Prose`**, the same renderer as Claude's
  answers: a look-up's notes and a site admin's sections are Markdown.
  Anywhere only a line of it shows (the year grid's note, a `title`, a
  clamped preview) takes `plainText()` from `lib/ui/markdown.ts` instead,
  so no `##` or `**` ever reaches the page.
- **The opening paragraph** is held to the measure, followed by what's worth
  saying about this region as a `Callout` `note`, starting "In Adelaide:".
- **Sections that have nothing in them are left out**, not shown empty. When
  there's nothing beyond the facts, say so once, in a `quiet` Callout:
  "That's all figgy knows about habanero so far."
- **Facts are a ruled list** (At a glance): a label in `ink-soft`, then the
  value.
- **Inheritance is said once, in words**, under what inherits it:
  "Transplant is the chilli's." No badge on each row.

## Lists

- **Several records → `DataList` + `DataRow`** inside a `Card` with a `count`
  (Plants, Settings, a bed's history).
- **Several jobs → a `space-y-2` stack of bordered cards** (`TaskCard`), each
  with its own action on the right.
- **Group rather than paginate.** Plants are grouped by category, each group a
  Card with a count.
- **Each row says the fact that settles it.** A plant row says "2 growing" or
  "none planted" - that's what tells you whether it's about your garden - and
  "sow now" when this month is a sowing month here.
- **A row that only opens something is one target.** Stretch its link over
  the row (`after:absolute after:inset-0` on the link, `relative` on the row)
  instead of making one word of it tappable.
- **Uniform row height.** Clamp anything that could make one row tall.

## Forms

- Wrap each control in `Field`; style it with `inputClass` / `selectClass` /
  `textareaClass`.
- **The common case is one tap.** Done marks today. Everything else - a date,
  a note - is behind a `<details>` disclosure labelled with what it opens
  ("Date or note", with a pencil), so the form still works without
  JavaScript.
- **Shortcuts for the usual values** ("Today", "Yesterday") as small toggle
  buttons with `aria-pressed`.
- **Echo ambiguous input back in long form** ("27 September 2026", via
  `formatLong`) -
  `28/09` and `09/28` look the same until the day you back-date something.
- **A disclosure that needs room opens over the card**, not inside a narrow
  column: a 256px panel anchored to its button, on `palace-50` (a slip of paper
  laid on top). It must fit a 375px phone.
- **Server actions use `useActionState`**, and the submit `Button` gets
  `pending` + `pendingLabel`.
- **Errors sit beside the button** in `text-prune-deep text-sm`, saying what
  went wrong in plain words.
- **On success, say what happened** with a `check` icon in `fertilise-deep`:
  "Recorded 2 things."
- **When a form *is* a card**, use `<Card as="form">` rather than nesting.

## Empty states

Every list that can be empty renders `EmptyState` with a sentence in figgy's
voice - never a blank space, never "No items". An empty slot that you could
fill should **offer to fill it** ("Sow something") rather than saying "empty"
eight times. See [voice.md](voice.md#empty-states).

The exception is a list that only matters when it has something in it:
**Overdue** and **Recently done** on `/now` are left out entirely when empty,
rather than saying so every visit.

## Talking to the user: Callout, Badge, inline text

| Need | Use |
|---|---|
| A sentence of context about the page | `Callout` `note` |
| The outcome of something (worked / failed / thrown away) | `Callout` `good` / `warn` / `quiet` |
| A short fact attached to a row | `Badge` |
| A field or action failed | inline `text-prune-deep text-sm` beside it |
| Something just worked | inline `check` icon + sentence, or a `fertilise-soft` strip |
| Nothing to show | `EmptyState` |

## Colour on a surface

- An action is shown with `ActionChip` (named) or a `MonthStrip` / grid cell
  (filled, with a title).
- A **group** of one action can sit on that action's soft wash with its border
  (Harvesting now on `harvest-soft`, Could be sown now and Could be planted
  out now on `fertilise-soft`).
- **Overdue** is the prune wash on the card (`border-prune bg-prune-soft/50`)
  and `alert` on the section heading.
- **Today** is the `palace-50` wash (the grid column, the weather day), with
  `palace-300` border where it's a box.
- Colour two things in a set at most. The weather card colours frost and heat
  and leaves rain, wind and cold in ink: "a week with five coloured icons in it
  is a week with nothing to notice."

## AI surfaces

figgy's Claude features (log a sentence, ask your garden, look a plant up)
follow one pattern:

1. **Say, check, commit.** Claude's output is a draft you look at before
   anything is written. "Nothing is saved until you say so." Anything Claude
   couldn't match (no plant) can't be committed and is shown in the prune wash.
2. **Everything ticked to start with**, because the common case is that it's
   right. Untick what you disagree with. Unticked items go dashed, sunk and
   faded.
3. **Say what Claude can and can't do** next to the button: "Claude reads your
   records. It cannot change them."
4. **Show confidence** where Claude gives it: high on `fertilise-soft`, medium
   on `palace-100`, low on `prune-soft`.
5. **Explain when unavailable.** With no key, the surface is an
   `EmptyState` that says what figgy could do, who can switch it on
   (`KeyNeeded`: an admin is pointed at Settings, anyone else at their admin),
   and that the manual path still works: "You can always tick things off by
   hand."
6. **Pending labels say what's happening:** "Reading…", "Looking…".
7. **Claude's prose** goes through `components/ai/Prose.tsx` - headings, bold,
   italics and bullets, no raw HTML.
8. **What Claude looked up keeps its sources.** A looked-up rule lists the
   sites it came from beside it ("From abc.net.au"); a looked-up plant's notes
   link to the proposal, which keeps `SourcesRead` after it is accepted.
   Anything figgy started with or someone typed carries no source line at all:
   only a source someone could open is worth naming.

## The weather card

`components/weather/WeatherStrip.tsx`:

- A `Card` titled "Weather" with a cloud icon and the city in the `aside`.
- Five days, `grid-cols-5`; today on the palace wash with its label in
  `palace-700`; "Today", "Tmrw", then weekday.
- A sky icon per day, **drawn from the forecast** (a cloud on Thursday means
  Thursday is cloudy). Each icon has a `title` because it carries meaning.
- High over low, the low in `ink-soft`; rain with a droplet only when ≥1mm.
- A caption spells out units, because "26 over 10" is only obvious once you
  know.
- At most **two** advisories, each with its own icon; only frost (palace) and
  heat/storm (prune) get colour.
- **Name the source** underneath. A silent fallback would look like the Bureau
  changing its mind.

## The year grid

`components/grid/MonthGrid.tsx`, at `Frame width="wide"`:

- A row per plant per action, labelled with the action word (the meaning lives
  in the word, not the hue).
- Filled cells in the action's fill, `rounded-sm`; each has a `title` (the note
  or "Prune - March").
- "or" in a cell means one of several alternatives; a tick means work recorded
  in the last year (✓ or ✓2/3).
- The current month's column is the `palace-50` wash.
- The year starts in July by default (the orchard year), with a toggle to
  January.
- A plant's notes show their first sentence, clamped to two lines.
- **On a phone (below `sm`) the whole year fits on screen.** The plant is a
  heading row above its action rows, the action chip is the only other
  column, and the months are one letter each (the full name in an `abbr`),
  like `MonthStrip`. Notes are left to the plant's page, and a partial tick
  shows just its fraction ("2/3"). Both layouts draw their cells through
  `MonthCell`, so a change to what a cell says happens once.

## Navigation

- **Pages and their names live in `lib/nav.ts`.** `label` is the page title,
  `short` is what fits in a nav. Add a destination there, not inline - they
  were kept together after a tab said "Beds" over a heading saying "Beds and
  the hothouse".
- **Phones:** the first four routes (`TABS`) as a bottom tab bar, in thumb
  reach. No hamburger. (The header's route links are `hidden` below `sm`, so
  on a phone Ask currently has no way in - see
  [decisions.md](decisions.md#open).)
- **`sm` and up:** all five as links in the header.
- **Settings is a cog,** because it's the one thing in the header that isn't a
  place in the garden.
- Retired routes redirect (`/beds`, `/environments` → `/garden`; `/` → `/now`).

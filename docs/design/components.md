# Components

The primitives in `components/ui/` are what every screen is built from. Before
writing a class string, check whether one of these already does it - the
reason they exist is that the same button had been copy-pasted into fourteen
files and five had drifted.

Each file's doc comment is the authority on its details. This page is the
"which one, and when" guide.

**Conventions shared by all of them:**

- Variants are single-axis lookups of **complete literal class strings**
  (`VARIANT`, `TONE`, `WIDTH` maps). Tailwind scans source text, so a class
  built at runtime never compiles. Add a variant by adding a whole string to
  the map, never by interpolating.
- `className` is for layout only - margin, width, order. Not colour or type;
  if you need a different colour, you need a different variant (or you don't).
- Join classes with `cx()` from `lib/ui/cx.ts`. Not `clsx`.
- No component imports a UI library.

---

## Layout

### `Frame` - the width a page may take

`width`: `measure` | `list` | `page` (default) | `wide`. Adds the page gutters.
Every page's outermost element. See the width table in
[foundations.md](foundations.md#widths-frame).

```tsx
<Frame width="list">…</Frame>
```

### `PageHeader` - the top of every page

`title` (required, becomes the one `<h1>`), `eyebrow` (line above, sentence
case), `back` (`{ href, label }` - replaces the eyebrow with a link, written
`'← Plants'`), `description` (a sentence, held to `max-w-measure`), `actions`
(right-hand side: usually one `ButtonLink` or a `Badge`).

```tsx
<PageHeader
  back={{ href: '/plants', label: '← Plants' }}
  title="Add a plant"
  description="…"
  actions={<ButtonLink href="/plants/new">Add a plant</ButtonLink>}
/>
```

Use it on every page. Don't write a bare `<h1>`.

### `Card` - a titled block of a page

Renders a real `<section>` with a real `<h2>` (serif, semibold, `text-lg`).
`title`, `icon` (decoration before the title), `count` (quiet number after it),
`aside` (right of the heading row), `as` (`section` | `form` | `div` - use
`form` when the card *is* the form, rather than nesting one inside).

Tones:

| Tone | Looks like | Use |
|---|---|---|
| `plain` (default) | no box - heading over content | most cards |
| `alert` | title in `prune-deep` | a group that needs attention |
| `sunk` | `paper-sunk` box | a recessed, secondary panel |
| `note` | `palace-50` box, `palace-300` border | figgy talking, an open composer (LogSentence) |

Note `plain` has no border: a card is a titled region of paper, not a floating
box (rule 1). The box comes from what is inside it (a `DataList`).

---

## Lists

### `DataList` / `DataRow` - the ruled list

"The notebook's default way of showing several of anything." `DataList` is a
`ul`/`ol` with `divide-y divide-rule-faint` inside a `rounded-md border-rule`
box. `DataRow` is a wrapping flex row at `text-sm`; its `action` prop is pushed
to the right (an Edit link, a count, a button).

```tsx
<Card title="Fruit" count={plants.length}>
  <DataList>
    {plants.map((p) => <DataRow key={p.id} action={…}>…</DataRow>)}
  </DataList>
</Card>
```

Use this for any list of records. Use a `space-y-*` stack of bordered `li`s
instead only when each item is a self-contained card with its own action, like
`TaskCard`.

### `EmptyState` - nothing here yet

A dashed `rule` box with `ink-soft` text. Every empty list says so with this,
in one voice ([voice.md](voice.md#empty-states)). Also used when an AI surface
can't run (no API key) - the explanation is the empty state.

```tsx
<EmptyState>Nothing needs doing today.</EmptyState>
```

---

## Actions

### `Button` / `ButtonLink`

Same variants; `Button` is a `<button>` (defaults to `type="button"`),
`ButtonLink` is a Next `<Link>`.

| Variant | Looks like | Use |
|---|---|---|
| `primary` (default) | `palace-200` fill, `palace-700` text, `min-h-tap` | **the** thing to do here. One per region. |
| `quiet` | underlined `ink-soft` text | secondary: Cancel, Edit, Show more |
| `danger` | underlined `ink-soft`, `prune-deep` on hover | destructive: Remove, Clear, Undo. Quiet until you mean it. |
| `add` | dashed `palace-300` border | adds or opens something new: "Add a note" |
| `pill` | `rounded-full palace-100` | a choice in a row of choices |

`danger` and `pill` are defined but not used yet: the Ask suggestions are
hand-rolled outlined pills (see [decisions.md](decisions.md#open)). Reach for
the variants first in new work.

`size="sm"` shrinks `quiet` and `danger` to `text-xs`. `pending` +
`pendingLabel` disable the button and swap its label while a server action
runs - always give one, in the present participle with an ellipsis where it
waits on Claude: "Saving", "Reading…", "Looking…".

There is no red button. Destruction is quiet text that turns coral on hover.

### `ActionChip` - a care action, named and coloured

"The most-reused piece in figgy." The action's label on its fill, `rounded-sm`,
`text-xs font-medium`, `text-ink`. Takes any action string; unknown actions
fall back to grey.

```tsx
<ActionChip action="prune" />
```

Use it wherever a care action is named next to a plant. Don't build a chip by
hand from `actionChip()`.

---

## Labels and status

### `Badge` - a small ring of colour against a word

`rounded-full`, `text-xs`. **Never pressable** - if it does something, it's a
`Button` (`pill`). Give it a `title` when the word needs explaining ("shifted",
"one of 3", "early inside").

| Tone | Use |
|---|---|
| `palace` (default) | neutral annotation: "shifted", "one of 3", "early inside", "2 months ahead" |
| `strong` | a flag that wants doing something about: "needs review" |
| `quiet` | a status that is just a fact: a proposal's or a planting's status |
| `good` | a fact in your favour: "2 growing", "frost free" |
| `warn` | something going stale or wrong (nothing uses it at the moment) |
| `harvest` | when a crop is ready: "ready about 3 Jan – 20 Jan" |

Badge text is lower case, because it is a fragment of a sentence, not a label.

### `Callout` - something figgy wants to say about what you are looking at

| Tone | Use |
|---|---|
| `note` (default) | figgy's aside: a left `palace-300` rule on `palace-50`, like a margin note |
| `good` | it worked / this is fine (a proposal accepted) |
| `warn` | something needs attention (a proposal failed; a plant family repeated in a bed) |
| `quiet` | neutral information, recessed (a proposal rejected) |

Use for a sentence or two of context about the page. Not for errors on a single
field (put those beside the field in `prune-deep`), and not for empty lists
(`EmptyState`).

---

## Forms

### `Field` - a labelled control

The `<label>` **wraps** its control (no ids needed; `getByLabel` depends on it).
`label`, optional `hint` (`ink-faint`, `text-xs`, under the control).

The control classes are exported, not applied for you, so each input keeps its
own props:

| Export | For |
|---|---|
| `inputClass` | text, number and date inputs - `min-h-tap`, `rounded-md`, `border-rule` |
| `selectClass` | selects (same as `inputClass`) |
| `textareaClass` | textareas (no min height) |

```tsx
<Field label="Common name" hint="What you call it in the garden.">
  <input name="commonName" required className={inputClass} />
</Field>
```

---

## Data display

### `MonthStrip` - a window as twelve little boxes

Takes the `action` and the `monthMask` exactly as the schedule stores them.
`startMonth` (default July - the orchard year), `currentMonth` (gets the
`palace-500` ring), `labelled` (adds the row of month initials). Each cell has
a `title` and an sr-only "January: prune".

### `ScientificName` - a botanical binomial

Fraunces italic in an `<em>` (a shift in kind of language, not just
appearance). Use for every scientific name.

### `Icon`

See [foundations.md](foundations.md#icons). Decoration beside a word: no
`title`. The icon *is* the control: give it a `title` (and the control an
`aria-label`).

---

## Shell (not primitives, but shared)

- `components/shell/SiteHeader.tsx` - the pink cover: wordmark, the five
  `ROUTES` as `NavLink`s from `sm` up, and the settings cog. `TabBar` - the
  four `TABS` fixed to the bottom on phones, safe-area padded.
- `components/shell/NavLink.tsx` - `NavLink` / `TabLink`, active via
  `aria-current="page"` (prefix match, so `/plants/fig` keeps Plants lit).

## Feature components worth knowing

Not primitives, but they set the patterns new work should follow:

- `components/tasks/TaskCard.tsx` - a job: chip, plant, window and timing,
  clamped note, Done on the right. Overdue gets the prune wash.
- `components/tasks/Section.tsx` - a group of jobs with count, empty text,
  `max` (show N, fold the rest behind "Show the other N"), and `collapsible`.
- `components/tasks/DoneForm.tsx` - one-tap Done, with "Date or note" behind a
  `<details>` that opens over the card.
- `components/ai/LogSentence.tsx` - say → check → commit.
- `components/ai/ProposalReview.tsx` - Claude's proposal, everything ticked,
  untick what you disagree with, then accept.
- `components/weather/WeatherStrip.tsx` - the weather card.
- `components/grid/MonthGrid.tsx` - the year.

## Adding a new primitive

Only when the same markup appears in two or more places, or is about to.
Then: a file in `components/ui/`, a doc comment saying what it is for in one
sentence and why it exists, variants as a complete-string map, `className` for
layout only, and an entry on this page in the same commit.

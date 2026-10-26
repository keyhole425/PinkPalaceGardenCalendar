# Foundations

Values live in `app/globals.css`. This page says what each token is **for**.
Use the token names as Tailwind utilities (`bg-palace-200`, `text-ink-soft`,
`max-w-measure`, `min-h-tap`) - never a raw hex or an arbitrary `[...]` value
where a token exists.

## Colour

### The three named colours

All three are OPI *Wicked* nail-lacquer shades:

| Name | Value | Is | Means |
|---|---|---|---|
| **Rejoicify** | `#cd7baa` mauve pink | `palace-500`, `harvest` | the cover, the marker, and the harvest |
| **Glinda** | `#f0a19a` warm coral | `prune` | prune, and every warning figgy gives |
| **Wickedest** | `#abc590` sage green | `fertilise` | fertilise, and every confirmation |

### The palace ramp (the pink)

Hue-anchored on Rejoicify at 326°, so the pink *is* that colour rather than near
it.

| Token | Use |
|---|---|
| `palace-50` | the "today" wash; the wash a note or slip of paper sits on |
| `palace-100` | badges (`palace` tone), pills, the current month's empty cell |
| `palace-200` | **the cover**: header background, primary button, `strong` badge |
| `palace-300` | hover on the primary button; borders of palace-tinted things |
| `palace-500` | **the marker**: Rejoicify itself; the ring round the current month |
| `palace-700` | pink you can read: labels, the active nav, hover on links, the focus ring |

`palace-700` is deliberately deeper than a pink usually wants to be: it is the
text on `palace-200` in the header and the primary button, and needs AA there.

### Action colours

Three steps each, no more (rule 6):

| | soft (wash) | base (fill) | deep (text) |
|---|---|---|---|
| fertilise | `fertilise-soft` | `fertilise` | `fertilise-deep` |
| prune | `prune-soft` | `prune` | `prune-deep` |
| harvest | `harvest-soft` | `harvest` | - use `palace-700` |

Which action gets which colour is in `lib/ui/actions.ts`, and nowhere else:

| Colour | Actions |
|---|---|
| fertilise (green) | fertilise, sow, transplant |
| prune (coral) | prune, thin |
| harvest (pink) | harvest |
| `rule-strong` (grey) | net, spray, water, note |

Always go through `actionFill()`, `actionChip()` and `actionLabel()` (or the
`ActionChip` / `MonthStrip` components). Never write a second action → colour
map: there used to be four and they drifted.

**Fills carry `text-ink`, never `text-white`.** White on these is 1.9–3.0:1.

### Status colour outside actions

The action palette doubles as figgy's status palette:

- **Confirmation / good:** `fertilise-soft` wash, `fertilise` border,
  `fertilise-deep` for an icon or text. (Badge `good`, Callout `good`, "Recorded
  2 things.")
- **Warning / alert / overdue:** `prune-soft` wash, `prune` border,
  `prune-deep` for text. (Badge `warn`, Callout `warn`, Card/Section `alert`,
  an overdue TaskCard, a heat or storm forecast.)
- **Note / figgy speaking:** `palace-50` wash, `palace-300` border. (Callout
  `note`, Card `note`.)
- **Neutral / quiet:** `paper-sunk` wash, `rule` border, `ink-soft` text.

### Neutrals

| Token | Use |
|---|---|
| `ink` | content - anything you came to read |
| `ink-soft` | apparatus - labels, counts, timings, descriptions |
| `ink-faint` | the quietest - field hints, captions, credits, "show/hide" |
| `rule-faint` | lines inside lists and the grid |
| `rule` | the border round a box; input borders |
| `rule-strong` | the frame round the year; the grey "no meaning" fill |
| `paper` | the page |
| `paper-sunk` | a recessed panel, an empty month cell, a quiet badge |
| `focus` | the focus ring (the same ink as `palace-700`) |

### Contrast, and what it costs

Recorded in `globals.css` and commit `6cc72ed`:

- `palace-700` on `palace-200` (header, primary button) is 6.34:1; on paper,
  9.48:1.
- `text-ink` on the fertilise / prune / harvest fills is 6.69 / 6.18 /
  4.22:1. Harvest's 4.22 is just under AA for the 11px tick in the year grid -
  **accepted**, because the tick repeats what the cell's `title` and its
  sr-only label already say.
- **To a red-green colourblind reader the three action colours are very nearly
  one colour** (CIE76 ΔE 3–7). So meaning never lives in hue alone: the year
  grid labels each row with its action word and gives each cell a title. Hue
  is what makes it quick to scan, never what makes it mean anything. Any new
  colour-coded surface must do the same.

## Type

Two families, from `app/fonts/index.ts`, vendored as `.woff2` so a build needs
no network and a font revision upstream cannot change how figgy looks.

- **Fraunces** (`font-serif`) - the notebook's handwriting, kept restrained.
  Page and card headings (`font-semibold font-serif`), and scientific names in
  italic via `ScientificName` - the one place it appears outside a heading.
- **IBM Plex Sans** (`font-sans`, the default) - everything that has to line
  up: body, labels, dates, temperatures, counts. 400 / 500 / 600 plus a real 400
  italic. Its figures are properly tabular: use `tabular-nums` on any number
  that sits in a column or changes in place.
- **IBM Plex Mono** (`font-mono`) - only for the handful of `<code>` spans in
  settings and ask. Not preloaded.

"Fraunces thinks and IBM Plex Sans counts."

### Scale

The scale tokens reuse Tailwind's own names, so retuning them in `globals.css`
retunes every call site.

| Utility | Use |
|---|---|
| `text-2xs` | figgy's own: grid cell labels, month letters, forecast details, weather caption |
| `text-xs` | hints, badges, chips, timings, secondary lines |
| `text-sm` | the working size: body, rows, buttons, inputs, descriptions |
| `text-base` | the body default; nothing sets it explicitly today |
| `text-lg` | card and section headings (serif, semibold); the wordmark |
| `text-xl` | defined, unused - between a card heading and a page title |
| `text-2xl` | the page title (serif, semibold) - one per page |
| `text-eyebrow` | the line above a page title; size, leading, tracking and weight in one utility. Sentence case. |

Weights: `font-medium` to emphasise, `font-semibold` for headings only (rule 3).

## Space and width

### Widths: `Frame`

The shell declares no content width; each page picks one with `<Frame width>`.
"Content takes the width it can use, never the width available."

| Width | For |
|---|---|
| `measure` | reading and single forms: Ask, Add a plant. Also the description under a page title. |
| `list` | a column of rows: Plants, a plant, a bed, Settings, a proposal |
| `page` | a board with a column and a rail: What's on, The garden |
| `wide` | the twelve-month year grid |

### Spacing tokens

The numeric scale is Tailwind's. These four are design decisions:

| Token | Use |
|---|---|
| `gutter` / `gutter-lg` | page side padding (inside `Frame`; `lg:` for the larger) |
| `rhythm` | the gap between the blocks of a page (`space-y-rhythm`, `gap-y-rhythm`, `mb-rhythm` under the header) |
| `tap` | 44px - the minimum height of anything you press (`min-h-tap`). Say `min-h-tap`, not `min-h-11`: it says why. |

Inside a card, use `space-y-2`; between list items `space-y-1` / `space-y-2`.

## Radii

| Utility | For |
|---|---|
| `rounded-sm` | things printed on the page: month cells, action chips |
| `rounded-md` | things you can press, and the boxes and inputs that hold them |
| `rounded-full` | badges and pills only |

`rounded-lg` and larger are removed from the theme, so they do not compile.

## Elevation

None. `shadow-*`, `inset-shadow-*` and `drop-shadow-*` are deleted from the
theme. Depth is a hairline rule or a `paper-sunk` wash.

## Icons

`components/ui/Icon.tsx` is figgy's only pictures: hand-drawn paths on one 24px
grid, one stroke weight (1.75), `currentColor`. An icon is the same ink as the
text beside it and takes its size from the class (`h-4 w-4` by default; a
heading icon is `h-[1.05em] w-[1.05em]`), not a prop.

The names: sun, cloud, showers, rain, storm, frost, thermometer, wind, droplet,
pencil, settings, calendar, close, check.

**The one rule:** an icon is either decoration beside a word - and then it is
`aria-hidden`, the default - or it *is* the control, and then it takes a
`title` and becomes an image with a name. There is no third case, and nothing
should announce itself twice.

New icons are drawn into `Icon.tsx` to the same grid and weight. Do not install
an icon package.

## Theme colour

The browser/PWA theme colour is `palace-200` (in `app/layout.tsx` and
`app/manifest.ts`), so the status bar matches the cover.

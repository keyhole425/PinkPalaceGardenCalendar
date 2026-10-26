# Principles

## The metaphor: a garden notebook

figgy began as `ORCHARD SCHEDULE.numbers`, a spreadsheet, and its tokens were
always named for paper and ink: `paper`, `paper-sunk`, `ink`, `rule`. The design
language is that metaphor taken seriously. A page is a sheet of paper. Things
on it are written in ink and separated by ruled lines. The pink is the cover.
Colour is reserved for the three things the orchard spreadsheet coloured:
feeding, cutting and picking.

And it is a notebook you use **standing in a garden holding a phone**, often
with dirty hands. That second fact decides as much as the first: thumb-sized
targets, the common action as one tap, nothing that needs precision or a second
hand, and a page that tells you what matters before you scroll.

## The seven rules

These are the rules at the top of `app/globals.css`, with the reasoning that
goes with each.

### 1. Paper, not floating cards

Surfaces are `paper` or `paper-sunk`. Things are separated by a hairline rule,
never by a shadow. The shadow utilities are **deleted** in `globals.css`, not
merely unused, so `shadow-md` does not compile and the rule cannot quietly rot.

*Why:* a notebook has no depth. Depth would also be the first thing to drift -
one card with a shadow invites the next.

### 2. Ruled lines do the work

Several of anything is a ruled list: `divide-y divide-rule-faint` inside one
`border-rule` box. That is what `DataList` is. There are three line weights:
`rule-faint` inside lists and the grid, `rule` around boxes, `rule-strong` for
the frame around the year.

*Why:* a notebook's ruled lines are lighter than its margins. Lines group;
whitespace and boxes are not needed to do it.

### 3. Two inks, one emphasis step

`ink` for content, `ink-soft` for apparatus (labels, counts, hints, timings).
`ink-faint` exists for the very quietest notes - captions, credits, field
hints. Emphasis is `font-medium`; `font-semibold` is only for headings.

*Why:* fewer levels means each one is legible as a level. Bold everywhere is
emphasis nowhere.

### 4. The pink is the cover and the marker, not the paper

Rejoicify is figgy's pink. `palace-200` is the cover (the header) and the
primary button. `palace-50` / `palace-100` are the "today" and "this is a note"
washes. `palace-500` - Rejoicify itself - is the marker: the ring round the
current month. `palace-700` is the pink you can read: labels, the active tab,
links on hover. **Never a large pink field.**

*Why:* pink everywhere is no pink anywhere, and a page of pink is not paper.

### 5. Action colours are data, never decoration

fertilise / prune / harvest still carry the orchard spreadsheet's reasoning:
green to feed, warm to cut, pink to pick. The grid reads the way it always has.
**Any new colour has to carry a meaning, and a colour without one is grey:**
net, spray, water and note fill with `rule-strong`, not with pink - otherwise a
watering looks exactly like a harvest.

The same three double as the app's emotional palette: Wickedest (the fertilise
green) is every confirmation, Glinda (the prune coral) is every warning.

*Why:* if colour is decoration it stops meaning anything, and the year grid
depends on it meaning something.

### 6. Three steps per action colour, and no more

`NAME-soft` is the wash a panel is written on. `NAME` is the filled block.
`NAME-deep` is the one dark enough to be text. A fill carries `text-ink` -
**never `text-white`**, which these colours are far too pale to take. Harvest
has no deep step: harvest *is* the palace pink, so its text is `palace-700`.

### 7. Two radii

`rounded-sm` for things printed on the page (month cells, chips). `rounded-md`
for things you can press, and the boxes that hold them. `rounded-full` only for
badges and pills. `rounded-xl` and up are removed from the theme.

## Non-goals

- **Dark mode.** Paper and ink *is* the metaphor; a dark figgy would need a
  second one. If it is ever wanted, it is an override of the colour tokens in
  `globals.css`, not a change to any component.
- **Shadows and elevation.** See rule 1.
- **UI libraries.** No component kit, no icon package, no `clsx`. The
  primitives are small files in `components/ui/`, the icons are drawn paths,
  and `cx()` in `lib/ui/cx.ts` is six lines. A dependency would be the first
  runtime UI dependency in the app and has to argue its way in.
- **Shouting.** No uppercase headings or labels; sentence case throughout.
- **Decoration.** An icon, a colour or a badge is there because it says
  something. If it says nothing, it goes.

## How to apply them

When a design question comes up, ask in this order:

1. **What is this screen's job, for someone standing in the garden?** What do
   they need to see first, and what is the one thing they will tap?
2. **Does a primitive already do this?** Reach for `components/ui/` before
   writing a class string. Most screens are Frame, PageHeader, Card, DataList,
   Button and EmptyState.
3. **Is there a colour here that doesn't carry a meaning?** Make it ink or grey.
4. **Would it survive on a 375px phone?** Tap targets, wrapping, what is above
   the fold.
5. **Does the copy say what it does?** See [voice.md](voice.md).

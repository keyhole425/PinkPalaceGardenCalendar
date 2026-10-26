---
name: figgy-ui-design
description: >
  Design, build and review figgy's UI the way figgy is designed - the garden
  notebook (paper and ink, the Rejoicify / Glinda / Wickedest palette, the
  components/ui primitives, calm sentence-case copy, mobile-first for someone
  in the garden holding a phone). Use it whenever a request touches what
  someone sees or reads in figgy, even without the word "design": a new or
  changed page, screen, card, list, form, button, badge or empty state;
  layout, spacing, colour, type, icons; wording, labels, titles, placeholders,
  error messages; navigation or the tab bar; how it works on a phone;
  accessibility (contrast, tap targets, focus, screen readers); or reviewing a
  diff or page for UI/UX problems. Also for "this feels cluttered", "make X
  clearer", "add a screen for Y", "what colour should Z be". Not for schedule
  maths, database, Claude prompt internals, weather fetching or deployment -
  unless the change alters what appears on screen.
---

# figgy UI/UX design

figgy is a garden notebook used standing in a garden holding a phone. Its design
language is deliberate and written down: the knowledge is in `docs/design/`,
the values are in `app/globals.css` and `components/ui/`. This skill is how to
work from them so that new UI looks like it was always there, and so that the
docs stay true.

## 1. Orient first (every time)

Read `docs/design/principles.md` - it's short and everything else follows from
it. Then read only what the task needs:

| Task touches | Read |
|---|---|
| colour, type, spacing, width, radius, icons | `docs/design/foundations.md` |
| which component to use, or making a new one | `docs/design/components.md`, then the component's own file |
| page structure, lists, forms, empty states, AI surfaces, weather, grid, nav | `docs/design/patterns.md` |
| a specific route, or adding one | `docs/design/screens.md`, `lib/nav.ts` |
| any words on screen | `docs/design/voice.md` |
| contrast, targets, focus, screen readers | `docs/design/accessibility.md` |
| "why is it like this?" / known gaps | `docs/design/decisions.md` |

Then read the code you're changing and the nearest existing screen that does
something similar - the docs name one for most patterns. The code wins if it
disagrees with a doc; note the drift and fix the doc.

### The rules that are easiest to break

Keep these in mind while writing any markup; each has its reason in
`principles.md`.

- No shadows (they're deleted from the theme - `shadow-*` won't compile).
  Separate with a hairline `rule` / `rule-faint`, or a `paper-sunk` wash.
- No `text-white` on an action fill; fills carry `text-ink`.
- No large pink fields. `palace-200` is the cover and the primary button;
  washes are `palace-50`/`palace-100`.
- No colour without a meaning. Colour is fertilise / prune / harvest (and their
  confirmation / warning roles); anything else is ink or grey. Never let hue
  alone carry meaning - add the word or a `title`.
- No uppercase. Sentence case everywhere.
- Radii: `rounded-sm` printed, `rounded-md` pressable, `rounded-full` badges.
- No UI libraries, no icon packages, no `clsx` - use `components/ui/*`,
  `Icon`, and `cx()`.
- Variant maps hold complete literal class strings; never build a class name
  at runtime.
- Anything pressable is `min-h-tap` (44px).
- Use tokens (`max-w-measure`, `space-y-rhythm`, `text-ink-soft`), not raw hex
  or arbitrary `[...]` values where a token exists.

## 2. Pick the mode

A request is usually one of these, sometimes several in sequence (design →
implement → sync docs).

### Design something new

Start from the job, not the components: who is standing where, what do they
need to see first, what is the one thing they'll tap? Then:

1. Choose the `Frame` width by what the page holds (`measure` / `list` /
   `page` / `wide`).
2. Sketch the structure as primitives - `PageHeader`, `Card`s, `DataList`,
   `Section`, `EmptyState` - and say where the primary action sits.
   `references/page-template.md` has the skeleton.
3. Write the actual copy - title, description, button labels, empty state,
   placeholder, error - in figgy's voice. Copy is part of the design, not a
   later pass.
4. Say how it behaves at 375px and what's above the fold.
5. If there are real alternatives, give two at most with a recommendation and
   the trade-off. For anything bigger than a small tweak, agree the design
   before building it.

Prefer composing existing primitives. Propose a new primitive only when the
same markup is needed in two or more places.

### Review

Walk `references/review-checklist.md` over the diff, branch or page. Report
findings ordered by how much they matter to someone using figgy, each with:

- `file:line`
- what's wrong, concretely
- which rule or doc it breaks (e.g. "principles rule 5", "voice.md - empty
  states")
- the fix, in figgy's terms (the primitive, token or wording to use)

Separate real breaks from taste. If something breaks a rule on purpose and
says why (a comment, a `decisions.md` entry), it isn't a finding. If nothing is
wrong, say so plainly - don't pad.

### Implement and verify

Build with the primitives and tokens. Match the surrounding code: tabs, single
quotes, doc comments that explain *why*, in the same voice as the existing
ones. Then check it actually works:

1. `npm run lint` and `npm run typecheck`.
2. Start the preview with the `figgy` launch config (`preview_start`
   `{name: "figgy"}`; it runs `npm run dev` on port 3000). If pages error on
   the database, `npm run db:reset` creates and seeds it.
3. Resize to mobile (375×812) and load the page you changed. Check the console
   for errors, `read_page` for structure (one `h1`, real `h2`s, labelled
   controls), and tap the thing you built.
4. Check desktop width too if the layout has a breakpoint.
5. Take a screenshot at phone width and share it as proof.

If verification isn't possible (no preview tools, no database), say exactly
what was and wasn't checked.

### Keep the docs in sync

Before finishing, ask: did this change add or alter a token, a primitive or
variant, a pattern, a route, or a voice rule? If yes, in the same change:

- Update the matching `docs/design/*.md` page. Describe the token or component
  and what it's for; don't copy hex values or pixel sizes into the docs - they
  live in the code.
- Add an entry to the top of `docs/design/decisions.md` (date, commit if
  known, context / decision / cost), in the plain register of the existing
  entries.
- If it fixes an item under "Open" in `decisions.md`, remove it from there.
- If you notice drift between the docs and the code that you aren't fixing,
  add it under "Open".

If the change only uses what's already documented, leave the docs alone.

## Commits

If asked to commit: `figgy: ` + a lower-case, plain-English subject about the
user-visible outcome ("figgy: say what "or..." opens"). The body is prose
explaining why, with before/after numbers where there are any (heights,
contrast ratios), and trade-offs recorded rather than hidden.

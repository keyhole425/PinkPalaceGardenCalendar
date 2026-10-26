# figgy's design

figgy is a garden notebook. These pages write down how it looks, reads and
behaves, and why - so a new screen comes out looking like it was always there.

Read them in this order the first time:

1. [principles.md](principles.md) - the metaphor and the seven rules. Everything
   else follows from these.
2. [foundations.md](foundations.md) - colour, type, space, radii, icons.
3. [components.md](components.md) - the primitives in `components/ui/`, and
   when to reach for each.
4. [patterns.md](patterns.md) - how the primitives are put together: page
   anatomy, lists, forms, empty states, AI surfaces, the weather card, the grid.
5. [screens.md](screens.md) - every route, its job and what it is built from.
6. [voice.md](voice.md) - how figgy talks.
7. [accessibility.md](accessibility.md) - targets, focus, contrast, names.
8. [decisions.md](decisions.md) - what was decided, when, and what it cost.
   Also the list of known gaps.

## Where the truth lives

These docs explain. They do not hold values. When a doc and the code disagree,
the code is right and the doc is stale.

| What | Source of truth |
|---|---|
| Every colour, type size, width, spacing step, radius; the seven rules | `app/globals.css` (the `@theme` block and the comment above it) |
| Typefaces, weights, why they are vendored | `app/fonts/index.ts` |
| What each care action is called and what colour it is | `lib/ui/actions.ts` |
| The primitives and their variants | `components/ui/*.tsx` (each file's doc comment says what it is for) |
| Page names, nav labels, nav order, which four get a tab | `lib/nav.ts` |
| The icons | `components/ui/Icon.tsx` |
| The page shell: skip link, cover, tab bar | `app/layout.tsx`, `components/shell/` |

So the docs name tokens (`palace-700`, `rule-faint`, `max-w-measure`) and say
what they are for, but never copy a hex value or a pixel size - those drift. The
one exception is the three named colours, which are names as much as values.

## Keeping these current

A change that adds or alters a token, a primitive, a pattern or a voice rule
updates the matching page here **in the same commit**, and adds an entry to
[decisions.md](decisions.md) saying what was decided and what it cost. If the
change only uses what is already written down, the docs do not need touching.

The `figgy-ui-design` skill (`.claude/skills/figgy-ui-design/`) is how Claude
works from these docs; it reads them before designing, reviewing or building UI.

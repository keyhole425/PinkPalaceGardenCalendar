# UI review checklist

Walk this over a diff, a branch or a page. Each item names where the rule is
explained. Not every item applies to every change - skip what doesn't.

A quick way to find mechanical breaks in a diff:

```bash
git diff main... -- app components | grep -nE '^\+.*(shadow-|text-white|uppercase|rounded-(lg|xl|2xl|3xl)|#[0-9a-fA-F]{3,6}\b|\[[0-9.]+(px|rem)\]|min-h-11|clsx)'
```

Hits are leads, not verdicts - read each in context.

## Structure

- [ ] The page's outermost element is a `Frame`, with a width that fits what
      it holds, not the room available. *(foundations.md - Widths)*
- [ ] It has a `PageHeader` - one `h1` - with a description where the page
      could be confused with another, and `back` if it's drilled into.
      *(patterns.md - Page anatomy)*
- [ ] Blocks are `Card`s or `Section`s with real `h2`s, spaced with
      `space-y-rhythm`. No hand-rolled headings in a different face.
      *(components.md - Card)*
- [ ] A two-column board keeps both columns starting at the top; nothing
      full-width above it. *(patterns.md - Two columns)*
- [ ] Long lists are capped (`max`) or folded (`collapsible`); long notes are
      clamped to two lines with the full text in `title`. One item can't set
      the height of its neighbours. *(patterns.md - Fit the screen)*

## Primitives

- [ ] Uses `components/ui/*` where one exists: Button/ButtonLink, Badge,
      Callout, Card, DataList, EmptyState, Field + `inputClass`, ActionChip,
      MonthStrip, ScientificName, Icon. No re-implemented copy of one.
      *(components.md)*
- [ ] Action colours come from `lib/ui/actions.ts` (or ActionChip/MonthStrip),
      not a new map. *(foundations.md - Action colours)*
- [ ] Any new variant is a complete literal class string in the component's
      map; no class names built at runtime. *(components.md - Conventions)*
- [ ] `className` passed to a primitive is layout only - not colour or type.
- [ ] Classes joined with `cx()`; no new UI dependency.

## Colour and type

- [ ] No shadows; separation by `rule`/`rule-faint` or `paper-sunk`.
      *(principles.md rule 1)*
- [ ] Every colour carries a meaning (fertilise / prune / harvest, or their
      confirmation / warning / note roles). Anything else is ink or grey.
      *(rule 5)*
- [ ] Fills carry `text-ink`, never `text-white`. *(rule 6)*
- [ ] No large pink field; `palace-200` only for the cover, primary button and
      `strong` badge. *(rule 4)*
- [ ] Meaning never rests on hue alone - the word or a `title` is there too.
      *(accessibility.md - Never colour alone)*
- [ ] `ink` for content, `ink-soft` for apparatus, `ink-faint` for the quietest.
      `font-medium` to emphasise; `font-semibold` only on headings. *(rule 3)*
- [ ] Headings in `font-serif`; scientific names via `ScientificName`;
      `tabular-nums` on numbers in columns. *(foundations.md - Type)*
- [ ] Radii: `rounded-sm` printed, `rounded-md` pressable, `rounded-full`
      badges/pills. *(rule 7)*
- [ ] Tokens, not raw hex or arbitrary values, where a token exists.

## Copy

- [ ] Sentence case; no uppercase; en-AU spelling. *(voice.md - The rules)*
- [ ] Curly quotes, real dashes and ellipses, `&deg;`.
- [ ] Buttons are plain verbs that say what happens; disclosures say what they
      open. *(voice.md - Labels say what they do)*
- [ ] `pendingLabel` on every submit that waits.
- [ ] Empty states use `EmptyState` with a short, flat statement about the
      garden. *(voice.md - Empty states)*
- [ ] Placeholders are real garden examples.
- [ ] Errors say what happened, what wasn't affected, and the way forward.
- [ ] figgy is lower case and third person; badges are lower-case fragments.

## Phone and accessibility

- [ ] Every pressable thing is `min-h-tap` (44px); the primary action sits
      beside what it acts on. *(accessibility.md - Targets)*
- [ ] Works at 375px: nothing overflows, panels fit
      (`max-w-[calc(100vw-2.5rem)]`), side-text that wraps badly is hidden
      below `sm`.
- [ ] Focus ring untouched; nothing removes `outline`.
- [ ] Inputs are wrapped in their labels (`Field`).
- [ ] Icons: decoration is `aria-hidden` (no `title`); an icon-only control
      has `title` on the icon and `aria-label` on the control.
- [ ] `aria-current`, `aria-pressed`, `aria-expanded` where they apply.
- [ ] The common path still works without JavaScript (forms, `<details>`).

## AI surfaces

- [ ] Claude's output is a draft to check before anything is written; it says
      so. *(patterns.md - AI surfaces)*
- [ ] Everything ticked by default; unmatched items can't be committed.
- [ ] Says what Claude can and can't do near the button.
- [ ] With no API key: an `EmptyState` saying what it could do, what it needs,
      and the manual way.

## Docs

- [ ] If the change adds or alters a token, primitive, pattern, route or voice
      rule, the matching `docs/design/` page and `decisions.md` are updated in
      the same change.
- [ ] `lib/nav.ts` and `docs/design/screens.md` agree on routes and names.

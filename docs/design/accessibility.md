# Accessibility

figgy is used outdoors, one-handed, in sunlight, sometimes with dictation. Most
of what makes it accessible is also what makes it usable in a garden.

## Targets

- **Anything you press is at least 44px tall:** `min-h-tap`. Buttons, inputs,
  tab-bar links, disclosure summaries.
- Smaller targets are allowed only for secondary controls inside an already
  opened panel (the 32px Today/Yesterday shortcuts, a 36px header cog), and
  never for the primary action.
- Keep the primary action **beside the thing it acts on** - Done is on the
  task's own row.

## Focus

- Every focusable element gets the global `:focus-visible` ring: 2px `focus`
  (the `palace-700` ink), 2px offset, from `globals.css`. Don't remove it or
  replace it per component.
- The first thing in the page is a **Skip to content** link to `#main`
  (`app/layout.tsx`), visible on focus.
- A panel opened on request may `autoFocus` its field (LogSentence's textarea)
  - it only exists because it was just asked for. Nothing else autofocuses.

## Contrast

- Text meets WCAG AA. The pairings that matter are in
  [foundations.md](foundations.md#contrast-and-what-it-costs): `palace-700` on
  `palace-200` 6.34:1; `text-ink` on the action fills 6.69 / 6.18 / 4.22:1.
- **Text on an action fill is `text-ink`, never white.**
- Any exception is written down with its reason (the harvest tick at 4.22:1 is
  accepted because the same information is in the cell's title and sr-only
  text). Add new exceptions to [decisions.md](decisions.md).

## Never colour alone

The three action colours are nearly indistinguishable to red-green colourblind
readers. So:

- Every coloured cell or chip also carries the **word** (`ActionChip`, the
  grid's row label) or a **title** and sr-only text (`MonthStrip`, grid cells).
- Overdue is coloured *and* sits under a heading that says "Overdue".
- Weather conditions have an icon *and* a named title.

## Names and structure

- **One `<h1>` per page** (`PageHeader`); cards and sections are real
  `<section>`s with real `<h2>`s, collapsed or not (`Section` adds an sr-only
  `<h2>` when the visible heading is a `<summary>`).
- **Labels wrap their controls** (`Field`), so every input has a name.
- **Icons:** decoration is `aria-hidden` (the default); an icon that *is* the
  control gets a `title`, and its button gets `aria-label`. Nothing announces
  twice.
- **Current page:** nav links set `aria-current="page"`.
- **Toggles:** `aria-pressed` on shortcut buttons; `aria-expanded` on buttons
  that open panels.
- **Abbreviations:** month letters are `<abbr title="January">`.
- **Language:** `<html lang="en-AU">`. Scientific names are `<em>`.
- **Landmarks:** `header`, `main#main`, `nav aria-label="Sections"` for the
  tab bar, `aside` for the rail.

## Works without JavaScript

The common paths are forms and `<details>`, so they work before hydration or
without it: Done, Date or note, Show the other N, Coming up. Keep it that way
- prefer a `<details>` disclosure to a JS-only toggle.

## Phones

- The tab bar is padded with `env(safe-area-inset-bottom)`; `main` has bottom
  padding to clear it below `sm`.
- Panels that open over content are capped at `max-w-[calc(100vw-2.5rem)]` so
  they fit a 375px screen.
- `-webkit-text-size-adjust: 100%` keeps iOS from resizing text when the wide
  grid scrolls.
- Check every change at 375px wide.

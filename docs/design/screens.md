# Screens

Every route, the job it does, and what it is built from. Page names and nav
labels come from `lib/nav.ts`; keep this table in step with it.

## In the nav

| Route | Title (`label`) | Nav (`short`) | Frame | Job | Primary action |
|---|---|---|---|---|---|
| `/now` | What’s on | Now | `page` | The home screen. What needs doing, and what's worth knowing while you do it. | **Done** on a task; Add a note |
| `/grid` | The year | Year | `wide` | Every plant, every month - the spreadsheet the app grew from. | Start in July / January |
| `/garden` | The garden | Garden | `page` | Every place things grow (orchard, beds, hothouse) and what is in each. | Open a place; add a place |
| `/plants` | Plants | Plants | `list` | The catalogue - what figgy knows how to grow. *Not* the garden. | Add a plant |
| `/ask` | Ask your garden | Ask | `measure` | Questions about your own records. Claude reads, never writes. | Ask |

The first four are the phone tab bar. All five are header links from `sm` up.
Settings is the cog in the header.

## Reached from those

| Route | Title | Back | Frame | Job |
|---|---|---|---|---|
| `/plants/[slug]` | the plant's common name | ← Plants | `list` | One kind of plant: scientific name, lifecycle and family in the description; Notes; then a section per planting with its windows as `MonthStrip`s, Done, harvests and history - or "What it needs" if none is planted. "needs review" badge when the schedule has gaps. |
| `/plants/[slug]/edit` | Edit {name} | ← {name} | `list` | Change the plant, its rules and its plantings; ask Claude to look it up again. |
| `/plants/new` | Add a plant | ← Plants | `measure` | Two ways in: "Let figgy look it up" (Claude research → proposal) or "Or say what you know" (the form). |
| `/garden/[slug]` | the place's name | ← The garden | `list` | One bed or place: the plan, Sow something, Growing here now, Rotation warnings, What has grown here. |
| `/proposals/[id]` | the plant that was looked up | ← Plants | `list` | Review what Claude proposed before any of it reaches the schedule; or see that it was accepted, rejected or failed. |
| `/settings` | Settings | - | `list` | The household (name, members, invites), new gardens for site admins, this garden's numbers, looking things up, past look-ups, and you (sign out). |
| `/no-garden` | No garden here yet | - | `measure` | Where a request lands when it belongs to no household. Reads nothing, so it cannot redirect back to itself. |
| `/login` | Sign in | - | `measure` | Email and password, for coming back. Says figgy is invite-only. Outside the garden layout: the cover has the wordmark only. |
| `/join/[token]` | Start your garden / Join {household} / Choose a new password | - | `measure` | Spending an invite. A spent or expired link says so and points at sign-in. |

## Redirects

`/` → `/now`. `/beds` and `/environments` → `/garden` (one garden, since
`8b303da`).

## Adding a screen

1. Add it to `ROUTES` in `lib/nav.ts` if it's a destination (and decide
   whether it earns one of the four tabs - probably not).
2. Pick the `Frame` width by what it holds, not how much room there is.
3. `PageHeader` with a title in figgy's voice ([voice.md](voice.md)) and a
   description that says what it is and isn't.
4. Build from [components.md](components.md); follow [patterns.md](patterns.md).
5. Add a row here.

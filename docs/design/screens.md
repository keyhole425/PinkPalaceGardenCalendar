# Screens

Every route, the job it does, and what it is built from. Page names and nav
labels come from `lib/nav.ts`; keep this table in step with it.

## In the nav

| Route | Title (`label`) | Nav (`short`) | Frame | Job | Primary action |
|---|---|---|---|---|---|
| `/now` | What’s on | Now | `page` | The home screen. What needs doing, and what's worth knowing while you do it. | **Done** on a task; Add a note |
| `/grid` | The year | Year | `wide` | Every plant, every month - the spreadsheet the app grew from. | Start in July / January |
| `/garden` | The garden | Garden | `page` | Every place things grow (orchard, beds, hothouse) and what is in each. | Open a place; **Add a place** in the header |
| `/plants` | Plants | Plants | `list` | The library, searched first: Your plants, then More vegetables and so on, each row with a line for this region. *Not* the garden. | **Look up** a plant |
| `/ask` | Ask your garden | Ask | `measure` | Questions about your own records. Claude reads, never writes. | Ask |

The first four are the phone tab bar. All five are header links from `sm` up.
Settings is the cog in the header.

## Reached from those

| Route | Title | Back | Frame | Job |
|---|---|---|---|---|
| `/plants/[slug]` | the plant's common name | ← Plants | `list` | The plant as an article. "A kind of chilli" (for a variety), scientific name, lifecycle and family in the description; the opening paragraph and the region note; **Your garden** (a section per planting, each `#planting-{id}`, with its windows, Done, harvests and history); **When, in {city}** (a `MonthStrip` per action, with what came from the parent, what each place shifts, and "Change"); **At a glance**; its kinds or siblings; its article sections; sources. **Add to my garden** in the header for a plant you don't have, then **Sow some**. A plant of the household's own has the same layout and says "Only in your garden". |
| `/plants/[slug]/edit` | Edit {name} | ← {name} | `list` | Change the plant, its rules and its plantings; ask Claude to look it up again. |
| `/plants/new` | Add a plant | ← Plants | `measure` | For a plant the library doesn't have. Two ways in: "Let figgy look it up" (Claude research → proposal; `?q=` fills it in from a search that found nothing) or "Or say what you know" (the form, `#say-what-you-know`). |
| `/garden/[slug]` | the place's name | ← The garden | `list` | One bed or place: the plan (a filled square opens its plant at that planting), Sow something, Growing here now, Rotation warnings, What has grown here. |
| `/garden/[slug]/edit` | Change {name} | ← {name} | `measure` | Rename it, change its kind, spots (across × deep, up to 12 each way), frost, how far it runs ahead, measurements and notes. Below, Remove this place - refused while anything is growing there. Reached from **Change** in the place's header. |
| `/garden/new` | Add a place | ← The garden | `measure` | The same form, empty. Spots have no default: a bed says its own size. Lands on the new place. |
| `/proposals/[id]` | the plant that was looked up | ← Plants | `list` | Review what Claude proposed before any of it reaches the schedule; or see that it was accepted, rejected or failed. |
| `/settings` | Settings | - | `list` | The household (name, members, invites); **Helping the library** (what is shared, and Stop sharing for an admin, behind a second press); for site admins only, **The library** (with how many suggestions are waiting), new gardens and this garden's numbers; looking things up, past look-ups, and you (take the tour again, sign out). |
| `/library` | The library | ← Settings | `list` | Site admins only (anyone else gets a 404). New plants gardens have (each with **Add it as**: a plant of its own / a kind of… / the same as…), plants with suggested changes, plants whose grows disagree with them (**Worth a look**), and every plant with how many grows it has. |
| `/library/[slug]` | the plant's common name | ← The library | `list` | Site admins only. **Suggested** (each a sentence, the garden's months beside the library's, and **Accept** / **Turn down**; a note is **Mark read**), the library's months, **What gardens found** (grows by sowing month, flags, notes with names taken out), and **The article** to edit; saving publishes. |
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

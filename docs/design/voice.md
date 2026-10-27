# Voice

figgy talks like a calm, plain-spoken notebook kept by someone who gardens in
Adelaide. It says what is so, says what a thing does, and doesn't make a fuss.

## The rules

- **Australian English.** `lang="en-AU"`. fertilise, colour, organise,
  catalogue. Dates as "27 September 2026" (`formatLong`) or `27/09/2026`
  (`formatShort`); never month-first.
- **Sentence case, everywhere.** Titles, buttons, card headings, the eyebrow.
  No uppercase - "figgy does not shout."
- **Real punctuation.** Curly quotes and apostrophes (`&rsquo;`, `&ldquo;`
  `&rdquo;`, `’`), en dashes in ranges (`Mar–May`), em dashes in prose
  (`&mdash;`), a real ellipsis (`…`), a middle dot to join facts
  (`· Rosaceae`), `&deg;` for degrees.
- **figgy is lower case** and speaks of itself in the third person: "figgy can
  turn…", "Here is what figgy understood." Claude is named as Claude when it's
  Claude doing the work: "Claude reads your records. It cannot change them."
- **Short, flat, declarative.** One idea per sentence. No exclamation marks.
  No "Oops", no "Successfully", no "Please".

## Labels say what they do

A label names the thing that will happen or the thing behind it. "or…" was
renamed "Date or note" because it said nothing about what it opened. "Settings"
became a cog because it was the only word in the header that wasn't a place.

- **Buttons are verbs, plainly:** Done, Ask, Add a plant, Add a note, Work it
  out, Show the other 12.
- **Pending labels** describe what's happening: Saving, Reading…, Looking….
- **Back links** name where they go: "← Plants", "← The garden".

## Titles read like a notebook

Page and card titles are what you'd write at the top of the page: "What’s on",
"The year", "The garden", "Ask your garden", "Harvesting now", "Could be
sown now", "Could be planted out now", "Growing here now", "What has grown here", "Sow something", "Let figgy
look it up", "Or say what you know".

A page and its nav entry share one record in `lib/nav.ts` so they can't drift.

## Descriptions say what it is - and isn't

The sentence under a title explains the page in garden terms, and draws a line
where a page could be confused with another: "This is the reference, not the
garden." "Claude can read the garden but not change it."

## Empty states

One voice everywhere, through `EmptyState`: a short, flat statement of fact,
about the garden rather than about the software.

- "Nothing needs doing today."
- "Nothing missed in the last three months."
- "Nothing opens in the next three weeks."
- "Nothing is in season."
- "Nothing wants sowing this month."
- "No places yet. Add one below."

Not "No tasks found", not "You're all caught up!", not "Empty". If something
could go in the empty spot, offer it.

## Placeholders are real

Placeholders and examples come from the actual garden, so they show what kind
of thing to write:

- "netted the cherries and picked about 2 kg off the lemon"
- "What did the fig give us last year?"
- "Which beds have had the same family twice?"
- "Kaffir lime" / "Citrus hystrix", "Cherry #3"
- "Took about an hour. Two branches still to do."

Not "Enter text", not "Lorem ipsum", not "e.g. Plant name".

## When something goes wrong, or can't work

Say what happened, what wasn't affected, and what you can do instead:

- "That didn’t work." + the reason + "Nothing was saved. Try again or add the
  plant by hand."
- "Thrown away. Nothing was written to the schedule."
- With no API key: what figgy *could* do, what it needs, and the manual way -
  "You can always tick things off by hand."

Reassure about what is safe: "Nothing is saved until you say so." "None of this
is in your schedule yet."

## Small words

- Badges are lower-case fragments: "shifted", "one of 3", "2 growing", "needs
  review".
- Timings are relative and spoken: "closes in 9 days", "window closed 3 days
  ago", "opens tomorrow".
- Counts sit next to their headings as a bare number, not "(3)".
- Success says what happened with a number: "Recorded 2 things."

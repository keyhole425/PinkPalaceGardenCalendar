# figgy's docs

Written-down knowledge about figgy, one folder per area. Each area has a
matching Claude Code skill in `.claude/skills/` that works from it, so Claude
picks up the right knowledge on its own when a request touches that area.

| Area | Docs | Skill | Covers |
|---|---|---|---|
| Design | [design/](design/README.md) | `figgy-ui-design` | how figgy looks, reads and behaves: screens, components, colour, type, copy, accessibility |

Ops has its own page already: [ops/DEPLOY.md](../ops/DEPLOY.md).

## Adding an area

The split is always the same: **docs hold the knowledge** (what and why),
**the skill holds the process** (how to work), and **the code stays the source
of truth for values**.

1. **Docs:** `docs/<area>/README.md` - an index and a "where the truth lives"
   table pointing at the files that actually hold the values. Then one page per
   topic. Write down what the code and the commit bodies already say; don't
   invent rules.
2. **Skill:** `.claude/skills/figgy-<area>/SKILL.md`, copied from
   `figgy-ui-design`'s shape:
   - frontmatter `name` and a `description` that lists the kinds of request and
     the words people use for them, **and names what it is not for** - the
     other areas' scope - so two skills don't both fire;
   - a short body: orient (which docs to read), the modes of work, how to
     verify, how to keep the docs current;
   - anything long goes in `references/` and is read only when needed.
3. **Index:** a row in the table above, and a line in the root `CLAUDE.md`.
4. **Check the trigger:** try a handful of requests that should load it and a
   handful that shouldn't, in a fresh session.

Likely next areas:

| Skill | Would cover |
|---|---|
| `figgy-schedule` | month masks, care windows, alternatives, environment shifts - `lib/schedule/` |
| `figgy-ai` | the Claude features: parsing a log, asking the garden, researching a plant - `lib/ai/`, `actions/` |
| `figgy-data` | the Drizzle schema, migrations, seed - `lib/db/`, `db/` |
| `figgy-ops` | Docker, backups, deploying at home - `ops/`, `scripts/` |

# figgy

A garden calendar for the Pink Palace, in Adelaide: a mobile-first Next.js PWA
(App Router, React 19, Tailwind v4, SQLite + Drizzle) used standing in a garden
holding a phone. See [README.md](README.md) for what it does and how it runs.

## Where knowledge lives

Written-down knowledge is in `docs/`, one folder per area, each with a skill in
`.claude/skills/` that works from it. Index: [docs/README.md](docs/README.md).

| Area | Docs | Skill |
|---|---|---|
| UI/UX - screens, components, colour, type, copy, accessibility | [docs/design/](docs/design/README.md) | `figgy-ui-design` |

Anything that changes what is on screen goes through `figgy-ui-design`.

## Working here

- Check: `npm run lint` (Biome), `npm run typecheck`, `npm test` (Vitest),
  `npm run test:e2e` (Playwright, builds first). CI runs all four.
- Format: `npm run format`. Tabs, single quotes.
- Preview: the `figgy` config in `.claude/launch.json` (`npm run dev`, port
  3000). Needs a migrated, seeded `data/garden.db` (`npm run db:reset`) and
  someone to sign in as (`npm run admin:dev-user`, with the throwaway
  `FIGGY_DEV_*` values from `.env.example`).
- No UI libraries. Primitives are in `components/ui/`; class names are joined
  with `cx()` from `lib/ui/cx.ts`.
- Commits: `figgy: ` then a lower-case, plain-English subject about the
  user-visible outcome ("figgy: make settings a cog"). The body is prose
  explaining why, with numbers where there are any, and trade-offs recorded
  rather than worked around.

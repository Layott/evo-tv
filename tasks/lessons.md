# EVO TV — Lessons

Corrections from user that should not recur. One line per lesson: rule + why.

<!-- Template:
- **[YYYY-MM-DD] rule** — why this matters. how to apply.
-->

- **[2026-04-26] No AFC / Game Evo / V-ENT ecosystem refs.** EVO TV is standalone. Why: user clarified those orgs are unrelated to this project. How to apply: scrub any inherited copy that mentions them; replace AFC → EVO, V-ENT → EVO Originals (in-house production label).
- **[2026-04-26] No real-money betting in any feature.** Why: regulatory + brand-safety; user explicit. How to apply: betting partner integration is showcase-only (logos + odds widget for entertainment). All staked currencies are virtual EVO Coins.
- **[2026-04-26] EVO TV does not host tournaments — it covers them.** Why: scope clarity. How to apply: never build admin flows for running brackets / setting prize pools / scoring matches. Bracket UIs are for fan pick'em + display only.
- **[2026-04-26] Dev server runs on port 3060.** Why: user has other projects on 3000 + 3030. How to apply: `pnpm dev` and `pnpm start` are pinned via `-p 3060` in package.json. Don't suggest 3000 in URLs.
- **[2026-04-26] Centralize mock media in `lib/mock/_media.ts`.** Why: avoids 17-file sweeps when re-theming, and gives one place to register new image sources. How to apply: any new mock module imports helpers from `_media.ts` rather than inlining `/placeholder.svg?...` URLs.

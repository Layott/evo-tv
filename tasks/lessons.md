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
- **[2026-04-27] Vercel `git connect` needs Vercel GitHub app to have repo access OR repo public.** Why: even with app installed at user level, repo-level grant is required for private repos; auto-deploy silently no-ops without it. How to apply: before `vercel git connect`, either flip repo to public OR open https://github.com/settings/installations → Vercel → grant access to specific repo.
- **[2026-04-27] Vercel rejects deploys with known Next.js CVEs.** Why: build passes locally, then platform-side deploy fails with "Vulnerable version of Next.js detected" — wasted build minute + blocks ship. How to apply: keep `next` on latest patched minor (`pnpm add next@latest`) before any deploy; check `pnpm view next dist-tags`.
- **[2026-04-27] Local dev tolerates missing deps that prod build rejects.** Why: `pino` was imported but absent from package.json — local kept running off cached `node_modules`; Vercel build failed `Cannot find module 'pino'`. How to apply: when adding any new import, immediately run `pnpm install` (or check `package.json`) to confirm dep is declared. Don't trust local server uptime as proof.
- **[2026-04-27] Vercel preview URLs are 401-gated by Deployment Protection on team accounts.** Why: looks like deploy broken, actually working but locked. How to apply: append `?x-vercel-protection-bypass=<token>&x-vercel-set-bypass-cookie=true` to bypass, OR Project → Settings → Deployment Protection → set None / Production-only. Token stored in user memory `reference_evo_tv_vercel.md`.
- **[2026-04-27] Bare `<name>.vercel.app` subdomains are claimable via `vercel alias set`.** Why: default project URL is `<project>-<team>.vercel.app` (long); short slug improves shareability. How to apply: after first prod deploy, `vercel alias set <deploy-url> <name>.vercel.app` — succeeds if not taken. evotv.vercel.app is now ours.
- **[2026-04-27] Don't take destructive cloud actions on diagnostic questions.** Why: user asked "why is deploy slow", I escalated to `vercel rm` — denied. Diagnostic ≠ remediation request. How to apply: when user asks WHY something is slow/broken, answer the diagnostic; only delete/cancel/rollback when explicitly asked.

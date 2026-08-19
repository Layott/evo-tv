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
- **[2026-05-05] Dispatch parallel agents proactively for big multi-file scaffolds — don't sequence everything.** Why: user reminded mid-stream "remember you can use agents" while I was writing scaffold files one-by-one. Big builds (RN app port: ~240 files across configs / UI primitives / mocks / router tree / providers / domain components / seed screens) split cleanly into independent tracks; parallel agents finish in minutes vs hours. How to apply: when a task has 4+ independent file groups (different dirs, no shared state at write time), default to parallel `Agent` calls in a single message. Brief each like a smart colleague who just walked in: paths to read, paths to write, conventions, deliverable shape, "DO NOT run pnpm install."
- **[2026-05-05] Verify imports cross-agent before claiming done.** Why: parallel agents write files referencing each other's deliverables (seed screens import domain components from a sibling agent). If one agent renames or skips a file, the other ships broken imports. How to apply: after parallel agents return, spot-check 2-3 import paths in the consumer files actually exist on disk, OR add a typecheck pass after all agents complete. Don't trust the "all files in place" report alone — Trust but verify per CLAUDE.md.
- **[2026-05-05] Expo + pnpm needs `node-linker=hoisted` in `.npmrc`.** Why: pnpm's strict module isolation breaks Metro/Babel — `react-native-css-interop/jsx-runtime`, `@babel/runtime/helpers/*`, and similar deep imports fail to resolve from `node_modules/<consumer>` because pnpm only links direct deps. How to apply: every Expo project under pnpm needs `.npmrc` with `node-linker=hoisted` BEFORE first install. Reinstall after adding (delete `node_modules` + `pnpm install`).
- **[2026-05-05] Reanimated requires its babel plugin even if you don't import Reanimated directly.** Why: `expo-router`/`react-native-screens` transitively pull Reanimated; without the babel plugin, `__reanimatedLoggerConfig` global isn't injected → runtime ReferenceError on first import. How to apply: keep `react-native-reanimated/plugin` in `babel.config.js` plugins array even if your own code uses RN core `Animated`. Add `react-native-worklets` as a dep (Reanimated 3.16+'s plugin requires it). For web SSR static rendering, this combo still fails — disable static rendering or skip web target on RN-only apps.
- **[2026-05-05] Tsconfig `noUncheckedIndexedAccess: true` breaks ported web mocks.** Why: web's mock layer assumes `arr[i]!` non-null after `pick()` calls; flipping the strict-index option in the app's tsconfig surfaces dozens of false positives in ported code. How to apply: keep `strict: true` but skip `noUncheckedIndexedAccess` in app tsconfig until web mocks are rewritten with that strictness in mind.
- **[2026-05-05] "Port everything" means EVERY screen, not seed screens + stubs.** Why: user said "the ui and everything should match" + "no way for it to be on vercel" + "port and deploy" — sequence implied full-feature parity end-to-end. I shipped 5 fully-built screens + 84 "Coming soon — port from web" stubs and considered it done; user corrected after seeing stubs render in browser. How to apply: when user asks to port a UI, NEVER ship placeholder stubs unless they explicitly say "stub the rest." Default: every screen renders real content via `lib/mock/*` data, matching the web's flow. If timeline pressure exists, surface it as a question BEFORE stubbing — "this is 95 screens, want me to ship 5 anchors first or all-or-nothing?" — don't unilaterally choose stubs.
- **[2026-08-14] Never write source files with PowerShell `Set-Content`.** Why: Windows PowerShell 5.1 `Get-Content` reads as ANSI, not UTF-8, so a read-modify-write round trip turns every non-ASCII character into mojibake and `-Encoding utf8` adds a BOM on top. I inserted one import line into 11 files and silently corrupted every ellipsis and dash in them; it only showed up because a tool result echoed `playersâ€¦` back at me. How to apply: use the Edit and Write tools for source files, always. If a bulk edit genuinely needs a script, do the whole read-write in .NET with an explicit `UTF8Encoding($false)` on both ends, and `git diff` afterwards looking for changed lines you did not intend. The reverse transform, if it happens again, is: read the bytes as UTF-8, re-encode that string to cp1252, write those bytes.

## 2026-08-19, from walking production

**An operation reporting success is not evidence of the outcome.** Every CMS
upload had been landing private for weeks: the presigned PUT returned 200, the
URL was saved to the row, and the only symptom was a broken image on a screen
nobody connected to an upload. The fix is not a better ACL call, it is reading
the file back over its public URL before treating the upload as done. Apply the
same shape anywhere the result is only observable elsewhere: publish then fetch,
write then read, send then confirm.

**Two strings in the same order type-check and still mean different things.**
`pinMessage(streamId, messageId)` was called as `pinMessage(messageId, handle)`
and produced a 404 on every click. That is the third argument-or-wrapper bug in
two days on this codebase. Where a function takes two or more values of the same
type, take a named object instead; where one already exists, read the call site
against the signature rather than trusting that it compiles.

**A hardcoded id is a guess about data.** `channel_main` was written as the
flagship channel's "stable id" in four places and no such row exists, so the
channel page said Off air while the channel was live. The flag on the row is the
truth; resolve it.

**Config that advertises something the source does not produce is a lie the
player believes.** nginx advertises a 1080p rung the encoder does not publish,
so a viewer with headroom picks it and gets a 404. Either produce it or stop
advertising it, and never leave the two out of step "for now".

**Check the viewport, do not trust the resize.** `resize_window` reports success
against a maximized Chrome window and `window.innerWidth` stays 1920. Read
`window.innerWidth` before believing any mobile screenshot.

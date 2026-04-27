# Phase F smoke test — 2026-04-22

Dev server (`pnpm dev`) on http://localhost:3000. Typecheck (`npx tsc --noEmit`) clean project-wide.

## HTTP route coverage

Guest (no cookie):

| URL | Expected | Actual |
|---|---|---|
| / | 200 splash → redirect /login | 200 |
| /login | 200 | 200 |
| /signup | 200 | 200 |
| /verify-email | 200 | 200 |
| /forgot-password | 200 | 200 |
| /onboarding | 200 | 200 |
| /home | 200 | 200 |
| /discover | 200 | 200 |
| /events | 200 | 200 |
| /events/event_ff_lagos | 200 | 200 |
| /stream/stream_lagos_final | 200 | 200 |
| /vod/vod_1 | 200 | 200 |
| /clips | 200 | 200 |
| /categories | 200 | 200 |
| /shop | 200 | 200 |
| /upgrade | 200 | 200 |
| /profile | 307 → /login | 307 |
| /library | 307 → /login | 307 |
| /settings | 307 → /login | 307 |
| /notifications | 307 → /login | 307 |
| /checkout | 307 → /login | 307 |
| /cart | 307 → /login | 307 |
| /admin | 307 → /login | 307 |
| /this-does-not-exist | 404 | 404 |

User cookie `evotv_role=user`:

| URL | Expected | Actual |
|---|---|---|
| /profile | 200 | 200 |
| /library | 200 | 200 |
| /settings | 200 | 200 |
| /notifications | 200 | 200 |
| /checkout | 200 | 200 |
| /cart | 200 | 200 |

Admin cookie `evotv_role=admin`:

| URL | Expected | Actual |
|---|---|---|
| /admin | 200 | 200 |
| /admin/streams | 200 | 200 |
| /admin/content | 200 | 200 |
| /admin/polls | 200 | 200 |
| /admin/ads | 200 | 200 |
| /admin/users | 200 | 200 |
| /admin/analytics | 200 | 200 |
| /admin/orders | 200 | 200 |
| /admin/moderation | 200 | 200 |
| /admin/settings | 200 | 200 |

## Manual flow checks (to run in browser)

- [ ] Dev role switcher (bottom-right) toggles guest/user/premium/admin; top-nav avatar/role badge updates.
- [ ] Splash → auto-redirect to /login (guest) or /home (signed).
- [ ] Signup form validates (zod) + strength meter + success → /verify-email.
- [ ] Verify-email 6-digit OTP accepts any code → /onboarding.
- [ ] Onboarding 4 steps: games → teams → notifications → appearance → /home.
- [ ] Home hero carousel auto-advances; live/upcoming/trending sections render.
- [ ] Discover search suggests on keystrokes; tabs swap results.
- [ ] Event detail page countdown ticks; Remind-me toasts + persists.
- [ ] Stream page plays demo MP4 (graceful fallback if missing); chat messages stream in; poll vote registers; shop add-to-cart toasts.
- [ ] VOD page plays; chapter click seeks; related grid renders.
- [ ] Clip page swipes / arrow keys navigate next/prev.
- [ ] Shop → product → add to cart → /cart → /checkout → Paystack/Mock submit → /order/[id] timeline.
- [ ] Upgrade page tier comparison; CTA routes to /checkout?plan=premium.
- [ ] Profile edit modal updates display name/bio/avatar.
- [ ] Settings tabs via `?tab=`; theme radio actually flips light/dark.
- [ ] Notifications mark-as-read + mark-all-read.
- [ ] Admin dashboard metric cards + charts render.
- [ ] Admin streams "Create" → reveal-key-once dialog with sk_live_XXXX key.
- [ ] Admin content tabs CRUD drawers open + validate.
- [ ] Admin feature flags toggle persists in memory for session.

## Known deferrals (non-blocking for Phase F)

- `/demo/sample.mp4` not committed. Players gracefully render "Demo video unavailable" + retry. Drop any MP4 at `public/demo/sample.mp4` to preview real playback. HLS.js wiring is Phase 1C.
- ESLint not installed (scaffold never had it). Typecheck is the quality gate. Add in Phase 0 alongside Prettier.
- Dev server warns about parent CLAUDE/package-lock.json — silenced via `turbopack.root` in next.config.mjs.

# Handover: launch day, 2026-08-11

The day EVO TV went live. Written at the end of it, covering `193f980` through
`ab44a01` on `backend` `feat/digitalocean`.

**Everything in here is deployed and running in production.**

---

## 1. Read this first: two things are still owed

### The stream key currently in use is public

The playback URL was `/hls/<STREAM_KEY>.m3u8`. nginx-rtmp names its HLS output
after the RTMP stream name, and the stream name was the key, so the credential
needed to broadcast as the channel appeared in every viewer's network tab.

Fixed at the source: OBS now publishes to `<streamId>?key=<secret>` and
playback is `/hls/<streamId>.m3u8`. **But the key used on 11 August was exposed
for the length of that broadcast and has not been rotated.** Admin, Streams,
the stream, Regenerate key, then paste the whole new string, query argument
included, into OBS.

Old-style bare keys still authenticate, deliberately, so a broadcaster mid-show
does not drop. That path still leaks. It is documented as deprecated in
`docs/LIVE-STREAMING-SETUP.md`.

### The Cloudflare origin is not locked

`api.evotv.co` is proxied and caching HLS segments, but the droplet still
accepts direct traffic on 80 and 443, so the proxy protects nothing yet.

```bash
./deploy/cloudflare-firewall.sh <FIREWALL_ID> --apply
```

It refuses to run while DNS still resolves to the droplet, so it cannot take
the site offline by mistake.

---

## 2. What is live

| | |
|---|---|
| `evotv.co`, `www` | the Next app, landing page for guests, `/home` for signed-in |
| `app.evotv.co` | same app. Not yet 301ing to the apex |
| `api.evotv.co` | API and `/hls/*`. **Proxied through Cloudflare** |
| Ingest | `rtmp://138.68.126.199:1935/live`, nginx-rtmp under the compose `rtmp` profile |
| Deploys | `git push` and it ships in about two minutes |

Containers: `api-1`, `api-2`, `caddy`, `valkey`, `nginx-rtmp`.

**Live streaming works end to end and has carried a real audience.** OBS to
nginx to HLS to Caddy to Cloudflare to hls.js, with real users chatting on it.

---

## 3. Deploying

`autodeploy.sh` polls the branch from cron every two minutes and runs
`deploy.sh` when the SHA moves. `git push` is the deploy.

```bash
ssh evotv 'journalctl -t evotv-autodeploy -f'          # watch
crontab -e                                             # DEPLOY_BRANCH lives here
```

Pull-based on purpose: a GitHub Action would need this droplet's SSH key in
GitHub secrets, so anyone who compromised the repo would get a root shell here.
Nothing leaves the box.

`deploy.sh` builds, migrates, then restarts one api container at a time waiting
for health, so a bad build leaves the other serving the previous version.

**It syncs itself now**, via an atomic rename. It previously could not: it was
not in its own sync list, so a change to which files it syncs could never take
effect, and `autodeploy.sh`, `nginx-rtmp.conf` and `cloudflare-firewall.sh` were
pulled but absent until copied by hand.

---

## 4. The bugs that cost the most, and what they teach

### A build that only fails in production

`app/page.tsx` had `export const revalidate = 60`, which makes it an ISR page,
and **Next prerenders ISR pages during `next build`**. That render reads
`epg_slots`, so the build needed a database. It has one locally through
`.env.local` and none inside Docker, so `pnpm build` died with `ECONNREFUSED
127.0.0.1:5432` and no image was produced.

**Reproduce this class locally by building with a deliberately dead
`DATABASE_URL`.** That is how it was confirmed fixed.

### Duplicate headers a browser rejects and curl accepts

The player span forever on a manifest that was demonstrably fine: fresh,
fetchable, decodable by ffmpeg off the live edge. nginx set CORS and cache
headers on `/hls/`, and the Caddy block in front set them too. `add_header`
appends rather than replaces, so every response carried two
`Access-Control-Allow-Origin` headers.

A browser treats that as invalid and blocks the response. **curl accepts it
happily**, which is why every command-line check passed. Caddy owns those
headers in production now; the local nginx keeps them, because nothing sits in
front of it there.

### A cast is not a mapping

Every avatar rendered as an empty `img`, and uploading a new one changed
nothing. `getCurrentUser` did `res.user as Profile`. The endpoint returns
Better-Auth's `image` and `name`; `Profile` reads `avatarUrl` and
`displayName`. So the field being written was never the field being read, and
**a cast asserts a shape rather than producing one**, which is why TypeScript
said nothing.

The same endpoint was also not returning `onboardedAt`, so `onboardingComplete`
was always false and anyone who finished onboarding was walked through it again
on every visit.

### Types that lie crash the page

Typing one chat message unmounted the whole tree. `ChatMessage.userHandle` was
typed `string` and is not: a profile only gets a handle when the user sets one,
and the optimistic message rendered before the server replies copied that null
through. `null.slice(0, 2)` threw inside render.

Fixed at the renderer, the caller and the type. It is `string | null` now.

### Screens that were theatre

`forgot-password`, `reset-password` and `verify-email` each waited 600ms,
showed a success toast, and called nothing. `verify-email` accepted any six
digits and displayed a hardcoded `MOCK_EMAIL` as the user's own address.
**None of them imported `lib/mock`**, which is why the purge walked past them.

Grepping imports does not find fabrication. Read the page.

### Configuration that was a placeholder

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in production were the literal
string `[SENSITIVE]`, pasted from something redacted. Google answered
`invalid_client`, which reads as a Google problem.

`RESEND_API_KEY` was invalid, so every password reset failed with "API key is
invalid" while a working Gmail SMTP transport sat configured and unused in the
same environment. `sendEmail` now tries Resend, then SMTP, then console.

### Tuning that fought itself

The scrub bar took four passes, and three of the causes were mine:

1. It was `disabled={error || isLive}`. Correct at `hls_playlist_length 10s`,
   wrong once that became 300s.
2. Bound to `duration`, which is Infinity while live, so there was no range.
3. `liveMaxLatencyDurationCount: 20` at 2s fragments is a **40 second ceiling**:
   any seek past it was undone within two seconds. Measured: 20s and 35s back
   held, 60s and 150s were dragged forward to about 13s behind. It is 200 now,
   which clears the 150-fragment window.
4. `backBufferLength: 90` while offering 300s, so far seeks landed on evicted
   data. Near seeks worked, far ones did not.

**Keep `liveMaxLatencyDurationCount` and `backBufferLength` above
`hls_playlist_length / hls_fragment`** whenever either changes in nginx.conf.

`lowLatencyMode` is deliberately unset. Enabling it made hls.js fetch both
playlists and never request a fragment.

---

## 5. Verification notes for whoever is next

**Chrome in this environment always reports `document.visibilityState:
"hidden"`.** Chrome throttles media and defers MediaSource in hidden documents,
so playback and seek measurements taken there cannot be trusted. Several
apparent bugs were instrument error. Check visibility before believing a
playback measurement, and get a human to confirm anything visual.

Two verification habits that paid for themselves repeatedly:

- **ffprobe the manifest the site actually serves.** It proves the stream is
  real video independently of any player.
- **Prove a reset really reset.** Old password 401, new password 200. "The
  email sent" is not the same claim.

---

## 6. What was built today

- `/schedule`, the programme guide. Merges dated rows over the repeating
  `epg_slots` grid, so a dated programme wins the hours it overlaps.
- `/privacy` and `/terms`, written against what the system actually does. Every
  processor named is one the code really calls. **Not reviewed by a lawyer.**
- Both ingest paths: self-hosted nginx-rtmp, and Cloudflare Stream ready behind
  `LIVE_INGEST=cloudflare` plus credentials.
- Avatar upload replacing "Avatar URL", which assumed the user had already
  hosted their photo somewhere.
- Favicon and Open Graph images from the real mark. The old ones were the Next
  starter template's, Figma export id still in the SVG.
- The main channel: migration 0034, `/api/channel/main`, the fixed hero, and an
  admin toggle. **Nobody has been designated yet.** Admin, Streams, a stream,
  Make main channel.

---

## 7. Still owed

> **Update, 2026-08-12.** Items 3 and 6 of section 1 and this list moved. The
> key was rotated, the main channel was designated, `app.` now 301s to the
> apex, privacy and terms are on every page, the viewer count is shared across
> containers, and the test accounts have a script rather than a note. What is
> genuinely still open is the origin lock, which is blocked on DNS: only
> `api.evotv.co` is proxied. `evotv.co`, `www.` and `app.` all still resolve
> straight to the droplet, so locking 80 and 443 to Cloudflare ranges today
> takes the site down. Orange-cloud those three records first; the script
> refuses to run until they are, which is the correct order and not a bug.

1. **Rotate the stream key.** Done, and note that the regenerate dialog was
   handing back the *old* leaky form when it was rotated, which is fixed. Any
   key rotated before that fix should be rotated once more.
2. **Lock the Cloudflare origin.** See section 1, and the DNS blocker above.
3. ~~**Designate the main channel.**~~ Done: `EVO TV 24/7 LIVE`. It has no
   poster, thumbnail or tagline, so the hero renders bare between broadcasts.
4. **Legal review** of `/privacy` and `/terms`, particularly the NDPA sections.
5. **Delete the leftover test accounts.** `claude-test-admin@evo.tv` is an
   **admin** account from May with an unknown password, plus three
   `@evotv.local` users. The owner has since said delete, and
   `scripts/delete-test-accounts.ts` does it. Run the dry run first, then:

   ```bash
   ssh evotv 'cd /srv/evotv && docker compose run --rm --no-deps api-1 \
     pnpm tsx scripts/delete-test-accounts.ts'          # report
   ssh evotv 'cd /srv/evotv && docker compose run --rm --no-deps api-1 \
     pnpm tsx scripts/delete-test-accounts.ts --apply'  # delete
   ```
6. **The native app has had none of this.** Every fix here is web only. The RN
   app still has the fake auth screens, the old avatar mapping and no main
   channel.
7. ~~**`app.evotv.co` still serves the app.**~~ It is a 301 to the apex in the
   Caddyfile now. Reverting is one line: `import evotv_next` in place of the
   `redir`. Do revert it if `COOKIE_DOMAIN` ever stops being `.evotv.co`, or
   everyone on `app.` lands signed out.
8. **Secrets passed through the session transcript**: the Resend key and the
   Google client secret. Rotate when convenient.

---

## 8. Cloudflare, as configured

`api.evotv.co` is proxied. One cache rule: URI path starts with `/hls/` **and**
ends with `.ts`, cache eligible, edge TTL from origin.

Verified: segments `MISS` then `HIT`, manifest `DYNAMIC` and never cached, auth
and SSE both fine through the proxy.

**Do not cache the `.m3u8`.** It rewrites every two seconds; caching it freezes
playback for everyone at once. The origin sends `no-store`, and the rule matches
`.ts` only, deliberately at both layers.

One constraint worth knowing: Cloudflare's terms restrict sustained video
delivery on free and Pro plans, and their own answer for video is Cloudflare
Stream. At launch traffic this is unlikely to matter. At scale it is the reason
Path B exists.

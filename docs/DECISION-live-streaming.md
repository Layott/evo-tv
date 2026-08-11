# Can Cloudflare + DigitalOcean run our live streams, or do we fall back to embedding Twitch/YouTube?

Short answer: **use Cloudflare Stream. Do not serve video off the droplet, and
do not fall back to embedding Twitch or YouTube.** The app and the website are
already wired for Cloudflare Stream and need no code changes to use it.

---

## Why Cloudflare Stream, concretely

Both players already take a plain HLS URL:

| Surface | Player | Takes |
|---|---|---|
| Website | `components/stream/hls-player.tsx`, hls.js plus native Safari HLS | an `.m3u8` |
| App | `EVOTV-app/.../hls-player.tsx`, expo-video | an `.m3u8` |

And the admin flow to point them at one exists and is tested end to end:

1. Admin creates the stream in `/admin/streams`.
2. Paste the Cloudflare playback URL into `hlsUrl`.
3. Flip it live.
4. It appears under "Live now" on the site and in the app.

So the integration work for Cloudflare Stream is **zero code**. It is an account
setup task: create a Live Input, point OBS or ffplayout at the RTMP URL it gives
you, copy the playback `.m3u8` into the admin form.

## Why not serve it from the droplet

The droplet is `s-2vcpu-4gb`. Two problems, either one disqualifying:

- **CPU.** Adaptive bitrate means transcoding one input into several renditions.
  Two vCPUs will not do that for even one 1080p stream while also running the
  app, Postgres connections, Valkey and Caddy. Skipping ABR means every viewer
  gets the 1080p ladder, which is the wrong call for Nigerian mobile data.
- **No edge.** The droplet is in Frankfurt. Every viewer in Lagos pulls every
  segment from Frankfurt. Cloudflare Stream serves from an edge near the viewer.

Bandwidth is the third problem but the least interesting: the plan includes 4 TB
of transfer, and at roughly 1 GB per viewer-hour that is about 3,600 viewer-hours
a month before overage, shared with everything else the droplet serves.

**One caution worth checking before anyone suggests it:** putting the standard
Cloudflare CDN (the orange cloud) in front of self-hosted video is not the same
thing as Cloudflare Stream. Cloudflare has historically restricted serving large
volumes of video through the standard CDN, and Stream is the product intended
for it. Confirm the current terms before relying on the free CDN for video.

## Cost, so it is a decision and not a guess

Cloudflare Stream bills delivery per minute watched, historically about **$1 per
1,000 minutes delivered**, plus storage for recordings at about $5 per 1,000
minutes stored. **Confirm today's rates before committing** - this changes.

On those numbers, delivery of a live show costs roughly:

| Concurrent viewers | Show length | Viewer-minutes | Delivery |
|---|---|---|---|
| 100 | 2 h | 12,000 | ~$12 |
| 500 | 2 h | 60,000 | ~$60 |
| 1,000 | 3 h | 180,000 | ~$180 |

That scales with success rather than with capacity planning, which is the right
shape for launch: nothing to over-provision, and no cliff where the droplet
falls over.

## Why not embed Twitch or YouTube

It is genuinely the fastest thing to ship, and it is free. It is still the wrong
call here:

- **It is not zero work.** Neither gives you an HLS URL, so the existing players
  cannot use them. You would add a second player path plus a WebView in the app.
  That is a code change on launch day, against a path that is already working.
- **You lose the product.** Chat, polls, tips, the ad slot and the viewer count
  are all EVO TV surfaces built around our own player. Embedding puts the
  audience inside somebody else's frame, with their branding, their
  recommendations pulling viewers away at the end of the stream, and their
  policies over your content.
- **You lose the data.** Watch events, analytics, and the viewer counts the
  admin dashboard reports all come from our own playback.

Embedding is a reasonable **contingency** if the Stream account cannot be
provisioned in time, and it is worth knowing it costs roughly half a day of work
rather than being a switch that can be flipped. It is not the plan.

## What to do

1. Enable Cloudflare Stream on the account and create a Live Input.
2. Point OBS, or ffplayout for the scheduled rotation, at that RTMP URL.
3. Paste the playback `.m3u8` into the stream in `/admin/streams` and take it
   live.
4. Watch it on both the site and the app.

Nothing in the codebase blocks this today. The one gap that did block it has
been fixed: nothing could mark a stream live for an externally originated
channel, because `isLive` was only ever set by our own RTMP callback, which a
Cloudflare-hosted stream never triggers.

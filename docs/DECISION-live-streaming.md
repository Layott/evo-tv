# How EVO TV delivers live video

**Decision, owner, 2026-08-16: not Cloudflare Stream.** It bills per minute
delivered, so the bill is a function of how many people watch, and there is no
setting that caps it. A bill that can only be discovered after the fact is not
acceptable, however cheap it looks per unit.

This supersedes the 2026-08-11 recommendation in this file, which was Cloudflare
Stream. That recommendation was right about the engineering and wrong about the
constraint that actually matters here.

**What we do instead: serve the HLS ourselves, from a machine with a price that
does not move, and make the software refuse to exceed what that machine can
carry.**

---

## The path already exists

Nothing needs to be built to start. `deploy/nginx-rtmp.conf` takes RTMP on 1935,
validates the stream key against `/api/rtmp/on-publish`, and writes HLS to
`/var/hls`; Caddy serves it at `/hls/*`. Both players take a plain `.m3u8`.

Two properties of that setup matter for cost:

- **The box does not transcode.** nginx repackages whatever the encoder sends.
  Adding a second quality is work for the encoder in the office, not for the
  server, so CPU stays flat as viewers arrive.
- **Bandwidth is the only thing that scales with the audience**, and bandwidth
  on a droplet is a fixed allowance, not a meter.

## What the current droplet can carry

Measured 2026-08-16: 2 vCPU, 4 GB, 116 GB disk, and **7.3 GB of egress in six
days**, which is nothing. The plan includes **4 TB a month**; DigitalOcean
charges $0.01/GB beyond it.

One viewer-hour costs, in transfer:

| Quality | Bitrate | Per viewer-hour | Viewer-hours in 4 TB |
|---|---|---|---|
| 480p | 0.8 Mbps | 0.36 GB | ~11,400 |
| 720p | 1.5 Mbps | 0.68 GB | ~6,000 |
| 1080p | 3 Mbps | 1.35 GB | ~3,000 |

So at 720p, a three-hour show with **100 concurrent viewers costs 203 GB**, and
the included allowance covers about **twenty such shows a month, for nothing**.
The same show on Cloudflare Stream would have been about $18; five hundred
concurrent would have been about $90 a show, every show, with no ceiling.

**The practical limit is throughput, not the allowance.** Five hundred viewers
at 1.5 Mbps is 750 Mbps sustained out of one droplet, which is optimistic for a
2 vCPU box on shared networking. Plan this machine for **300 concurrent**, and
treat the 4 TB as the monthly budget rather than the constraint.

## Making the cost unable to run away

An allowance is only a ceiling if something enforces it. Two pieces, neither
built yet:

1. **A hard concurrency cap.** The viewer heartbeat and the Valkey-shared count
   already exist. Above the cap the player says the channel is at capacity
   rather than everybody's stream stuttering. This is the valve: it converts
   "unbounded bill" into "bounded audience", which is a product decision
   somebody can actually make.
2. **A transfer watchdog.** A cron that reads the interface counter, warns at
   60% and 80% of the monthly allowance, and can drop the ladder to 480p. It
   makes overage something you decide rather than discover.

## When 300 concurrent is not enough

Move the origin to a machine with **unmetered bandwidth at a fixed price** - a
Hetzner dedicated box at roughly €44 a month gives 1 Gbit unmetered, which is
about 600 concurrent at 720p or 1,200 at 480p, at the same price whether one
person watches or all of them do. That is the answer to "the cost cannot run
away": the price is the price, and the only thing that changes is how many
people fit.

Each further box is another fixed step. This scales in known increments rather
than in a bill.

## What we give up, stated plainly

- **No edge in Africa.** Frankfurt to Lagos on every segment means a slower
  start and more rebuffering than a CDN would give. HLS with a few seconds of
  buffer absorbs most of it; nobody should promise low latency on this path.
- **One machine is one point of failure.** Cloudflare Stream would have been
  somebody else's problem at 3am.
- **No adaptive ladder unless the encoder makes one.** ffplayout and ffmpeg can
  output two or three renditions; OBS on its own cannot, easily.

If Lagos playback turns out to be genuinely bad, the smallest fix is a per-GB
CDN in front of the origin at roughly $0.01 to $0.06 per GB, which is a
different order of magnitude from per-minute video billing, and which can be
switched off. That is a per-GB cost again, so it needs the same watchdog, and
it is an optimisation to reach for after real viewers complain, not before.

## What is not on the table

**Embedding Twitch or Kick as the main TV.** Tested in a real browser on
2026-08-16, at desktop and phone widths:

- Twitch's embedded player **renders nothing at all on a mobile user agent**,
  and this audience is on phones.
- Kick's embed works on a phone, and carries Kick's own logo and a "Visit KICK
  for HD" call to action over our page.
- Kick's API answers **403 to a cross-origin fetch even from a real browser**,
  so there is no playback URL to pull into our own player. Their iframe is the
  only way in, which means a WebView in the app and a second player path.

It would also cost the product: chat, polls, tips, the ad slot, viewer counts
and every watch event come from our own player.

**Multistreaming is a different thing and it is fine.** Send the same feed to
our ingest and to Kick or Twitch at the same time. The people who arrive on
EVO TV get the full product; the platforms are reach.

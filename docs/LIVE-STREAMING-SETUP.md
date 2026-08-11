# Going live: encoder to viewer

Two ingest paths, both built and both working. Pick one per deployment; a
single stream can override it with `ingestKind` on create.

|  | Path A: self-hosted RTMP | Path B: Cloudflare Stream |
|---|---|---|
| Encoder pushes to | our droplet, port 1935 | Cloudflare, RTMPS 443 |
| Transcode ladder | none, single bitrate | automatic ABR |
| Delivery | our 2 vCPU droplet | Cloudflare edge |
| Cost | included in the droplet | ~5 USD per 1,000 minutes stored, 1 USD per 1,000 minutes delivered |
| Account needed | no | yes |
| Survives an audience | **no** | yes |
| Recording to VOD | manual | automatic |
| Good for | testing, a handful of viewers | launch |

**Use Path B for launch.** Path A exists so you can test tonight without an
account, and as a fallback that owes nobody a bill.

---

## Broadcast software

Anything that speaks RTMP works. Both paths take the same two fields, so the
setup is identical apart from which server and key you paste:

- **OBS Studio** (free, Windows/Mac/Linux). Settings, Stream, Service:
  **Custom**, then Server and Stream Key.
- **Streamlabs Desktop**, **vMix**, **Wirecast**, **XSplit** - same two fields.
- **ffmpeg**, for automation and playout: `-f flv rtmp://SERVER/KEY`.
- **ffplayout**, if you want a 24/7 scheduled channel rather than a person
  clicking Start.
- **Phone**: Larix Broadcaster (iOS and Android), free, takes an RTMP URL.

Cloudflare additionally accepts **SRT** (better over a lossy connection, and
the SRT URL comes back with the live input) and **WHIP/WebRTC** for sub-second
latency. Path A is RTMP only.

Recommended OBS output settings for a Nigerian upstream: 1280x720, 30fps,
2500 kbps video, 128 kbps audio, keyframe interval **2 seconds**. The keyframe
interval matters more than the bitrate: HLS segments cut on keyframes, so a
long interval means long segments and slow startup.

---

## Path B: Cloudflare Stream setup

### 1. Enable Stream

Cloudflare dashboard, left sidebar, **Stream**. It is a paid product: add a
payment method and subscribe. Billing is per minute stored and per minute
delivered, so an idle channel costs nothing.

### 2. Get the account id

Dashboard, any domain, right-hand sidebar, **Account ID**. Or read it out of
the URL: `dash.cloudflare.com/<ACCOUNT_ID>/...`.

```
CLOUDFLARE_ACCOUNT_ID=<that value>
```

### 3. Create an API token

My Profile, **API Tokens**, Create Token, Custom token.

- Permissions: **Account** -> **Stream** -> **Edit**
- Account Resources: include the account above
- No IP filter needed; it is called from the droplet

```
CLOUDFLARE_STREAM_API_TOKEN=<the token, shown once>
```

### 4. Find the playback subdomain (optional)

Stream, any video, Embed tab. The URL contains `customer-<CODE>`. Setting it
skips a derivation step:

```
CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=customer-abc123def456
```

Leave blank and it is read off each live input instead. Either works.

### 5. Wire the webhook so `isLive` flips itself

Pick any long random string as the shared secret:

```
CLOUDFLARE_STREAM_WEBHOOK_SECRET=<32+ random chars>
```

Then in the dashboard: **Notifications**, Add, **Stream Live Input**, delivery
method Webhook, URL:

```
https://api.evotv.co/api/webhooks/cloudflare-stream?token=<the same secret>
```

Without this the stream still works, but somebody has to toggle "live" by hand
at both ends of every broadcast, and forgetting the second toggle leaves the
site claiming to be live all night.

The endpoint returns **503** when the secret is unset rather than accepting
anonymous writes to `isLive`.

### 6. Safety net for missed webhooks

A webhook is one delivery attempt at a moment you do not control. If the app is
redeploying when a broadcast starts, it is simply missed. Set a cron secret:

```
CRON_SECRET=<another long random string>
```

and on the droplet, every two minutes:

```cron
*/2 * * * * curl -fsS -H "authorization: Bearer $CRON_SECRET" \
  https://api.evotv.co/api/cron/reconcile-live > /dev/null
```

It asks Cloudflare what is actually happening and corrects the row. When
Cloudflare cannot be reached it changes nothing, so an API outage never takes a
live broadcast off the schedule.

### 7. Go live

1. Admin, Streams, create a stream. The response carries an RTMPS **Server**
   and **Stream Key**.
2. Paste both into OBS. Start Streaming.
3. The webhook flips the stream live within a second or two, and it appears on
   `/home`, on `/channel`, and in `/schedule` as a dated row overriding the
   weekly grid.
4. Stop Streaming. The disconnect webhook ends it and Cloudflare keeps the
   recording as a VOD.

Lost the key? `GET /api/admin/streams/[id]/ingest` returns it again. Cloudflare
stores it, unlike ours.

---

## Path A: self-hosted RTMP

### Locally

```bash
cd backend/infra
docker compose up -d nginx-rtmp     # RTMP on 1935, HLS on 8080
```

`.env.local`:

```
RTMP_INGEST_URL=rtmp://localhost:1935/live
RTMP_HLS_BASE_URL=http://localhost:8080/hls
```

Create a stream with `"ingestKind": "rtmp"`, then point OBS at
`rtmp://localhost:1935/live` with the returned key. nginx calls
`/api/rtmp/on-publish`, which validates the key and flips the stream live; the
manifest appears at `RTMP_HLS_BASE_URL/<key>.m3u8` and the player loads it.

Testing without OBS, a synthetic 720p broadcast:

```bash
ffmpeg -re -f lavfi -i "testsrc2=size=1280x720:rate=30" \
       -f lavfi -i "sine=frequency=440" \
       -c:v libx264 -preset veryfast -tune zerolatency -b:v 2500k -g 60 \
       -pix_fmt yuv420p -c:a aac -b:a 128k \
       -f flv rtmp://localhost:1935/live/<STREAM_KEY>
```

### On the droplet

```bash
docker compose --profile rtmp up -d
```

Port 8080 stays closed. Caddy reaches nginx over the compose network and serves
`/hls/*` on the API host over TLS, with playlists no-cache and segments
immutable. Only 1935 is exposed.

```
LIVE_INGEST=rtmp
RTMP_INGEST_URL=rtmp://138.68.126.199:1935/live
RTMP_HLS_BASE_URL=https://api.evotv.co/hls
```

#### Use the IP, not a hostname

There is deliberately no `ingest.evotv.co`.

RTMP cannot go through Cloudflare's proxy: the proxy handles HTTP and HTTPS
ports only, so an ingest record would have to be DNS-only. And **a single
DNS-only record under a proxied zone hands out the origin IP to anyone who
enumerates subdomains**, which defeats the orange cloud on every other hostname
at once. Subdomain enumeration is automated and takes seconds.

No record means nothing to enumerate. An operator is already pasting a 32
character key, so pasting an IP alongside it costs nothing.

If a friendly name is ever wanted, put it on a domain that is never proxied, or
on a second droplet whose IP is not the web origin. Do not put it under a zone
you intend to protect.

`RTMP_HLS_BASE_URL` is different and **is** a normal hostname: playback is plain
HTTPS through Caddy, so it proxies fine.

#### Port 1935 is exposed whatever you do

Cloudflare cannot shield it without Spectrum, which is Enterprise pricing. That
is inherent to self-hosting RTMP, not a configuration mistake. Two mitigations,
in order of value:

1. **Restrict the source.** If the broadcast location is fixed, limit 1935 to
   that IP in the DO firewall. A captured key is then useless from anywhere
   else, which matters because RTMP is plaintext and the key crosses the
   network in the clear.
2. **Rotate on suspicion.** Regenerating is instant and costs one re-paste.

Path B removes this entirely: the encoder pushes to Cloudflare, nothing reaches
the droplet, and no port opens.

#### Firewall

The droplet runs a DO Cloud Firewall with inbound TCP 22, 80 and 443 only, and
no `ufw` on top. Ingest needs **1935/tcp** added.

Control panel: Networking, Firewalls, pick the droplet's firewall, Inbound
Rules, New rule -> Custom, TCP, port `1935`, Sources: the broadcast IP (or All
IPv4 / All IPv6), Save.

Or with `doctl`:

```bash
doctl compute firewall list                       # find the firewall id
doctl compute firewall add-rules <FIREWALL_ID>   --inbound-rules "protocol:tcp,ports:1935,address:<BROADCAST_IP>/32"
```

Confirm from a machine that is not the droplet:

```bash
nc -vz 138.68.126.199 1935
```

#### When the zone goes orange

Proxying only helps if the origin refuses direct traffic. `deploy/cloudflare-firewall.sh`
rewrites the 80/443 rules to Cloudflare's published ranges, so knowing the
origin IP stops being useful for attacking the site. Dry run by default:

```bash
./deploy/cloudflare-firewall.sh <FIREWALL_ID>          # show the plan
./deploy/cloudflare-firewall.sh <FIREWALL_ID> --apply  # do it
```

#### The Stream Key is `<streamId>?key=<secret>`

Not the bare secret, and the shape matters.

nginx-rtmp names its HLS output after the RTMP stream name. When the name was
the key, the public playback URL read `/hls/<STREAM_KEY>.m3u8`, so every viewer
was handed the credential needed to broadcast as the channel, visible in the
network tab. Publishing under the stream id keeps the output path public and
the credential private; nginx-rtmp forwards the query argument to the
authorising callback, so the key still does the authenticating.

Paste the whole string, query argument included, into OBS's Stream Key field.

A broadcaster still configured with a bare key keeps working, because the
callback accepts either. **That path leaks the key to every viewer.** Regenerate
and re-paste rather than leaving it.

#### Rotate the key if it ever leaks

Admin, Streams, open the stream, **Regenerate key**. The old key stops
authenticating immediately. Any encoder still configured with it will be
rejected at connect, so re-paste the new one into OBS.

### What Path A will not do

No adaptive bitrate: a viewer on a weak connection gets buffering rather than a
lower rendition. Every segment is served by the droplet, so bandwidth and CPU
scale linearly with the audience, and 2 vCPUs run out fast. There is no
recording to VOD. Treat it as a test rig and a fallback.

---

## Two gotchas worth knowing

**Chrome cannot play HLS natively.** `canPlayType("application/vnd.apple.mpegurl")`
answers `"maybe"` and then fails silently at `readyState 0`. The player uses
hls.js wherever Media Source Extensions exist and only falls back to native
playback on Safari and iOS. Do not reorder those checks.

**Chrome will not open a MediaSource while the tab is hidden.** A minimised
window or a background tab reproduces every symptom of a broken player with
perfectly correct code. Check `document.visibilityState` before debugging
playback.

---

## Verified

Path A, end to end, against a real encoder:

- ffmpeg pushed 720p H.264 / AAC to `rtmp://localhost:1935/live/<key>`
- `on-publish` returned 200, `isLive` became true, the manifest URL was stored
- `GET /hls/<key>.m3u8` returned 200 `application/vnd.apple.mpegurl` with a
  rolling segment list
- `ffprobe` on that manifest reported `h264 1280x720` plus `aac 44100`, and
  ffmpeg decoded three seconds off the live edge with no errors
- killing the encoder fired `on-publish-done`; `isLive` went false and
  `endedAt` was stamped

Not yet confirmed: the browser painting those frames. Every Chrome window
available in the build environment reports `visibilityState: "hidden"`, so the
MediaSource never opens there. **Load a live stream on a visible window and
watch it.** That is the one remaining check.

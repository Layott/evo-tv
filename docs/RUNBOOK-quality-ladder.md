# The quality ladder: what the office has to send

Until now the channel went out as **one rendition at roughly 2,667 kbps**. A
viewer who could not hold 2.7 Mbps had nothing to drop to, so they did not get a
softer picture, they got a permanent spinner. On a mobile-first Nigerian
audience that is most of the audience, and no amount of player buffering fixes
it, because the bytes are not arriving fast enough to play at all.

The server side of the ladder is now in place. This is the half that has to
happen in the office.

## The rule that makes this affordable

**The droplet does not transcode.** nginx repackages whatever arrives. Making
the rungs is work for the encoder in the office, so server CPU stays flat no
matter how many people watch, and that property is the only reason self-hosting
is cheaper than a per-minute CDN.

Do not "fix" this by adding `exec ffmpeg` to the nginx config. Transcoding three
renditions on a 2 vCPU box would fall over under its own weight and take the
channel with it.

## What to publish

Three RTMP streams instead of one, same server, same key, different names:

| Rung | Publish name | Video | Resolution | Audio |
|---|---|---|---|---|
| Low | `<streamId>_low` | 400 kbps | 640x360 | 64 kbps |
| Mid | `<streamId>_mid` | 900 kbps | 854x480 | 96 kbps |
| High | `<streamId>_hi` | 2,200 kbps | 1280x720 | 128 kbps |

The stream key still goes in the query string exactly as it does today, so each
rung publishes to:

```
rtmp://<server>:1935/live/<streamId>_low?key=<secret>
rtmp://<server>:1935/live/<streamId>_mid?key=<secret>
rtmp://<server>:1935/live/<streamId>_hi?key=<secret>
```

nginx strips the suffix and writes one master playlist at `<streamId>.m3u8`
listing all three. **The playback URL does not change.** Viewers keep the URL
they already have and simply gain rungs.

Keep the keyframe interval identical on all three (2 seconds, matching
`hls_fragment`). If the rungs have different keyframe timing, players cannot
switch cleanly between them and the picture stutters at every change.

## Option A: OBS with the multi-RTMP plugin

Simplest if the office already runs OBS.

1. Install the `obs-multi-rtmp` plugin.
2. Set the main OBS output to the `_hi` rung: 1280x720, 2,200 kbps, keyframe
   interval 2s, x264, `veryfast`.
3. Add two more targets in the multi-RTMP dock, one per remaining rung, each
   with its own resolution and bitrate from the table.

Cost: the office machine now encodes three streams at once. Budget a real CPU
for it, or use a GPU encoder (NVENC) where available.

## Option B: one ffmpeg command

Better if the office feeds a capture card or an existing source, and it is the
option to script if this becomes routine. One decode, three encodes, three
outputs:

```bash
ffmpeg -i <SOURCE> \
  -filter_complex "[0:v]split=3[v1][v2][v3]; \
    [v1]scale=w=640:h=360[v1out]; \
    [v2]scale=w=854:h=480[v2out]; \
    [v3]scale=w=1280:h=720[v3out]" \
  -map "[v1out]" -c:v:0 libx264 -b:v:0 400k  -maxrate:v:0 440k  -bufsize:v:0 800k \
  -map "[v2out]" -c:v:1 libx264 -b:v:1 900k  -maxrate:v:1 990k  -bufsize:v:1 1800k \
  -map "[v3out]" -c:v:2 libx264 -b:v:2 2200k -maxrate:v:2 2400k -bufsize:v:2 4400k \
  -x264-params "keyint=48:min-keyint=48:scenecut=0" -preset veryfast -g 48 -sc_threshold 0 \
  -map a:0 -c:a aac -b:a 64k  -f flv "rtmp://<server>:1935/live/<streamId>_low?key=<secret>" \
  -map a:0 -c:a aac -b:a 96k  -f flv "rtmp://<server>:1935/live/<streamId>_mid?key=<secret>" \
  -map a:0 -c:a aac -b:a 128k -f flv "rtmp://<server>:1935/live/<streamId>_hi?key=<secret>"
```

`keyint=48` is 2 seconds at 24 fps. At 30 fps use 60, at 25 fps use 50. It has
to line up with `hls_fragment 2s` on the server or segments will not align
across rungs.

## What the server does with it

- `deploy/nginx-rtmp.conf` declares the three `hls_variant` rungs. The local
  twin at `infra/nginx-rtmp/nginx.conf` matches it, so a rehearsal proves the
  same behaviour.
- `on-publish` strips the suffix (`baseStreamName`) so the stream row stores the
  **master** playlist URL, not one rung's. Storing `_hi.m3u8` would pin every
  viewer to the top rung and undo the whole exercise.
- Three publishes are one broadcast. `on-publish` returns OK without inserting
  when a live stream already exists for the same master URL, otherwise one show
  would appear three times in the schedule and burn three slots of the
  publisher's concurrent cap.
- `on-publish-done` only ends the broadcast on the **`_low`** rung, because that
  is the cheapest rung and so the last to fail. Losing 720p to a congested
  uplink should not take the channel off the site while 480p and 360p are still
  going out fine.

## Checking it worked

```bash
curl -s https://api.evotv.co/hls/<streamId>.m3u8
```

A working ladder answers with `#EXT-X-STREAM-INF` lines, one per rung, each
naming its own playlist. If you get `#EXTINF` and segment names instead, you are
looking at a single rendition and the encoder is still publishing one stream.

Then confirm the rungs are real, not just declared:

```bash
curl -s -o /dev/null -w "%{size_download}\n" https://api.evotv.co/hls/<streamId>_low-1.ts
```

A 360p 2-second segment should be on the order of 100 KB. If it comes back the
same size as the `_hi` segment, the encoder is sending three copies of the same
quality and the ladder is decorative.

## What this does not fix

Every viewer still pulls from one droplet in Frankfurt. The ladder cuts the
bytes per viewer by roughly three quarters at the bottom rung, which buys a lot
of headroom against the 4 TB monthly allowance, but it does not put a server
near Lagos. That is a separate decision, recorded in
`docs/DECISION-live-streaming.md`.

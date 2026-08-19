# ffplayout on the office Windows machine

Answering "can ffplayout work on Windows, and what does it take". Yes, and the
integration with this platform already exists: `scripts/push-epg-to-ffplayout.mjs`
turns the same `/api/schedule` the TV guide reads into ffplayout's playlist for a
given day, so what airs and what the guide promises cannot drift.

## What you are installing

ffplayout is 24/7 playlist automation: it plays scheduled files continuously and
pushes the result out over RTMP. It replaces "somebody leaves OBS looping a
folder" for the always-on channel. It does not replace OBS for live camera or
desk work.

The project is built in Rust on FFmpeg and is written primarily as a Linux
service, but there are Windows desktop builds; the current one at the time of
writing is v2.0.0-rc5, published 19 July 2026, as
`ffplayout-v2.0.0-rc5_desktop_x86_64-pc-windows-msvc.zip`.

## Requirements

- **FFmpeg 7.0 or newer.** The Windows build deliberately ships **without**
  FFmpeg's DLLs, so it will not start until you supply them.
- **At least 4 dedicated threads and about 3 GB RAM for 720p.** Add headroom per
  extra rung: four rungs is four encodes.
- A drive with the programme files on it, and one filler file for the gaps.

## Steps

1. **Download** the Windows desktop zip from the project's releases page and
   unpack it somewhere permanent, for example `C:\ffplayout`.
2. **Add FFmpeg.** Download a BtbN FFmpeg **shared** GPL build (8.1 works), and
   copy the DLLs from its `bin` into ffplayout's `bin`. Without this the binary
   starts and immediately exits.
3. **Run it** and open `http://127.0.0.1:8787`. The first run creates the admin
   account. Everything below is done in that web UI.
4. **Point the channel at the media drive** in Configuration, and set the filler
   file. Storage, playlist and logging paths are per channel.
5. **Set the output.** Mode `stream`, and the target is this platform's ingest:
   server `rtmp://138.68.126.199:1935/live`, publish name
   `<streamId>_hi?key=<stream key>` from Admin, Streams, OBS / RTMP settings.
   Keyframe interval 2 seconds and CBR, exactly as the Encoder setup page says,
   because the server repackages rather than transcodes: whatever ffplayout
   sends is what viewers get.
6. **Autostart.** There is no systemd here. Task Scheduler, trigger "at log on",
   action the ffplayout binary, and set the machine to log in automatically if
   it is a dedicated box.
7. **Feed it the schedule.** On the same machine:

   ```
   set EVOTV_API_BASE=https://api.evotv.co
   set FFPLAYOUT_URL=http://127.0.0.1:8787
   set FFPLAYOUT_USER=<admin>
   set FFPLAYOUT_PASS=<password>
   set FILLER_SOURCE=D:\media\filler.mp4
   node scripts/push-epg-to-ffplayout.mjs
   ```

   It pushes tomorrow by default, takes a date to push a specific day, and
   `DRY_RUN=1` prints the playlist instead of uploading it. `media-map.json`
   maps a programme title to the file that plays it. Run it once a day from Task
   Scheduler.

## The one thing to decide before going live

The ladder is four separate RTMP publishes and ffplayout's stream mode is one
output. Two ways round it, neither of them a checkbox:

- **Custom output parameters.** ffplayout's stream mode takes classic FFmpeg
  output arguments, so one command can split the decoded frame, scale it four
  ways and publish four RTMP targets. This is the efficient answer and it is
  hand-written FFmpeg, so test it off air before it becomes the channel.
- **One rung only.** Publish `_hi` alone and accept that viewers who cannot hold
  2.8 Mbps have nothing to fall back to, which is the exact failure the ladder
  was built to end.

Whichever way, re-measure what each rung actually sends afterwards and correct
`hls_variant BANDWIDTH` in `deploy/nginx-rtmp.conf`. A rung that costs more than
it claims makes a phone pick it and then stall.

# Ads, ingest and filler

Owner's list, 19 August 2026, with the four answers that scope it:

- Ad spaces on **home rails, the watch page, pre-roll, and the browse pages**.
- **House promos only for now**, built so campaigns can sit on top later.
- When the feed drops, **rotate through the uploaded ads**.
- 1080p rung is **Premium only**.

Everything here lands on the website and the app. The app is not a follow-up
phase: a slot that exists on one surface and not the other is the thing the
owner has had to ask about twice.

---

## Phase 1: the small ones, no new subsystems

**1.1 Pillar can be blank.** `pillar` is `text NOT NULL` with an enum on
`streams`, `shows` and `epg_slots`, so there is no way to say "not one of the
three". Migration drops the NOT NULL; the selects gain a "No pillar" option
that writes `null`; the schedule filters treat null as "shows in every filter"
rather than dropping the row. Check `lib/recommendations` and the week grid,
both of which currently assume a pillar exists.

**1.2 The feed can be waited on indefinitely.** `reconnectWindowSec` is capped
at 3600 by the PATCH route. Add `-1` meaning never end by itself, teach
`reconcile-live` and `on-publish-done` to skip the timeout when it is negative,
and add the option to both admin surfaces. An operator ending it by hand stays
the way out.

**1.3 Four stream keys, not one.** The ladder is three separate publishes and
the admin screen shows one key, so an operator has to know to append `_low`,
`_mid`, `_hi` themselves. The screen should print one full ingest URL per rung,
including the 1080p rung once 3.2 lands, each with its copy button.

**1.4 A page that says how to set the encoder up.** OBS, vMix and ffplayout,
each with the server URL, the per-rung keys, the bitrate and keyframe settings
the ladder expects, and the traps already paid for: Aitum ignores bitrate and
keyframe interval, and `BANDWIDTH` comes from the nginx config rather than the
stream, so an overshooting encoder makes the playlist lie. Lives at
`/admin/streams/setup`, linked from the OBS panel.

---

## Phase 2: the ad library and the slots

**2.1 Schema.** Three tables, following `video_view_buckets` (migration 0040)
rather than logging one row per impression:

- `ad_creatives`: name, kind (`image` | `gif` | `video`), fileUrl, clickUrl,
  altText, durationSec (how long it holds a slot, and how long it plays as
  filler or pre-roll), isActive, deletedAt.
- `ad_placements`: creativeId, placement key, weight, sortOrder, startsAt,
  endsAt. A creative can sit in several places.
- `ad_stat_buckets`: creativeId, placement, day, impressions, views, clicks.
  Aggregated on write, the way video analytics already does it, so a popular
  banner does not write a row per viewer per page.

Placement keys: `home_rail`, `watch_side`, `browse_banner`, `preroll`,
`filler`.

**2.2 Serving.** `GET /api/ads?placement=<key>` returns the active creatives for
one slot, weighted, never more than the slot renders. Server-rendered on the
website so an empty slot occupies no space and a full one does not shift the
layout in.

**2.3 Counting.** `POST /api/ads/<id>/event` with `impression`, `view` or
`click`. Impression when it renders, view when it has been on screen for two
seconds (IntersectionObserver on web, `onViewableItemsChanged` on native),
click on the way out to the destination. Deduplicated per session per day so a
viewer who reloads ten times is not ten impressions.

**2.4 The slot component.** `<AdSlot placement=... />` renders **nothing** when
the slot is empty: no frame, no label, no reserved space. That is the owner's
rule, and it is also what keeps the page honest before anything is sold.

**2.5 Admin.** `/admin/ads`: upload a creative through the existing presign
route, set its click URL and duration, tick the placements it may appear in,
and see impressions, views and clicks per creative and per placement. Deleting
a creative keeps its stats.

---

## Phase 3: video ads

**3.1 Pre-roll.** Before a VOD or a live stream starts, play the `preroll`
creative for its duration, with the countdown visible. Recorded video and live
both. Not on a reload within the same session, or it becomes a punishment for
buffering.

**3.2 Filler when the feed drops.** Today a dropped feed shows a spinner until
the reconnect window runs out. Instead: the player switches to the `filler`
playlist and loops it, each creative for its own duration, and cuts back the
moment `stream:live-now` arrives on the SSE channel it already listens to.
Impressions count. If the playlist is empty, the holding card is what shows,
which is what happens today.

---

## Phase 4: the app

Everything above, on native: the slot component (`expo-image` for stills,
`expo-video` for video), pre-roll and filler in `hls-player.tsx`, and the ads
screen in the app's admin. The stat events are the same endpoint.

---

## Phase 5: 1080p, Premium only

A fourth rung in `deploy/nginx-rtmp.conf` and its twin, a fourth ingest key,
and the `maxHeight` entitlement doing the gating that already exists for it.
One 1080p viewer costs roughly what seven 360p viewers cost against the 4 TB
allowance, which is the whole reason for the gate. Re-measure the ladder after
the encoder changes, because `BANDWIDTH` is advertised from the config and not
from the stream.

---

## Order, and why

1 first, because none of it needs new tables and two of the items are
corrections to things that already exist. Then 2, which is the foundation the
rest of the ad work sits on: pre-roll and filler are both "play a creative",
and building them before the library exists would mean building the library
twice. 4 follows 2 and 3 immediately rather than being left as a phase that
never happens. 5 is independent and can go whenever the encoder is free.

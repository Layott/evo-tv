#!/usr/bin/env bash
# ffplayout-on-program-start.sh
# ─────────────────────────────────────────────────────────────────────────────
# ffplayout `task` hook. ffplayout runs this script on every program change.
# It asks ffplayout what's airing NOW, then tells the EVO TV backend so the app
# shows the real current program (flips isLive + now-airing on the linear row).
#
# Wire it in the ffplayout channel config (Settings → Advanced → task / or the
# `[task]` block in the channel's config), point it at this file, restart the
# engine. Re-querying /media/current keeps this stable across ffplayout versions
# (the exact arg/stdin shape of the task payload differs between releases).
#
# Required env (export these where ffplayout runs, e.g. the systemd unit):
#   FFP_URL                http://127.0.0.1:8787
#   FFP_TOKEN              a ffplayout API bearer token (long-lived)
#   FFP_CHANNEL_ID         1
#   EVOTV_API              https://evo-tv.vercel.app
#   EVOTV_LINEAR_STREAM_ID stream_xxx   (the linear channel's streams row id)
#   PLAYOUT_SECRET         must match the backend's PLAYOUT_SECRET env
#
# Needs: curl, jq.

set -euo pipefail

FFP_URL="${FFP_URL:-http://127.0.0.1:8787}"
FFP_CHANNEL_ID="${FFP_CHANNEL_ID:-1}"

now_json="$(curl -sf "${FFP_URL}/api/control/${FFP_CHANNEL_ID}/media/current" \
  -H "Authorization: Bearer ${FFP_TOKEN}")" || {
  echo "could not read /media/current" >&2
  exit 0   # never fail the playout because of a webhook hiccup
}

# ffplayout returns the current item; field names vary slightly by version, so
# probe the common shapes. `category` is where push-epg-to-ffplayout.mjs stashes
# the EpgRow id; `title` is the program title; `source` is the file/live URL.
source="$(echo "$now_json"   | jq -r '(.current_media.source // .media.source // .source // "")')"
title="$(echo "$now_json"    | jq -r '(.current_media.title // .media.title // .title // "")')"
target_id="$(echo "$now_json"| jq -r '(.current_media.category // .media.category // .category // "")')"

# Is this the filler/bumper? Treat filler as "no program" so the app doesn't
# advertise the bumper as a show. Adjust the match to your filler path.
# NOTE: during filler we still POST live:true but with empty title/targetId, so
# the backend keeps the channel ON AIR while clearing "now airing" — this is the
# intended "channel up, between programs" state, NOT a bug.
if [[ "$source" == *"filler"* || "$source" == *"bumper"* ]]; then
  title=""
  target_id=""
fi

curl -sf -X POST "${EVOTV_API}/api/internal/now-airing" \
  -H "Authorization: Bearer ${PLAYOUT_SECRET}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
        --arg streamId "${EVOTV_LINEAR_STREAM_ID}" \
        --arg title "${title}" \
        --arg targetId "${target_id}" \
        '{streamId:$streamId, live:true, title:($title|select(.!="")), targetId:($targetId|select(.!=""))}')" \
  >/dev/null || echo "now-airing POST failed (non-fatal)" >&2

exit 0

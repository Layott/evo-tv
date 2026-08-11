#!/usr/bin/env bash
# Start a synthetic 720p broadcast against the local nginx-rtmp, the way OBS
# would. Takes the stream key printed when the stream was created.
#
#   ./scripts/test-broadcast.sh sk_live_xxxxxxxx
#
# Ctrl-C stops it, which fires on-publish-done and ends the stream.
set -euo pipefail
KEY="${1:?usage: test-broadcast.sh <STREAM_KEY>}"
SERVER="${RTMP_INGEST_URL:-rtmp://localhost:1935/live}"
echo "Publishing to $SERVER/$KEY  (Ctrl-C to stop)"
exec ffmpeg -hide_banner -loglevel warning -re \
  -f lavfi -i "testsrc2=size=1280x720:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=44100" \
  -c:v libx264 -preset veryfast -tune zerolatency -b:v 2500k -g 60 -pix_fmt yuv420p \
  -c:a aac -b:a 128k \
  -f flv "$SERVER/$KEY"

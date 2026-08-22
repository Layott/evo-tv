#!/usr/bin/env bash
#
# Fetch the local city database that lib/geo/ip-location.ts reads.
#
#   ./geoip-refresh.sh                        -> /srv/evotv/geoip/city.mmdb
#   ./geoip-refresh.sh /tmp/city.mmdb         -> somewhere else
#
# Two sources, and the difference between them is an account:
#
#   DB-IP City Lite   the default. A public monthly file, no signup, no key.
#   MaxMind GeoLite2  used instead when MAXMIND_LICENSE_KEY is in /srv/evotv/.env
#                     (or the environment). Needs a free MaxMind account, and is
#                     generally the sharper of the two on mobile networks.
#
# Either way the result is one .mmdb file and the reader does not care which
# made it. Both are refreshed monthly at source, so this belongs on cron:
#
#   17 4 3 * *   /srv/evotv/geoip-refresh.sh >> /var/log/evotv-geoip.log 2>&1
#
# Deliberately shell rather than node: the droplet has no node outside the
# containers, and the containers mount this file read-only.
#
# Downloads to a temporary name and renames at the end, so a transfer that dies
# halfway cannot leave the running server reading half a database.

set -euo pipefail

DEST="${1:-/srv/evotv/geoip/city.mmdb}"
ENV_FILE="/srv/evotv/.env"
TMP="${DEST}.partial"

# Same single-value read as cron.sh: sourcing the file breaks on unquoted values
# containing spaces, and surrounding quotes are stripped because `vercel env
# pull` writes them.
if [ -z "${MAXMIND_LICENSE_KEY:-}" ] && [ -f "$ENV_FILE" ]; then
	MAXMIND_LICENSE_KEY="$(sed -n 's/^MAXMIND_LICENSE_KEY=//p' "$ENV_FILE" | head -n1 | tr -d '\r' | sed 's/^"\(.*\)"$/\1/')"
fi

mkdir -p "$(dirname "$DEST")"
rm -f "$TMP"

if [ -n "${MAXMIND_LICENSE_KEY:-}" ]; then
	echo "source: MaxMind GeoLite2-City"
	WORK="$(mktemp -d)"
	trap 'rm -rf "$WORK"' EXIT
	curl -fsSL \
		"https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&suffix=tar.gz&license_key=${MAXMIND_LICENSE_KEY}" \
		-o "$WORK/geolite.tar.gz"
	tar -xzf "$WORK/geolite.tar.gz" -C "$WORK"
	# The archive holds a dated directory with the .mmdb inside it.
	FOUND="$(find "$WORK" -name '*.mmdb' -print -quit)"
	[ -n "$FOUND" ] || { echo "no .mmdb inside the MaxMind archive" >&2; exit 1; }
	cp "$FOUND" "$TMP"
else
	# This month, then last month: DB-IP publishes a few days into each one.
	THIS="$(date -u +%Y-%m)"
	LAST="$(date -u -d '1 month ago' +%Y-%m 2>/dev/null || date -u -v-1m +%Y-%m)"
	OK=0
	for STAMP in "$THIS" "$LAST"; do
		URL="https://download.db-ip.com/free/dbip-city-lite-${STAMP}.mmdb.gz"
		echo "source: $URL"
		if curl -fsSL "$URL" | gzip -dc > "$TMP" 2>/dev/null && [ -s "$TMP" ]; then
			OK=1
			break
		fi
		rm -f "$TMP"
	done
	[ "$OK" = 1 ] || { echo "DB-IP has no city-lite file for $THIS or $LAST" >&2; exit 1; }
fi

# A truncated transfer that still gunzipped would otherwise be renamed over a
# working file. 20 MB is far below any real edition and far above any error page.
SIZE="$(wc -c < "$TMP")"
if [ "$SIZE" -lt 20000000 ]; then
	echo "downloaded file is only $SIZE bytes, refusing to install it" >&2
	rm -f "$TMP"
	exit 1
fi

mv "$TMP" "$DEST"
echo "wrote $DEST ($(( SIZE / 1024 / 1024 )) MB)"

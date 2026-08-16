#!/usr/bin/env bash
#
# Watch the month's transfer out of the droplet, and say so before it runs out.
#
# EVO TV serves its own HLS, so being watched costs transfer, and the plan's
# allowance is the budget. This is the thing that turns that allowance into a
# ceiling somebody actually sees: without it the first sign of a problem is an
# invoice.
#
# Install:
#   cp deploy/bandwidth-watch.sh /srv/evotv/bandwidth-watch.sh
#   chmod +x /srv/evotv/bandwidth-watch.sh
#   crontab -e   ->   */30 * * * * /srv/evotv/bandwidth-watch.sh
#
# Read the log with:  grep evotv-bandwidth /var/log/syslog
#
# The interface counter only knows about the current boot, so the first month
# after installing this undercounts by whatever was served before the last
# reboot. Every month after that is counted from the first tick of the month.
# It reads the counter rather than DigitalOcean's billing API on purpose: no
# API token on the box, and a number that is always available beats a more
# accurate one that needs a credential to fetch.
set -euo pipefail

IFACE="${IFACE:-eth0}"
# DigitalOcean's s-2vcpu-4gb includes 4 TB out per month, and counts outbound
# only: inbound is free, so a 24/7 ingest from the office costs nothing here.
ALLOWANCE_GB="${ALLOWANCE_GB:-4096}"
STATE="${STATE:-/var/lib/evotv/bandwidth.json}"
ENV_FILE="${ENV_FILE:-/srv/evotv/.env}"
API="${API:-http://127.0.0.1:3060}"
# Percentages that are worth waking somebody for. 60 is "plan the month", 80 is
# "decide something", 95 is "it is about to cost money".
THRESHOLDS="${THRESHOLDS:-60 80 95}"

log() { logger -t evotv-bandwidth "$*"; }

mkdir -p "$(dirname "$STATE")"

counter_now="$(awk -v i="$IFACE:" '$1 == i { print $10 }' /proc/net/dev)"
if [ -z "$counter_now" ]; then
	log "interface $IFACE not found in /proc/net/dev, doing nothing"
	exit 0
fi

month_now="$(date +%Y-%m)"

if [ -f "$STATE" ]; then
	month_prev="$(sed -n 's/.*"month":"\([^"]*\)".*/\1/p' "$STATE")"
	used_prev="$(sed -n 's/.*"usedBytes":\([0-9]*\).*/\1/p' "$STATE")"
	counter_prev="$(sed -n 's/.*"counter":\([0-9]*\).*/\1/p' "$STATE")"
	fired_prev="$(sed -n 's/.*"fired":"\([^"]*\)".*/\1/p' "$STATE")"
else
	month_prev=""
	used_prev=0
	counter_prev=0
	fired_prev=""
fi

: "${used_prev:=0}"
: "${counter_prev:=0}"

# A reboot zeroes the interface counter, and a counter that went backwards is
# the only evidence of it. Treat the whole current reading as new bytes rather
# than subtracting into a negative.
if [ "$counter_now" -ge "$counter_prev" ]; then
	delta=$((counter_now - counter_prev))
else
	log "counter reset detected (was $counter_prev, now $counter_now), counting from zero"
	delta="$counter_now"
fi

if [ "$month_now" != "$month_prev" ]; then
	# New billing month: the allowance resets, so the count and the alerts do.
	used=$delta
	fired=""
	log "new month $month_now, counters reset"
else
	used=$((used_prev + delta))
	fired="$fired_prev"
fi

used_gb=$(awk -v b="$used" 'BEGIN { printf "%.2f", b / 1073741824 }')
pct=$(awk -v u="$used_gb" -v a="$ALLOWANCE_GB" 'BEGIN { printf "%d", (u / a) * 100 }')

printf '{"month":"%s","usedBytes":%s,"counter":%s,"fired":"%s"}\n' \
	"$month_now" "$used" "$counter_now" "$fired" > "$STATE"

log "month=$month_now used=${used_gb}GB of ${ALLOWANCE_GB}GB (${pct}%)"

# Highest threshold crossed that has not been announced yet. Only one alert per
# run, and only the first time each level is passed, or a busy month would send
# an alert every half hour.
to_fire=""
for t in $THRESHOLDS; do
	if [ "$pct" -ge "$t" ] && ! echo ",$fired," | grep -q ",$t,"; then
		to_fire="$t"
	fi
done

[ -z "$to_fire" ] && exit 0

CRON_SECRET="$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | head -n1 | tr -d '\r' | sed 's/^"\(.*\)"$/\1/')"
if [ -z "${CRON_SECRET:-}" ]; then
	log "CRON_SECRET missing from $ENV_FILE, cannot alert"
	exit 0
fi

payload="$(printf '{"usedGb":%s,"allowanceGb":%s,"thresholdPct":%s,"month":"%s"}' \
	"$used_gb" "$ALLOWANCE_GB" "$to_fire" "$month_now")"

if curl -fsS -m 30 -X POST "$API/api/cron/bandwidth-alert" \
	-H "Authorization: Bearer ${CRON_SECRET}" \
	-H "Content-Type: application/json" \
	-d "$payload" | logger -t evotv-bandwidth; then
	# Only record it as said once the API accepted it, so a failed alert is
	# retried on the next run instead of being lost.
	fired="${fired:+$fired,}$to_fire"
	printf '{"month":"%s","usedBytes":%s,"counter":%s,"fired":"%s"}\n' \
		"$month_now" "$used" "$counter_now" "$fired" > "$STATE"
	log "alerted at ${to_fire}%"
else
	log "alert POST failed, will retry next run"
fi

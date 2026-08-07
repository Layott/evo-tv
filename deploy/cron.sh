#!/usr/bin/env bash
# Replaces Vercel Cron. Lives at /srv/evotv/cron.sh, called from crontab.
#
# Usage: ./cron.sh <job-name>
# Hits the app on loopback, skipping Caddy and TLS entirely, so it keeps
# working even if a certificate has a problem.
#
# Install (crontab -e). These are Africa/Lagos times, not UTC like Vercel Cron
# was, so every job fires one hour earlier in absolute terms:
#
#   0    2 * * *   /srv/evotv/cron.sh analytics
#   0    3 * * 0   /srv/evotv/cron.sh payouts
#   0    4 * * 0   /srv/evotv/cron.sh gdpr-purge
#   0    5 * * *   /srv/evotv/cron.sh fantasy-score
#   */5  * * * *   /srv/evotv/cron.sh viewer-count
#   */15 * * * *   /srv/evotv/cron.sh reminders
#
# viewer-count and reminders were never scheduled on Vercel. They are now.

set -euo pipefail

JOB="${1:?usage: cron.sh <job-name>}"
ENV_FILE="/srv/evotv/.env"

# Read the one value we need rather than sourcing the file. Sourcing would
# break on unquoted values containing spaces or angle brackets, e.g.
#   SMTP_FROM=EVO TV <noreply@evotv.tv>
# which bash parses as a redirect.
#
# Surrounding double quotes are stripped: `vercel env pull` writes values
# quoted. Docker Compose strips them itself when reading env_file, so the file
# is left exactly as pulled and the stripping happens here instead. Without
# this the bearer token carries literal quotes and every job gets a 403.
CRON_SECRET="$(sed -n 's/^CRON_SECRET=//p' "$ENV_FILE" | head -n1 | tr -d '\r' | sed 's/^"\(.*\)"$/\1/')"
: "${CRON_SECRET:?CRON_SECRET missing from $ENV_FILE}"

curl -fsS -m 600 \
	-H "Authorization: Bearer ${CRON_SECRET}" \
	"http://127.0.0.1:3060/api/cron/${JOB}" \
	| logger -t "evotv-cron-${JOB}"

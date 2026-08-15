#!/usr/bin/env bash
#
# Deploy on push. Lives at /srv/evotv/autodeploy.sh, called from cron.
#
#   */2 * * * * /srv/evotv/autodeploy.sh
#
# Polls the tracked branch and runs deploy.sh when the remote SHA moves. Does
# nothing at all when it has not, which is almost every run.
#
# ── Why polling rather than a GitHub Action ──────────────────────────────────
#
# A push-based deploy needs an SSH private key for this droplet stored in
# GitHub secrets, and an inbound path for GitHub to reach the box. Anyone who
# compromises the repository, or a workflow file in it, gets a root shell here.
# Pull-based inverts that: no key leaves the droplet, no inbound port opens,
# and the worst a compromised repo can do is make the droplet build bad code,
# which the health check then refuses to put into rotation.
#
# The cost is latency. Up to the cron interval, so two minutes.
#
# ── What it will not do ──────────────────────────────────────────────────────
#
# Only DEPLOY_BRANCH is deployed. Pushing anything else is ignored, so a work
# in progress branch cannot reach production by being pushed to the wrong
# remote.
#
# Runs are serialised with a lock. A deploy takes longer than the cron
# interval, so without one a second run would start mid-build and two
# `docker compose up` calls would fight over the same containers.
#
# A failed deploy is not retried on a loop. The failed SHA is recorded and
# skipped until the branch moves again, because a build that fails once will
# fail every two minutes forever, and the logs fill with the same error while
# the real signal is buried. Fix forward with a new commit.

set -euo pipefail

ROOT="/srv/evotv"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
LOCK="/tmp/evotv-autodeploy.lock"
STATE="$ROOT/.autodeploy-failed-sha"
LOG_TAG="evotv-autodeploy"

log() { echo "$*" | logger -t "$LOG_TAG" -s 2>&1; }

# flock rather than a PID file: the kernel releases it if this script is killed,
# so a reboot mid-deploy cannot leave a stale lock that blocks every future run.
exec 9>"$LOCK"
if ! flock -n 9; then
  # Normal while a deploy is running. Not worth logging every two minutes.
  exit 0
fi

cd "$ROOT/api"

# The clone on the droplet was made single-branch, so its refspec only mapped
# the branch it was cloned from. Pointing DEPLOY_BRANCH at anything else then
# fetched into FETCH_HEAD and never created `origin/<branch>`: the rev-parse
# below failed, `set -e` killed the script before it could log anything, and
# every two minutes it died in silence while the site sat on an old commit.
#
# Widening the refspec is idempotent and costs nothing on a run that is already
# correct, so it happens here rather than in a runbook nobody reads.
git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'

# Read-only. Nothing here touches the working tree, so a run that finds no
# change cannot disturb a deploy that is somehow in flight.
git fetch --quiet --depth 1 origin "$DEPLOY_BRANCH" 2>/dev/null || {
  log "fetch failed for $DEPLOY_BRANCH, skipping"
  exit 0
}

LOCAL="$(git rev-parse HEAD)"

# Explicitly, rather than letting `set -e` end the script: a branch that does
# not exist on the remote is a typo in the crontab, and that should say so.
if ! REMOTE="$(git rev-parse --verify --quiet "origin/$DEPLOY_BRANCH")"; then
  log "no such branch origin/$DEPLOY_BRANCH, check DEPLOY_BRANCH in the crontab"
  exit 0
fi

[ "$LOCAL" = "$REMOTE" ] && exit 0

# Do not grind on a commit that already failed. Only a new commit clears it.
if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$REMOTE" ]; then
  exit 0
fi

log "deploying ${REMOTE:0:8} on $DEPLOY_BRANCH (was ${LOCAL:0:8})"

if "$ROOT/deploy.sh" "$DEPLOY_BRANCH" 2>&1 | logger -t "$LOG_TAG"; then
  rm -f "$STATE"
  log "deployed ${REMOTE:0:8}"
else
  # deploy.sh restarts one container at a time and waits for health, so a bad
  # build leaves the other one serving the previous version. The site stays up.
  echo "$REMOTE" >"$STATE"
  log "FAILED ${REMOTE:0:8}, will not retry until the branch moves. journalctl -t $LOG_TAG"
  exit 1
fi

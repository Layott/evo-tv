#!/usr/bin/env bash
# Deploy the backend. Lives at /srv/evotv/deploy.sh.
#
#   ssh evotv /srv/evotv/deploy.sh
#
# Pulls, rebuilds the api image, migrates, restarts, waits for /api/health.
#
# Migrations run INSIDE the api container (`docker compose run`) because the
# droplet has only Docker installed. There is deliberately no node or pnpm on
# the host.
#
# No automatic rollback: on a failed health check the old container is already
# replaced, so read the logs and fix forward. That is the tradeoff of the
# single-container setup (see docker-compose.yml for why it is single).

set -euo pipefail

ROOT="/srv/evotv"
BRANCH="${1:-main}"

cd "$ROOT/api"
echo "==> pulling $BRANCH"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"
SHA="$(git rev-parse --short HEAD)"

cd "$ROOT"

echo "==> building image ($SHA)"
docker compose build api

echo "==> running migrations"
docker compose run --rm --no-deps api pnpm db:migrate

echo "==> restarting"
docker compose up -d api

echo "==> waiting for health"
for i in $(seq 1 90); do
	if curl -fsS -o /dev/null http://127.0.0.1:3060/api/health; then
		echo "healthy after ${i}s"
		docker image prune -f >/dev/null
		echo "==> deployed $SHA"
		exit 0
	fi
	sleep 1
done

echo "FAILED: /api/health did not answer 200 within 90s"
docker compose logs --tail 80 api
exit 1

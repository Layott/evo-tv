#!/usr/bin/env bash
# Deploy the backend. Lives at /srv/evotv/deploy.sh.
#
#   ssh evotv /srv/evotv/deploy.sh                  # deploys main
#   ssh evotv /srv/evotv/deploy.sh feat/digitalocean
#
# Pulls, rebuilds the api image, migrates, then restarts the two api containers
# one at a time, waiting for each to report healthy before touching the next.
# Caddy's own health check pulls a restarting container out of rotation, so the
# whole thing is invisible to clients.
#
# Migrations run INSIDE the api container (`docker compose run`) because the
# droplet has only Docker installed. There is deliberately no node or pnpm on
# the host.
#
# No automatic rollback. If the first container fails to come back the second
# is still serving the old build, which is the entire point of doing it in this
# order: read the logs and fix forward with one container still up.

set -euo pipefail

ROOT="/srv/evotv"
BRANCH="${1:-main}"
API_SERVICES=(api-1 api-2)
HEALTH_TIMEOUT=120
CADDY_CHANGED=0
RTMP_CONF_CHANGED=0

cd "$ROOT/api"
echo "==> pulling $BRANCH"
git fetch --depth 1 origin "$BRANCH"
git reset --hard "origin/$BRANCH"
SHA="$(git rev-parse --short HEAD)"

cd "$ROOT"

# The three files that live at $ROOT are copies of what is in the repo. Without
# this sync a Caddyfile or compose change would be committed, pulled, and then
# silently ignored, because deploy.sh only ever rebuilt the api image.
#
# deploy.sh is in this list, which needs care: bash reads a script
# incrementally, so overwriting the file that is currently executing makes it
# resume at a byte offset into different content. `cp` in place would do
# exactly that. Writing a temp file and `mv`-ing it over is an atomic rename:
# the running shell keeps the original inode open and finishes the old copy,
# and the new one takes effect on the next run.
#
# Leaving deploy.sh out of the list was its own trap. It syncs the other files,
# so a change to WHICH files it syncs could never take effect: the old copy ran,
# used the old list, and quietly skipped the new entries. That is precisely how
# autodeploy.sh, nginx-rtmp.conf and cloudflare-firewall.sh ended up committed,
# pulled, and absent from the droplet.
echo "==> syncing deploy files from the repo"
for f in Caddyfile docker-compose.yml cron.sh autodeploy.sh nginx-rtmp.conf cloudflare-firewall.sh deploy.sh; do
	if ! cmp -s "$ROOT/api/deploy/$f" "$ROOT/$f"; then
		cp "$ROOT/api/deploy/$f" "$ROOT/$f.tmp"
		mv "$ROOT/$f.tmp" "$ROOT/$f"
		echo "    updated $f"
		[ "$f" = "Caddyfile" ] && CADDY_CHANGED=1
		[ "$f" = "nginx-rtmp.conf" ] && RTMP_CONF_CHANGED=1
		[ "$f" = "deploy.sh" ] && echo "    (deploy.sh changed; the new version runs next deploy)"
	fi
done
chmod +x "$ROOT/cron.sh" "$ROOT/autodeploy.sh" "$ROOT/cloudflare-firewall.sh" "$ROOT/deploy.sh"

echo "==> building image ($SHA)"
docker compose build api-1

echo "==> running migrations"
docker compose run --rm --no-deps api-1 pnpm db:migrate

# Docker's own health status, not a loopback curl: only api-1 publishes a host
# port, so curl could not see api-2 at all.
wait_healthy() {
	local svc="$1" cid status
	cid="$(docker compose ps -q "$svc")"
	if [ -z "$cid" ]; then
		echo "FAILED: $svc has no container"
		return 1
	fi
	for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
		status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo missing)"
		case "$status" in
		healthy)
			echo "    $svc healthy"
			return 0
			;;
		unhealthy)
			echo "FAILED: $svc reported unhealthy"
			docker compose logs --tail 80 "$svc"
			return 1
			;;
		esac
		sleep 1
	done
	echo "FAILED: $svc did not report healthy within ${HEALTH_TIMEOUT}s (last status: ${status:-unknown})"
	docker compose logs --tail 80 "$svc"
	return 1
}

for svc in "${API_SERVICES[@]}"; do
	echo "==> restarting $svc"
	docker compose up -d --no-deps --force-recreate "$svc"
	wait_healthy "$svc"
done

# nginx-rtmp reads its config once at start, and the file is bind mounted from
# $ROOT, so a changed on_publish callback or DVR window does nothing until the
# container is recreated. Only touched when the rtmp profile is actually up:
# `ps -q` is empty otherwise and this is skipped, so a Cloudflare-only
# deployment never sees it.
if [ "$RTMP_CONF_CHANGED" = "1" ] && [ -n "$(docker compose ps -q nginx-rtmp 2>/dev/null)" ]; then
	echo "==> restarting nginx-rtmp (config changed)"
	# Interrupts any broadcast in progress. There is no reload for the RTMP
	# module, so this is the honest cost of changing that file.
	docker compose --profile rtmp up -d --no-deps --force-recreate nginx-rtmp
fi

if [ "$CADDY_CHANGED" = "1" ]; then
	# Reload rather than restart: Caddy swaps config with no dropped
	# connections, which matters because /api/sse/* holds streams open.
	echo "==> reloading caddy"
	docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
fi

# Belt and braces: prove the published loopback port actually answers, which is
# the same path cron.sh uses.
echo "==> checking loopback"
curl -fsS -o /dev/null http://127.0.0.1:3060/api/health

docker image prune -f >/dev/null
echo "==> deployed $SHA"

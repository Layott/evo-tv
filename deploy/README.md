# deploy/

Everything needed to run EVO TV on a single DigitalOcean droplet.

Full context and reasoning: `../../EVOTV-app/docs/DIGITALOCEAN_MIGRATION.md`.

| File | Goes to | Purpose |
|---|---|---|
| `docker-compose.yml` | `/srv/evotv/docker-compose.yml` | four services: `api-1`, `api-2`, `valkey`, `caddy` |
| `Caddyfile` | `/srv/evotv/Caddyfile` | TLS, static sites, reverse proxy, SSE handling |
| `env.production.example` | `/srv/evotv/.env` (filled in, `chmod 600`) | every value the stack reads |
| `cron.sh` | `/srv/evotv/cron.sh` | replaces Vercel Cron, 6 jobs |
| `deploy.sh` | `/srv/evotv/deploy.sh` | pull, build, migrate, rolling restart |
| `../Dockerfile` | stays in repo | built by compose |

## First-time server setup

Droplet: `s-2vcpu-4gb-amd`, Ubuntu 24.04, FRA1, SSH key at create time, Monitoring + IPv6 + weekly backups on, in a VPC. Attach a Reserved IP and point DNS at that, never at the droplet's own address.

```bash
# --- base ---
apt update && apt -y full-upgrade
timedatectl set-timezone Africa/Lagos
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
curl -fsSL https://get.docker.com | sh
apt -y install unattended-upgrades

# --- ssh: keys only ---
cat >/etc/ssh/sshd_config.d/99-evotv.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
MaxAuthTries 3
EOF
sshd -t && systemctl restart ssh

# --- layout ---
mkdir -p /srv/evotv && cd /srv/evotv
git clone https://github.com/Layott/evo-tv.git api
mkdir -p web app
cp api/deploy/docker-compose.yml api/deploy/Caddyfile api/deploy/cron.sh api/deploy/deploy.sh .
chmod +x cron.sh deploy.sh
```

Then a **DO Cloud Firewall**: inbound TCP 22, 80, 443 only. That is the firewall; no `ufw` on top.

## Environment

Copy `env.production.example` to the box as `/srv/evotv/.env`, fill it in, `chmod 600`.

Values worth pulling out of the old Vercel project once (`vercel env pull`, then archive the file somewhere off the droplet): `PLAYOUT_SECRET`, `CRON_SECRET`, `AUTH_SECRET`, `LOGIN_HASH_SALT`, SMTP credentials, OAuth client secrets. Everything else is new. It is `AUTH_SECRET`: nothing in this codebase reads `BETTER_AUTH_SECRET`.

**Changing `PLAYOUT_SECRET` breaks the office media agent and the `/admin/schedule` file browser.** It carries over unchanged.

Three env vars are feature switches, and each one is also the rollback:

| Variable | Set | Unset |
|---|---|---|
| `SPACES_KEY` | uploads go to DO Spaces | uploads are refused, and the admin picker says so |
| `REDIS_URL` | Valkey pub/sub bus, two api containers safe | in-process EventEmitter, **one container only** |
| `DATABASE_URL` | whatever it points at | required, the app throws without it |

## The bucket needs a CORS rule, or every upload fails

The dashboard uploads with a presigned PUT straight at Spaces, so the request never reaches the API and the **bucket** decides whether to allow it. Without a CORS rule the browser refuses before sending a byte, and the only symptom is a failed fetch.

That was the state of `evotv-media` on 2026-08-16: a preflight for `https://evotv.co` answered 403 with no `Access-Control-Allow-Origin`. Check it from anywhere:

```bash
curl -i -X OPTIONS "https://evotv-media.fra1.digitaloceanspaces.com/admin-uploads/probe.png" \
  -H "Origin: https://evotv.co" -H "Access-Control-Request-Method: PUT"
```

A rule is in place when that returns 200 with `access-control-allow-origin`. To set it, on the droplet where the keys live:

```bash
cd /srv/evotv/api && node deploy/spaces-cors.mjs
```

Local development does not need this: `SPACES_ENDPOINT` and `SPACES_FORCE_PATH_STYLE` point the same code at any S3-compatible server (MinIO on `127.0.0.1:9100`, say), which is how the upload path is exercised without production credentials.

## Hostnames

`Caddyfile` takes its four hostnames from `.env`, so moving from a staging hostname to the real domain is an env edit and a restart rather than a file edit on the box.

Before DNS exists, use `sslip.io`. It resolves any `*.1-2-3-4.sslip.io` to `1.2.3.4`, so one Reserved IP yields three real hostnames that Let's Encrypt will happily certify:

```ini
API_HOST=api.203-0-113-7.sslip.io
WEB_HOSTS=203-0-113-7.sslip.io
APP_HOST=app.203-0-113-7.sslip.io
```

Once `evotv.co` resolves to the Reserved IP:

```ini
API_HOST=api.evotv.co
WEB_HOSTS=evotv.co, www.evotv.co
APP_HOST=app.evotv.co
REDIRECT_HOSTS=evotv.africa, www.evotv.africa
REDIRECT_TARGET=evotv.co
```

`BETTER_AUTH_URL` and `ALLOWED_ORIGINS` have to move in the same edit or login breaks. Then `docker compose up -d caddy` and watch the certificates issue.

`REDIRECT_HOSTS` defaults to a placeholder on a reserved `.invalid` TLD with an explicit `http://` scheme, so Caddy neither resolves it nor asks for a certificate while `evotv.africa` has no DNS.

## Start

DNS (or the sslip.io hostname) must resolve to the droplet **before** this, or certificate issuance fails and backs off.

```bash
cd /srv/evotv
docker compose up -d --build
docker compose logs -f caddy      # watch the certificates issue
```

## Static sites

Built on the laptop, copied up:

```powershell
pnpm --dir "...\EVOTV-WEBSITE" build
scp -r "...\EVOTV-WEBSITE\dist\*" evotv:/srv/evotv/web/

pnpm --dir "...\EVOTV-app" expo export --platform web
scp -r "...\EVOTV-app\dist\*" evotv:/srv/evotv/app/
```

## Crons

```bash
crontab -e
```

```cron
0    2 * * *   /srv/evotv/cron.sh analytics
0    3 * * 0   /srv/evotv/cron.sh payouts
0    4 * * 0   /srv/evotv/cron.sh gdpr-purge
0    5 * * *   /srv/evotv/cron.sh fantasy-score
*/5  * * * *   /srv/evotv/cron.sh viewer-count
*/15 * * * *   /srv/evotv/cron.sh reminders
*/30 * * * *   /srv/evotv/bandwidth-watch.sh
```

Box time is Africa/Lagos, so these fire an hour earlier in absolute terms than the UTC schedule they replaced.

## Bandwidth

We serve our own HLS, so being watched costs transfer out of the droplet, and
the plan's allowance is the budget. `bandwidth-watch.sh` reads the interface
counter every half hour, keeps the month's total in
`/var/lib/evotv/bandwidth.json`, and notifies every admin the first time the
month passes 60%, 80% and 95%. Install it alongside the other scripts:

```bash
cp api/deploy/bandwidth-watch.sh /srv/evotv/bandwidth-watch.sh
chmod +x /srv/evotv/bandwidth-watch.sh
grep evotv-bandwidth /var/log/syslog | tail
```

**A 24/7 channel is charged for viewers, not for being on.** Nobody watching
costs nothing: the ingest from the office is inbound and DigitalOcean does not
count inbound, and `hls_cleanup` keeps the segments on disk at about 100 MB.
What the clock changes is that viewer-hours accumulate around the clock, so the
number that matters is the *average* concurrent audience, not the peak during a
show. At 720p the 4 TB allowance is about **8 viewers watching continuously for
a month**; at 480p it is about 15.


## Day to day

```bash
ssh evotv /srv/evotv/deploy.sh                    # deploy main
ssh evotv /srv/evotv/deploy.sh feat/digitalocean  # deploy a branch
docker compose logs -f api-1                      # tail one container
docker compose ps                                 # status, with health
```

`deploy.sh` restarts `api-1`, waits for Docker to report it healthy, then does `api-2`. Caddy's own active health check (`health_uri /api/health`, every 10s) pulls the restarting one out of rotation, so clients see no 502.

## Rules

- **Two api containers are only safe while `REDIS_URL` is set.** `lib/sse/bus.ts` falls back to an in-process EventEmitter without it, and then a subscriber on `api-1` cannot see an emit on `api-2`. Live chat, notifications and watch parties break silently, with no error anywhere.
- **`flush_interval -1` stays on the SSE route.** Without it Caddy buffers the stream and chat looks frozen.
- **`api` stays DNS-only on Cloudflare** (grey cloud). The free tier drops idle proxied connections at around 100s, which would kill every SSE stream on a loop.
- **Never delete the `caddy_data` volume.** It holds the certificates.
- **`valkey` is never published to a host port.** It has no auth and holds a live message bus.
- The droplet holds no data. `.env` is the only thing on it worth backing up.

## Local development database

Production is DigitalOcean Managed Postgres. A local checkout does not need any
hosted database at all: nothing in this codebase is tied to a host, the client
is plain `postgres` (postgres-js) reading `DATABASE_URL`.

```bash
docker compose -f deploy/docker-compose.dev.yml up -d
pnpm db:migrate
```

Postgres 17 to match production's major version, on port 55432 because this
machine already runs other database containers on 5432. Credentials are in
`docker-compose.dev.yml` and are deliberately boring: it listens on localhost
and holds nothing that is not disposable.

To copy the current data into it from another Postgres:

```bash
docker run --rm postgres:17-alpine pg_dump "$SOURCE_URL" \
  --no-owner --no-privileges > dump.sql
docker exec -i evotv_dev_db psql -U evotv -d evotv < dump.sql
```

Include the `drizzle` schema when you do, or `pnpm db:migrate` will try to
replay every migration onto a database that already has them.

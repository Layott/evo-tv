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
| `SPACES_KEY` | uploads go to DO Spaces | falls back to Vercel Blob, no deploy needed |
| `REDIS_URL` | Valkey pub/sub bus, two api containers safe | in-process EventEmitter, **one container only** |
| `DATABASE_URL` | whatever it points at | required, the app throws without it |

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
```

Box time is Africa/Lagos. Vercel Cron ran UTC, so these fire an hour earlier in absolute terms.

`viewer-count` and `reminders` were never scheduled on Vercel. They are now.

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

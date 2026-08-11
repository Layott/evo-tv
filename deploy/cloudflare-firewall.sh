#!/usr/bin/env bash
#
# Lock the droplet's web ports to Cloudflare, so proxying actually protects it.
#
# The orange cloud only helps if the origin refuses traffic that did not come
# through Cloudflare. Left open to 0.0.0.0/0, anyone who learns the origin IP
# hits it directly and the proxy, the WAF and the rate limiting are all bypassed
# in one step. Learning the IP is easy: an old DNS record, a certificate
# transparency log, an email header, a subdomain that was never proxied.
#
# This replaces the "80 and 443 from anywhere" rules with Cloudflare's published
# ranges, fetched live rather than pasted from a blog post, because they change.
#
#   ./deploy/cloudflare-firewall.sh <FIREWALL_ID>            # print the plan
#   ./deploy/cloudflare-firewall.sh <FIREWALL_ID> --apply    # make the change
#
# Find the id with:  doctl compute firewall list
#
# ── Safety ───────────────────────────────────────────────────────────────────
#
# SSH (22) is never touched. Neither is RTMP (1935): Cloudflare does not proxy
# it, so restricting it to Cloudflare ranges would break ingest outright.
#
# Rules are ADDED before anything is removed. There is no window where the site
# is unreachable, and if the script dies halfway the worst case is a firewall
# that is more permissive than intended, never one that has locked you out.
#
# ── Before you run this ──────────────────────────────────────────────────────
#
# Only run it once the records are actually proxied (orange). Locking 80/443 to
# Cloudflare while DNS still points straight at the droplet takes the site
# offline for everyone, because no request will be arriving from a Cloudflare
# address.
#
# Check first:  dig +short evotv.co
# A Cloudflare address (104.x, 172.6x.x) means proxied. 138.68.126.199 means it
# is not, and you should stop.

set -euo pipefail

FIREWALL_ID="${1:-}"
APPLY="${2:-}"

if [[ -z "$FIREWALL_ID" ]]; then
  echo "usage: $0 <FIREWALL_ID> [--apply]" >&2
  echo >&2
  echo "Find the id with: doctl compute firewall list" >&2
  exit 1
fi

command -v doctl >/dev/null 2>&1 || {
  echo "doctl not found. Install it and run 'doctl auth init' first." >&2
  exit 1
}

echo "Fetching Cloudflare ranges..."
V4="$(curl -fsS https://www.cloudflare.com/ips-v4)"
V6="$(curl -fsS https://www.cloudflare.com/ips-v6)"

if [[ -z "$V4" || -z "$V6" ]]; then
  echo "Could not fetch the ranges. Refusing to guess." >&2
  exit 1
fi

# Sanity check: a truncated or hijacked response must not become a firewall.
V4_COUNT="$(echo "$V4" | grep -c . || true)"
if (( V4_COUNT < 5 )); then
  echo "Only $V4_COUNT IPv4 ranges returned; expected ~15. Refusing." >&2
  exit 1
fi
echo "  $V4_COUNT IPv4 ranges, $(echo "$V6" | grep -c . || true) IPv6 ranges"

ADDRESSES="$(printf '%s\n%s\n' "$V4" "$V6" | grep . | paste -sd, -)"

ADD_RULES="protocol:tcp,ports:80,address:${ADDRESSES//,/,address:}"
ADD_RULES="${ADD_RULES} protocol:tcp,ports:443,address:${ADDRESSES//,/,address:}"

echo
echo "Plan for firewall $FIREWALL_ID:"
echo "  ADD    tcp/80  and tcp/443 from $(echo "$ADDRESSES" | tr ',' '\n' | grep -c .) Cloudflare ranges"
echo "  REMOVE tcp/80  and tcp/443 from 0.0.0.0/0 and ::/0"
echo "  KEEP   tcp/22   (SSH)"
echo "  KEEP   tcp/1935 (RTMP: Cloudflare does not proxy it)"
echo

echo "Current inbound rules:"
doctl compute firewall get "$FIREWALL_ID" --format InboundRules --no-header || true
echo

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry run. Re-run with --apply to make the change."
  echo
  echo "Check the zone is actually proxied first:"
  echo "  dig +short evotv.co"
  echo "A 104.x or 172.6x.x answer means proxied. The droplet IP means stop."
  exit 0
fi

# Confirm the zone is proxied. Locking the origin to Cloudflare while DNS still
# resolves to the droplet takes the whole site down.
RESOLVED="$(dig +short evotv.co 2>/dev/null | head -1 || true)"
if [[ "$RESOLVED" == "138.68.126.199" ]]; then
  echo "evotv.co still resolves to the droplet ($RESOLVED), so it is not proxied." >&2
  echo "Applying this now would take the site offline. Turn on the orange cloud first." >&2
  exit 1
fi

echo "Adding Cloudflare ranges..."
# shellcheck disable=SC2086
doctl compute firewall add-rules "$FIREWALL_ID" --inbound-rules $ADD_RULES

echo "Removing the open web rules..."
# Both stacks. Ignore failures: a rule that is already absent is the goal.
for addr in "0.0.0.0/0" "::/0"; do
  for port in 80 443; do
    doctl compute firewall remove-rules "$FIREWALL_ID" \
      --inbound-rules "protocol:tcp,ports:${port},address:${addr}" 2>/dev/null \
      || echo "  (no open rule for tcp/${port} from ${addr})"
  done
done

echo
echo "Done. Rules now:"
doctl compute firewall get "$FIREWALL_ID" --format InboundRules --no-header

cat <<'NOTE'

Verify from a machine that is not the droplet:

  curl -I https://evotv.co                 # should work, via Cloudflare
  curl -I --connect-to ::138.68.126.199 https://evotv.co   # should hang or refuse

The second one hitting the origin directly is the whole point of this change.

Cloudflare adds ranges occasionally. Re-run this after they do; adding a range
that is already present is a no-op.
NOTE

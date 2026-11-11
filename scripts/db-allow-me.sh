#!/bin/sh
# Keeps the current public IP of this machine in the trusted sources of the managed database (docs/runbooks/bfdb-postgres.md).
# Reads the firewall rules and writes only when the IP is missing. Ids come from the environment so none are committed.
# Usage: BF_DB_ID=<db cluster id> BF_K8S_ID=<k8s cluster id> sh scripts/db-allow-me.sh [--dry-run] [--force]

dry_run=0
force=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --force) force=1 ;;
  esac
done

if [ -z "${BF_DB_ID:-}" ] || [ -z "${BF_K8S_ID:-}" ]; then
  echo "db-allow-me: set BF_DB_ID (database cluster id) and BF_K8S_ID (Kubernetes cluster id)" >&2
  exit 2
fi

cache_dir="$HOME/.cache/bf"
stamp="$cache_dir/db-allow-me.stamp"
logfile="$cache_dir/db-allow-me.log"
mkdir -p "$cache_dir"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >>"$logfile"; }

# Opening several terminals at once must not hit the DigitalOcean API each time.
if [ "$force" -eq 0 ] && [ -n "$(find "$stamp" -mmin -10 2>/dev/null)" ]; then
  exit 0
fi

ip=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null)
case "$ip" in
  *[!0-9.]* | '' | *.*.*.*.*) log "failed: unexpected address from ipify"; exit 1 ;;
esac

rules=$(doctl databases firewalls list "$BF_DB_ID" 2>&1) || {
  log "failed: doctl list: $(printf '%s' "$rules" | head -n 1)"
  exit 1
}

if printf '%s\n' "$rules" | awk -v ip="$ip" '$3 == "ip_addr" && $4 == ip { found = 1 } END { exit !found }'; then
  [ "$dry_run" -eq 1 ] && echo "db-allow-me: $ip is already allowed; nothing to do"
else
  rule="k8s:$BF_K8S_ID,ip_addr:$ip"
  if [ "$dry_run" -eq 1 ]; then
    echo "db-allow-me: $ip is not allowed; would run: doctl databases firewalls replace <db> --rule $rule"
    exit 0
  fi
  if out=$(doctl databases firewalls replace "$BF_DB_ID" --rule "$rule" 2>&1); then
    log "allowed $ip"
  else
    log "failed: doctl replace: $(printf '%s' "$out" | head -n 1)"
    exit 1
  fi
fi

[ "$dry_run" -eq 1 ] || touch "$stamp"

#!/bin/sh
set -eu

CONF_DIR=/usr/local/etc/redis
CONF="${CONF_DIR}/redis.conf"
ACL="${CONF_DIR}/custom_aclfile.acl"

mkdir -p "${CONF_DIR}"
: > "${CONF}"
: > "${ACL}"

# --- ACL: disable the default user, create the app user with full access ---
if [ -z "${REDIS_USERNAME:-}" ] || [ -z "${REDIS_PASSWORD:-}" ]; then
  echo "Error: REDIS_USERNAME and REDIS_PASSWORD environment variables must be set." >&2
  exit 1
fi

echo "aclfile ${ACL}" >> "${CONF}"
echo "user default off" >> "${ACL}"
echo "user ${REDIS_USERNAME} on >${REDIS_PASSWORD} ~* &* +@all" >> "${ACL}"

# --- Memory ---
echo "maxmemory ${REDIS_MAXMEMORY:-1gb}" >> "${CONF}"
echo "maxmemory-policy ${REDIS_MAXMEMORY_POLICY:-volatile-lru}" >> "${CONF}"

# --- Persistence (data dir is the mounted volume) ---
echo "dir /data" >> "${CONF}"
echo "appendonly ${REDIS_APPENDONLY:-yes}" >> "${CONF}"

exec docker-entrypoint.sh redis-server "${CONF}"

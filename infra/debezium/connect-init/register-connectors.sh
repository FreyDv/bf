#!/bin/sh
# One-shot: registers every /connectors/<name>.json via idempotent
#   PUT /connectors/<name>/config
# <name> is the file basename (bf-outbox.json -> connector "bf-outbox").
#
# Retries because Kafka (separate compose file) and Postgres may still be starting.
# If the outbox tables do not exist yet, the connector is still created (the PUT
# succeeds); its task fails until migrations run. Afterwards either re-run this
# container or: curl -X POST http://localhost:8083/connectors/bf-outbox/restart?includeTasks=true
set -eu

CONNECT_URL="${CONNECT_URL:-http://debezium:8083}"
RETRIES="${CONNECT_RETRIES:-60}"
INTERVAL="${CONNECT_RETRY_INTERVAL:-5}"

echo "connect-init: waiting for ${CONNECT_URL}/connectors"
i=0
until curl -fsS "${CONNECT_URL}/connectors" > /dev/null 2>&1; do
  i=$((i + 1))
  if [ "${i}" -ge "${RETRIES}" ]; then
    echo "connect-init: Kafka Connect not reachable after ${RETRIES} attempts" >&2
    exit 1
  fi
  sleep "${INTERVAL}"
done

status=0
for file in /connectors/*.json; do
  [ -e "${file}" ] || { echo "connect-init: no connector files found"; break; }
  name="$(basename "${file}" .json)"
  echo "connect-init: registering ${name}"
  i=0
  ok=0
  while [ "${i}" -lt "${RETRIES}" ]; do
    i=$((i + 1))
    code="$(curl -sS -o /tmp/resp.json -w '%{http_code}' \
      -X PUT -H 'Content-Type: application/json' \
      --data-binary "@${file}" \
      "${CONNECT_URL}/connectors/${name}/config" || echo 000)"
    case "${code}" in
      200|201)
        echo "connect-init: ${name} -> HTTP ${code}"
        ok=1
        break
        ;;
      *)
        echo "connect-init: ${name} attempt ${i}/${RETRIES} -> HTTP ${code}: $(cat /tmp/resp.json 2>/dev/null | head -c 300)"
        sleep "${INTERVAL}"
        ;;
    esac
  done
  if [ "${ok}" -ne 1 ]; then
    echo "connect-init: failed to register ${name}" >&2
    status=1
  fi
done

echo "connect-init: connectors now: $(curl -fsS "${CONNECT_URL}/connectors" || true)"
exit "${status}"

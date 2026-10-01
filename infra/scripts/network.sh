#!/usr/bin/env sh
# Creates the shared bf_network bridge if it does not exist yet.
# Needed before running any single infra/<svc>/docker-compose.yml on its own.
set -eu

NETWORK="${BF_NETWORK:-bf_network}"

if docker network inspect "${NETWORK}" > /dev/null 2>&1; then
  echo "network ${NETWORK} already exists"
else
  docker network create --driver bridge --label bf "${NETWORK}"
  echo "created network ${NETWORK}"
fi

#!/bin/sh
# One-shot: creates the buckets in $MINIO_BUCKETS (space separated) and makes them private.
set -eu

mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"

for bucket in ${MINIO_BUCKETS:-bf-order}; do
  echo "minio-init: bucket ${bucket}"
  mc mb --ignore-existing "local/${bucket}"
  mc anonymous set none "local/${bucket}"
done

mc ls local
echo "minio-init: done"

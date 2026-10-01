#!/bin/bash
# One-shot: creates every topic listed in topics.txt (idempotent via --if-not-exists).
set -eu

BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVER:-kafka:9092}"
PARTITIONS="${KAFKA_TOPIC_PARTITIONS:-3}"
RF="${KAFKA_TOPIC_REPLICATION_FACTOR:-1}"
TOPICS_FILE="$(dirname "$0")/topics.txt"

echo "kafka-init: creating topics from ${TOPICS_FILE} on ${BOOTSTRAP}"

while IFS= read -r topic || [ -n "${topic}" ]; do
  topic="$(echo "${topic}" | sed -e 's/#.*//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [ -z "${topic}" ] && continue
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server "${BOOTSTRAP}" \
    --create --if-not-exists \
    --topic "${topic}" \
    --partitions "${PARTITIONS}" \
    --replication-factor "${RF}"
done < "${TOPICS_FILE}"

echo "kafka-init: done"
/opt/kafka/bin/kafka-topics.sh --bootstrap-server "${BOOTSTRAP}" --list

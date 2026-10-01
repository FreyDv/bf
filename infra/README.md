# infra

Local development infrastructure. One folder per service, each self-contained
(`docker-compose.yml`, `.env.example`, `.env`, optional `<svc>-init/`), all joined by the
shared `bf_network` bridge so containers reach each other by hostname (`postgres`,
`kafka`, `jaeger`, ...).

## Services

| folder       | image(s)                                               | host port(s)                                          | admin UI                           | credentials                                      |
| ------------ | ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------ |
| `postgres`   | postgres:17.5, dpage/pgadmin4:9.6                      | 5432                                                  | pgAdmin http://localhost:5050      | db `bf` / `bf` / `bf`; pgAdmin admin@bf.dev / bf |
| `redis`      | redis:7.4.5 (custom ACL entrypoint), redisinsight:2.70 | 6379                                                  | RedisInsight http://localhost:5540 | user `bf` / `bf` (default user disabled)         |
| `kafka`      | apache/kafka:3.9.1 (KRaft), kafka-ui:v0.7.2            | 29092 (host listener; in-network `kafka:9092`)        | Kafka UI http://localhost:8085     | none (PLAINTEXT)                                 |
| `debezium`   | quay.io/debezium/connect:3.2                           | 8083                                                  | REST http://localhost:8083         | none                                             |
| `nats`       | nats:2.11.8-alpine (JetStream), nats-box               | 4222, 8222 (monitoring)                               | http://localhost:8222              | none                                             |
| `rabbitmq`   | rabbitmq:4.1.3-management                              | 5672, 15672                                           | http://localhost:15672             | `bf` / `bf`, vhost `bf`                          |
| `clickhouse` | clickhouse-server:25.8, ch-ui                          | 8123 (HTTP), 19000 (native), 9363 (metrics)           | CH-UI http://localhost:5521        | db `bf` / `bf` / `bf`                            |
| `elastic`    | elasticsearch:8.19.2, kibana:8.19.2                    | 9200, 5601                                            | Kibana http://localhost:5601       | none (security disabled)                         |
| `minio`      | minio, mc (pinned releases)                            | 9000 (S3), 9001 (console)                             | Console http://localhost:9001      | `bf` / `bfbfbfbf`; bucket `bf-order`             |
| `mongo`      | mongo:8.0.12, mongo-express:1.0.2-20                   | 27017                                                 | http://localhost:8081              | root `root`/`root`; app `bf`/`bf` on db `bf`     |
| `prometheus` | prom/prometheus:v3.5.0                                 | 9090                                                  | http://localhost:9090              | none                                             |
| `grafana`    | grafana/grafana:12.1.1                                 | 3100                                                  | http://localhost:3100              | anonymous Admin (admin `bf`/`bf` also exists)    |
| `otel`       | otel-collector-contrib:0.132.0, jaeger:2.9.0           | 4317 (OTLP gRPC), 4318 (OTLP HTTP), 16686 (Jaeger UI) | Jaeger http://localhost:16686      | none                                             |

All ports and credentials come from each folder's `.env` (copy of `.env.example`; the
values above are the defaults). Change a port there, not in the compose file.

One database per service, created by `postgres/postgres-init/01-init.sql`: `auth`, `order`,
`course`, `billing`, `admin` (public schema each), plus dev-only roles `<svc>_user`
(password = role name). Migrations run as `bf` with `POSTGRES_DB=<svc>`.

## Running

```sh
# everything
docker compose -f infra/docker-compose.yml up -d

# core only (postgres, minio, otel) - enough for the apps run from the host
# whole platform incl. the apps: docker compose up --build -d (root docker-compose.yml)
docker compose -f infra/docker-compose.core.yml up -d

# one service on its own
./infra/scripts/network.sh                       # once: creates bf_network
docker compose -f infra/postgres/docker-compose.yml up -d

# stop / wipe
docker compose -f infra/docker-compose.yml down        # keep data
docker compose -f infra/docker-compose.yml down -v     # drop volumes
```

Elastic also ships an optional 3-node TLS cluster: `infra/elastic/docker-compose.cluster.yml`
(not part of the root compose files; login `elastic` / `ELASTIC_PASSWORD`).

## The `bf_network`

Every per-service compose declares `bf_network` as `external: true` so the files can be
combined freely. The root `docker-compose.yml` / `docker-compose.core.yml` declare it
(`networks.bf_network.name: bf_network`) and therefore create it when they are used;
when running a single service file directly, create it first with
`infra/scripts/network.sh` (or `docker network create bf_network`). Each service
additionally has its own private `<svc>_network`.

## Bootstrap order

`depends_on` cannot cross compose files, so the ordering between services is done with
healthchecks + retry loops, not hard dependencies:

1. **postgres** starts; on an empty volume `postgres-init/01-init.sql` creates the
   schemas and roles (idempotent).
2. **migrations** (run from the apps: `pnpm ... migrate`) create the tables, including
   `api.outbox` and `worker.outbox`.
3. **kafka** starts; `kafka-init` creates the topics in `kafka/kafka-init/topics.txt`
   (`orders.order.created`, `orders.order.confirmed` and their `.dlq` twins; 3 partitions,
   RF 1). Auto-creation of topics is disabled.
4. **debezium** (Kafka Connect) starts once it can reach `kafka:9092`; `connect-init`
   waits for the REST API and then `PUT`s every `debezium/connectors/<name>.json` to
   `/connectors/<name>/config` (idempotent, retries 60 x 5s). The `bf-outbox` connector
   uses `publication.autocreate.mode=filtered`, so it creates the `bf_outbox_pub`
   publication itself and no publication is created by the SQL init.

If Debezium is registered **before** the outbox tables exist, the connector is created but
its task fails. After running migrations, restart it:

```sh
curl -X POST 'http://localhost:8083/connectors/bf-outbox/restart?includeTasks=true'
# or simply re-run the registrar
docker compose -f infra/docker-compose.yml up connect-init
```

Outbox event routing: rows in `*.outbox` are routed to the topic named in the
`destination` column (`aggregate_id` -> key, `payload` -> value, `type` -> header).

## Observability wiring

- Apps export OTLP to `localhost:4317` (gRPC) / `localhost:4318` (HTTP) -> collector.
- Collector sends traces to Jaeger (`jaeger:4317`) and exposes metrics on
  `otel-collector:8889`, which Prometheus scrapes.
- Prometheus also scrapes the apps directly on the host: `host.docker.internal:3000`
  (api), `:3001` (worker), `:3002` (gateway) at `/metrics`.
- Grafana is provisioned with the Prometheus and Jaeger datasources.

## Known dev shortcuts

Everything here is for local development only:

- Plaintext, committed credentials everywhere (`bf` / `bf`); `.env` files are identical to
  `.env.example`.
- Debezium connects to Postgres as the `bf` superuser (it needs `REPLICATION` and the
  ability to create publications); a dedicated replication role should be used elsewhere.
- Kafka is a single KRaft node, PLAINTEXT, replication factor 1.
- Elasticsearch runs with `xpack.security.enabled=false`; Grafana allows anonymous Admin;
  pgAdmin runs in desktop mode with no master password.
- The `otel-collector` and `jaeger` containers have no Docker healthcheck (distroless
  images); they expose `:13133` health endpoints inside the network instead.
- `ch-ui` is not pinned (`latest`) because no tag was verified when this was written.

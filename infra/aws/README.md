# infra/aws — one EC2 host + Aurora Serverless v2 (AWS CDK, TypeScript)

The whole platform runs with `docker compose` on **one** `t4g.medium` machine behind Caddy; Postgres is Aurora
Serverless v2 that **pauses to zero** when nobody is connected. No load balancer, no NAT gateway, no Fargate:
≈ $40–85/month instead of ≈ $180.

```
Route 53 (malinina.ca)  A → Elastic IP                 CNAME db.malinina.ca → Aurora endpoint
        │
        ▼  security group: 80/443 only
┌─ EC2 t4g.medium, docker compose (host/compose.yml) ───────────┐
│  caddy :80/:443 (Let's Encrypt)      ← the only published ports
│    ├─ malinina.ca        → fe-main:3000                       │
│    ├─ api.malinina.ca    → api:3000 ──► auth, order, course,  │
│    └─ admin.malinina.ca  → fe-admin:3000   billing, admin, ai │
│  containers reach the internet (OpenAI, S3) through the       │
│  docker bridge NAT; nothing can connect back in               │
└───────────────┬───────────────────────────────────────────────┘
                ▼  5432: from the host, plus your IP (pnpm db:allow-me)
   Aurora Serverless v2 Postgres, 0–4 ACU, auto-pause after 10 min idle
```

Everything is TypeScript: the resources are CDK code in `lib/`, every operation is a script in `scripts/` that runs the
same way on a laptop and in GitHub Actions (`node infra/aws/scripts/<name>.ts` — Node ≥ 26 runs `.ts` directly).

| Path                   | Contents                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `lib/config.ts`        | **The one place to change things**: region, env, domains, hosted zone, instance type, AMI, DB capacity        |
| `lib/network.ts`       | VPC, two public subnets, three security groups (host, db, db-dev). No NAT, no private subnets                 |
| `lib/secrets.ts`       | Secrets Manager: `POSTGRES_PASSWORD` (generated), `JWT_*` / `OPENAI_API_KEY` (filled by `set-secrets.ts`)     |
| `lib/data.ts`          | Aurora Serverless v2 cluster, `db.<domain>` CNAME, the app S3 bucket                                          |
| `lib/host.ts`          | The machine: instance role, user data, Elastic IP, A records, log group, the host's non-secret env            |
| `lib/host-commands.ts` | The only shell: the flat command lists that run **on** the machine (first boot, each deploy)                  |
| `lib/github-stack.ts`  | Stack `bf-github`: OIDC trust, the four `bf-gha-*` roles, the `bf-cfn-exec` policy, artifact/snapshot buckets |
| `lib/prod-stack.ts`    | Stack `bf-prod`: wires network → secrets → data → host                                                        |
| `host/compose.yml`     | What runs on the machine. `host/Caddyfile`: the three public sites                                            |
| `scripts/*.ts`         | bootstrap, set-secrets, push-images, host-deploy, db-allow-me, db-url, db-snapshot, plan                      |

`cdk diff` shows what a deploy would change and `cdk deploy` only touches resources whose definition changed — the
machine and the database are not recreated unless you change a property that defines them (AMI, subnet, cluster id…).
The generated CloudFormation is always inspectable: `pnpm --filter @bf/infra-aws cdk synth bf-prod`.

## How the apps run

| App                    | Port | Reachable                         | Gets                                                          |
| ---------------------- | ---- | --------------------------------- | ------------------------------------------------------------- |
| `api`                  | 3000 | public, `https://api.malinina.ca` | JWT public key, routes `/<svc>/*` to the services below, CORS |
| `auth`                 | 3001 | compose network only              | DB `auth`, JWT **private** + public key                       |
| `order`                | 3002 | compose network only              | DB `order`, S3 bucket (instance role), `AUTH_URL`             |
| `course`               | 3003 | compose network only              | DB `course`                                                   |
| `billing`              | 3004 | compose network only              | DB `billing`, `ORDER_URL`                                     |
| `admin`                | 3005 | compose network only              | DB `admin`, all `*_URL`s                                      |
| `ai`                   | 3006 | compose network only              | OpenAI key (no DB)                                            |
| `fe-main` / `fe-admin` | 3000 | public, `malinina.ca` / `admin.…` | `NEXT_PUBLIC_*` baked in at build time (`lib/images.ts`)      |

"Private" means: no `ports:` in `compose.yml` and a security group that only opens 80/443. Outbound HTTP works for every
container; inbound is impossible except through Caddy.

One Aurora cluster, one database per app (`POSTGRES_DB=<app>`, created by the `db-init` compose service on every
deploy if missing), master user `bf`. Logs: CloudWatch group `/bf/prod/apps`, one stream per container, 30 days.

**Adding an app:** add its service to `host/compose.yml` (and a site to `host/Caddyfile` if it is public). Its ECR
repository and its database are created on the first deploy.

### Scale-to-zero rules (do not break them)

Aurora pauses only when **no connection is open**. That is why `compose.yml` sets `DB_POOL_MIN=0` (an idle pool closes
everything after 30 s), why nothing probes `/health/ready` (it runs `select 1`; the docker HEALTHCHECK uses
`/health/live`), and why logical replication is off. The first request after a pause waits ~15 s while the cluster
resumes (`DB_CONNECT_TIMEOUT_MS=30000`). Adding Debezium/Kafka later means replication slots → the cluster stays awake
(≈ $44/month at the 0.5 ACU floor).

TLS to the database is verified (`sslmode=verify-full`): the machine downloads the RDS CA bundle at first boot and the
containers get it through `NODE_EXTRA_CA_CERTS`.

## Database access from your laptop

```bash
pnpm db:allow-me                    # opens 5432 for your CURRENT public IP only (replaces the previous one)
pnpm -s db:url order                # postgresql://bf:<password>@db.malinina.ca:5432/order?sslmode=require
psql "$(pnpm -s db:url order)"
pnpm db:allow-me --revoke           # close it again
```

The URL never changes; re-run `db:allow-me` when your IP does. For everyone else the port does not answer.
`db.malinina.ca` is a CNAME, so the certificate name does not match it: `sslmode=require` works (psql, GUI clients);
tools that verify the hostname (Node `pg`, `drizzle-kit`) need the AWS endpoint — `pnpm -s db:url order --native`.

Shell on the machine (no SSH, no key pair): `aws ssm start-session --target <HostInstanceId stack output>`.

## One-time AWS setup (from your laptop, admin credentials)

```bash
aws sso login                                     # or aws configure — an admin in the target account
node infra/aws/scripts/bootstrap.ts <owner>/<repo>
```

It runs `cdk bootstrap`, deploys the stack `bf-github` (OIDC provider, roles `bf-gha-plan|infra|app|snapshot`, the
`bf-cfn-exec` policy, export role/KMS key, two S3 buckets) and then restricts what CloudFormation may do to that
policy. Already have a GitHub OIDC provider in the account? Set `createOidcProvider: false` in `lib/config.ts` first.
Then in GitHub:

1. Settings → Secrets and variables → Actions → **Variables**: `AWS_ACCOUNT_ID` (printed by the script). Not a secret.
2. Settings → Environments → create `prod` (+ required reviewers, optional).
3. Branch protection on `main`: require `ci ok`.

## First deploy

```bash
node infra/aws/scripts/bootstrap.ts <owner>/<repo>                       # once (above)
pnpm aws:diff                                                            # what will be created
pnpm aws:deploy                                                          # network, secrets, Aurora, the machine, DNS (~15 min)
OPENAI_API_KEY=sk-… node infra/aws/scripts/set-secrets.ts               # JWT key pair + OpenAI key
node infra/aws/scripts/push-images.ts $(git rev-parse --short HEAD)      # build arm64 images → ECR
pnpm aws:host-deploy                                                     # databases, migrations, compose up
pnpm db:allow-me && pnpm -s db:url                                       # your own access to Postgres
```

After that, merging to `main` does all of it.

## Day-to-day commands

| What                         | Command                                                                  |
| ---------------------------- | ------------------------------------------------------------------------ |
| Preview infra changes        | `pnpm aws:diff` (Markdown: `node infra/aws/scripts/plan.ts`)             |
| Apply infra changes          | `pnpm aws:deploy`                                                        |
| Build + push images          | `node infra/aws/scripts/push-images.ts <tag> [app …]`                    |
| Release to the machine       | `pnpm aws:host-deploy` (`--migrate none` / `--migrate auth,order`)       |
| See what a release would run | `pnpm aws:host-deploy --print`                                           |
| Rotate secrets               | `node infra/aws/scripts/set-secrets.ts [--rotate-jwt]`, then host-deploy |
| Snapshot the DB              | `node infra/aws/scripts/db-snapshot.ts manual`                           |

`host-deploy` uploads `host/*` to S3 and runs, on the machine through SSM: fetch bundle → write `.env` (SSM parameter +
Secrets Manager, read there so secrets never travel through SSM) → `docker compose pull` → `db-init` →
`drizzle-kit migrate` per app → `docker compose up -d`. Only containers whose image or config changed are recreated
(a few seconds of downtime for those).

## Delivery (GitHub Actions) — least privilege

No AWS keys in GitHub: workflows get short-lived credentials by OIDC, **one role per concern** (`lib/github-stack.ts`).

| Workflow          | Trigger                            | Role (what it may do)                                                       | What                                                                 |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ci.yml`          | PR, push `main`                    | none                                                                        | per affected app: prettier → eslint → tsc → unit; drift; e2e; docker |
| `preview.yml`     | PR                                 | `bf-gha-plan` — read-only                                                   | sticky PR comments: **release plan** and **infra diff** (`cdk diff`) |
| `infra.yml`       | `infra/aws/**` on `main`; dispatch | `bf-gha-infra` — may only assume the CDK deploy roles (CFN = `bf-cfn-exec`) | snapshot → `cdk deploy bf-prod`                                      |
| `deploy.yml`      | push `main`; dispatch (apps=…)     | `bf-gha-app` — ECR push, upload host bundle, SSM command on the tagged host | snapshot → build+push affected apps → `host-deploy.ts`               |
| `db-snapshot.yml` | called by the two above; dispatch  | `bf-gha-snapshot` — cluster snapshot + export, nothing else                 | Aurora snapshot + Parquet export to S3; keeps the last 10            |

Workflow steps are one-line calls of the same scripts (`scripts/ci/*.ts`, `infra/aws/scripts/*.ts`), so anything CI
does can be reproduced locally. A change to `host/compose.yml` or `host/Caddyfile` alone also triggers a rollout.
The stack `bf-github` is never deployed by GitHub — re-run `bootstrap.ts` after editing `lib/github-stack.ts`.

### Restoring from a pre-release snapshot

Snapshots are named `bf-prod-pre-<label>-<utc timestamp>`. Restore creates a **new** cluster
(`aws rds restore-db-cluster-from-snapshot --snapshot-identifier … --db-cluster-identifier bf-prod-restored …` plus a
`db.serverless` instance); copy the data back or point the stack at it. The S3 export is a Parquet archive for
inspection, not a restore source.

## Limits of this setup

- **Single machine = single point of failure.** State lives in Aurora and S3, so a lost machine is recreated by
  `pnpm aws:deploy`; its user data restarts the apps from the last uploaded bundle.
- **No app autoscaling.** Bigger machine: `host.instanceType` in `lib/config.ts` (stop/start, a minute of downtime).
- **Changing `host.amiId` replaces the machine**: new disk, Caddy requests fresh certificates (Let's Encrypt allows
  5 per week for the same names).
- **The first deploy needs the DNS records to resolve** before Caddy can get certificates — a few minutes after
  `aws:deploy`.

## Cost notes (us-east-1, approximate, ~730 h/month)

EC2 `t4g.medium` ≈ $24.5, EBS 30 GB ≈ $2.4, two public IPv4 (host + database) ≈ $7.3, Aurora storage $0.10/GB,
Aurora compute $0.12 per ACU-hour and **$0 while paused** (≈ $15 at 8 h/day awake, ≈ $44 if it never sleeps),
secrets/logs/Route 53/S3/ECR ≈ $5 → **≈ $40–85/month**. `t4g.large` (8 GB) adds ≈ $25.

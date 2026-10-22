/**
 * Scheduled jobs — designed, not built: there is no job app under apps/ yet.
 *
 * When the first one lands (`deploy: 'job'` in scripts/apps.mjs, e.g. a folder with a `schedule` field in its
 * package.json): one task definition per job from docker/nest.Dockerfile, an EventBridge Scheduler rule, and a
 * Step Functions state machine with an `ecs:runTask.sync` state whose `TimeoutSeconds` is the job's maximum
 * runtime (ECS itself has no maximum). Same task role / log group pattern as lib/services.ts.
 */
export const jobs: never[] = [];

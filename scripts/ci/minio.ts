// Starts MinIO for the e2e jobs, waits until it is healthy and creates the bucket.
// Usage: node scripts/ci/minio.ts      (env: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET; needs docker)
import { execFileSync } from 'node:child_process';

import { main } from './_gh.ts';

const SERVER_IMAGE = 'cgr.dev/chainguard/minio:latest';
const CLIENT_IMAGE = 'cgr.dev/chainguard/minio-client:latest';
const ENDPOINT = 'http://localhost:9000';

const docker = (...args: string[]) => execFileSync('docker', args, { stdio: 'inherit' });

main(async () => {
  const user = process.env.S3_ACCESS_KEY_ID ?? 'bfadmin';
  const password = process.env.S3_SECRET_ACCESS_KEY ?? 'bfbfbfbf';
  const bucket = process.env.S3_BUCKET ?? 'bf-order';

  docker(
    ...['run', '-d', '--name', 'minio', '-p', '9000:9000'],
    ...['-e', `MINIO_ROOT_USER=${user}`, '-e', `MINIO_ROOT_PASSWORD=${password}`],
    ...[SERVER_IMAGE, 'server', '/data'],
  );

  for (let attempt = 1; ; attempt++) {
    const healthy = await fetch(`${ENDPOINT}/minio/health/live`).then(
      (response) => response.ok,
      () => false,
    );
    if (healthy) break;
    if (attempt === 30) throw new Error('MinIO did not become healthy in 60 s');
    await new Promise((done) => setTimeout(done, 2000));
  }

  docker(
    ...['run', '--rm', '--network', 'host'],
    ...['-e', `MC_HOST_local=http://${user}:${password}@localhost:9000`],
    ...[CLIENT_IMAGE, 'mb', '--ignore-existing', `local/${bucket}`],
  );
});

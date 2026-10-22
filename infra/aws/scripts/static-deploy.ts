// Frontends → S3 + CloudFront: `next build` (static export) for every Next app (or the given ones), sync `out/` to the
// app's bucket (only changed files are uploaded, stale ones deleted), then invalidate the distribution paths.
// fe-admin lives under /admin on the same hostname, so its objects are stored under the key prefix `admin/`.
// Usage: node infra/aws/scripts/static-deploy.ts [app ...]          (AWS SDK only, no aws cli)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  CloudFrontClient,
  CreateInvalidationCommand,
  waitUntilInvalidationCompleted,
} from '@aws-sdk/client-cloudfront';
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import {
  accountId,
  apps,
  main,
  platformParams,
  positionals,
  repoRoot,
  run,
  sdk,
  summary,
} from './_lib.ts';
import { names } from '../lib/config.ts';
import { staticBuildEnv } from '../lib/images.ts';

import type { App } from './_lib.ts';

const s3 = new S3Client(sdk);
const cloudfront = new CloudFrontClient(sdk);

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  map: 'application/json',
  webmanifest: 'application/manifest+json',
};
const contentType = (file: string) =>
  CONTENT_TYPES[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Hashed build assets never change; HTML and other named files are revalidated by CloudFront. */
const cacheControl = (key: string) =>
  /\/_next\/static\//.test(`/${key}`)
    ? 'public, max-age=31536000, immutable'
    : /\.(html|txt|json|xml|webmanifest)$/.test(key)
      ? 'public, max-age=0, must-revalidate'
      : 'public, max-age=3600';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

async function existingObjects(bucket: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? [])
      if (o.Key && o.ETag) out.set(o.Key, o.ETag.replaceAll('"', ''));
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function parallel<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

async function deployApp(app: App, account: string, distributionId: string) {
  run('pnpm', ['--filter', app.name, 'build'], { env: staticBuildEnv(app) });
  const outDir = join(repoRoot, app.path, 'out');
  const prefix = app.basePath ? `${app.basePath.slice(1)}/` : '';
  const bucket = names.staticBucket(account, app.name);

  const files = walk(outDir).map((file) => ({
    file,
    key: `${prefix}${relative(outDir, file).split('\\').join('/')}`,
  }));
  // HTML last: a page never references an asset that is not there yet
  files.sort((a, b) => Number(a.key.endsWith('.html')) - Number(b.key.endsWith('.html')));

  const existing = await existingObjects(bucket);
  const changed = files.filter(({ file, key }) => {
    const md5 = createHash('md5').update(readFileSync(file)).digest('hex');
    return existing.get(key) !== md5;
  });
  await parallel(changed, 8, async ({ file, key }) => {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: readFileSync(file),
        ContentType: contentType(file),
        CacheControl: cacheControl(key),
      }),
    );
  });
  const wanted = new Set(files.map((f) => f.key));
  const stale = [...existing.keys()].filter((key) => key.startsWith(prefix) && !wanted.has(key));
  for (let i = 0; i < stale.length; i += 1000) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: stale.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
  console.log(
    `${app.name}: ${changed.length} uploaded, ${files.length - changed.length} unchanged, ${stale.length} deleted → s3://${bucket}/${prefix}`,
  );

  if (changed.length || stale.length) {
    const { Invalidation } = await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: distributionId,
        InvalidationBatch: {
          CallerReference: `${app.name}-${Date.now()}`,
          Paths: { Quantity: 1, Items: [`${app.basePath}/*`] },
        },
      }),
    );
    console.log(`${app.name}: invalidating ${app.basePath}/* (${Invalidation?.Id}) — waiting…`);
    await waitUntilInvalidationCompleted(
      { client: cloudfront, maxWaitTime: 600 },
      { DistributionId: distributionId, Id: Invalidation!.Id! },
    );
  }
  return { app: app.name, uploaded: changed.length, deleted: stale.length };
}

main(async () => {
  const targets = apps(positionals()).filter((a) => a.deploy === 'static');
  if (!targets.length) throw new Error('no static app selected');
  const [account, { distributionId }] = await Promise.all([
    accountId(),
    platformParams(['distributionId']),
  ]);
  const results = [];
  for (const app of targets) results.push(await deployApp(app, account, distributionId));
  summary(
    `### Static deploy\n${results.map((r) => `- ✅ \`${r.app}\`: ${r.uploaded} uploaded, ${r.deleted} deleted`).join('\n')}`,
  );
});

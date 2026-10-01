#!/usr/bin/env node
// CI drift check: every key in apps/<app>/.env.example must be accepted by the app's zod env schema,
// and every required key of the schema must exist in .env.example.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { discoverApps } from './apps.mjs';

/** Every NestJS service with a zod env schema (Next.js apps validate NEXT_PUBLIC_* at build time instead). */
const NEST_APPS = discoverApps()
  .filter((a) => a.envSchema)
  .map((a) => a.name);
let failed = false;

for (const app of NEST_APPS) {
  const dir = join('apps', app);
  const examplePath = join(dir, '.env.example');
  const schemaPath = join(dir, 'dist', 'app', 'env.schema.js');
  if (!existsSync(examplePath) || !existsSync(schemaPath)) {
    console.error(`[${app}] missing ${examplePath} or ${schemaPath} (build first)`);
    failed = true;
    continue;
  }
  const example = Object.fromEntries(
    readFileSync(examplePath, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.trim().startsWith('#'))
      .map((l) => l.split('=').map((s) => s.trim()))
      .map(([k, ...v]) => [k, v.join('=')]),
  );
  const mod = await import(pathToFileURL(schemaPath).href);
  const schema = mod.envSchema ?? mod.default?.envSchema;
  const result = schema.safeParse(example);
  if (!result.success) {
    console.error(`[${app}] .env.example does not satisfy env schema:`);
    for (const issue of result.error.issues)
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    failed = true;
  }
  // `.refine()` wraps the object schema in a ZodEffects; unwrap to reach `.shape`.
  const shape = (schema.shape ?? schema._def?.schema?.shape) || {};
  const unknown = Object.keys(example).filter((k) => !(k in shape));
  if (unknown.length) {
    console.error(`[${app}] keys in .env.example unknown to schema: ${unknown.join(', ')}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`env:check ok for ${NEST_APPS.join(', ')}`);

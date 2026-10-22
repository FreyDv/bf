import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';

import { viewerRequestCode } from './viewer-request.ts';

const code = viewerRequestCode({
  main: 'malinina.ca',
  redirects: { 'admin.malinina.ca': '/admin', 'api.malinina.ca': '/api', 'www.malinina.ca': '' },
  apiPrefix: '/api',
});

type Result = { uri?: string; statusCode?: number; headers: Record<string, { value: string }> };
function run(uri: string, host = 'malinina.ca', querystring: Record<string, unknown> = {}): Result {
  const context = vm.createContext({});
  vm.runInContext(`${code}\nthis.handler = handler;`, context);
  const handler = (context as { handler: (e: unknown) => Result }).handler;
  return handler({ request: { uri, querystring, headers: { host: { value: host } } } });
}

void test('strips the /api prefix', () => {
  assert.equal(run('/api/auth/trpc/users.me').uri, '/auth/trpc/users.me');
  assert.equal(run('/api').uri, '/');
  assert.equal(run('/api/').uri, '/');
  assert.equal(run('/apix/health').statusCode, 301); // not the prefix
});

void test('rewrites directories to index.html', () => {
  assert.equal(run('/').uri, '/index.html');
  assert.equal(run('/admin/').uri, '/admin/index.html');
  assert.equal(run('/about/').uri, '/about/index.html');
});

void test('adds the trailing slash to extension-less paths and keeps files', () => {
  const r = run('/admin', 'malinina.ca', { tab: { value: 'x' } });
  assert.equal(r.statusCode, 301);
  assert.equal(r.headers.location!.value, '/admin/?tab=x');
  assert.equal(run('/cakes.jpg').uri, '/cakes.jpg');
  assert.equal(run('/_next/static/chunks/main.js').uri, '/_next/static/chunks/main.js');
});

void test('redirects legacy hostnames to the paths on the main hostname', () => {
  assert.equal(run('/', 'admin.malinina.ca').headers.location!.value, 'https://malinina.ca/admin/');
  assert.equal(
    run('/auth/health/live', 'api.malinina.ca').headers.location!.value,
    'https://malinina.ca/api/auth/health/live',
  );
  assert.equal(run('/x/', 'www.malinina.ca').headers.location!.value, 'https://malinina.ca/x/');
  assert.equal(run('/x/', 'other.example').uri, '/x/index.html'); // unknown host: served as is
});

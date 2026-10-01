import { generateKeyPairSync } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

import { EdgeAuthMiddleware } from './edge-auth.middleware';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const config = {
  get: (k: string) => {
    if (k === 'PUBLIC_PATHS') return ['/auth/api/auth/'];
    if (k === 'ROUTE_ROLES') return { admin: 'admin' };
    return undefined;
  },
} as never;

type Req = { method: string; originalUrl: string; headers: Record<string, string> };
const req = (method: string, originalUrl: string, headers: Record<string, string> = {}): Req => ({
  method,
  originalUrl,
  headers,
});

describe('EdgeAuthMiddleware (RS256)', () => {
  const jwt = new JwtService({
    publicKey,
    privateKey,
    signOptions: { algorithm: 'RS256' },
    verifyOptions: { algorithms: ['RS256'] },
  });
  const mw = new EdgeAuthMiddleware(jwt, config);

  it('lets public paths and service health through without a token', async () => {
    for (const url of ['/auth/api/auth/dev-token', '/order/health/live', '/auth/health']) {
      const next = jest.fn();
      await mw.use(req('GET', url) as never, {} as never, next);
      expect(next).toHaveBeenCalled();
    }
  });

  it('rejects missing token', async () => {
    await expect(
      mw.use(req('GET', '/order/trpc/orders.list') as never, {} as never, jest.fn()),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('strips spoofed identity headers and forwards the verified identity', async () => {
    const token = jwt.sign({ sub: 'u1', email: 'u1@bf.dev', roles: ['user'] });
    const r = req('GET', '/order/api/orders', {
      authorization: `Bearer ${token}`,
      'x-user-id': 'attacker',
      'x-user-roles': 'admin',
    });
    const next = jest.fn();
    await mw.use(r as never, {} as never, next);
    expect(r.headers['x-user-id']).toBe('u1');
    expect(r.headers['x-user-roles']).toBe('user');
    expect(r.headers['x-user-email']).toBe('u1@bf.dev');
    expect(next).toHaveBeenCalled();
  });

  it('enforces ROUTE_ROLES per service prefix', async () => {
    const user = jwt.sign({ sub: 'u1', roles: ['user'] });
    await expect(
      mw.use(
        req('GET', '/admin/trpc/overview', { authorization: `Bearer ${user}` }) as never,
        {} as never,
        jest.fn(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    const admin = jwt.sign({ sub: 'a1', roles: ['admin'] });
    const next = jest.fn();
    await mw.use(
      req('GET', '/admin/trpc/overview', { authorization: `Bearer ${admin}` }) as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
  });

  it('removes spoofed identity headers on public paths too', async () => {
    const r = req('POST', '/auth/api/auth/refresh', { 'x-user-id': 'attacker' });
    await mw.use(r as never, {} as never, jest.fn());
    expect(r.headers['x-user-id']).toBeUndefined();
  });
});

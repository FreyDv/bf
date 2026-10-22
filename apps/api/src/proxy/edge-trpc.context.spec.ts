import { generateKeyPairSync } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

import { EdgeTrpcContext } from './edge-trpc.context';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const opts = (headers: Record<string, string>) => ({ req: { headers } }) as never;

describe('EdgeTrpcContext', () => {
  const jwt = new JwtService({
    publicKey,
    privateKey,
    signOptions: { algorithm: 'RS256' },
    verifyOptions: { algorithms: ['RS256'] },
  });
  const ctx = new EdgeTrpcContext(jwt);

  it('derives the user from the bearer token and ignores identity headers', async () => {
    const token = await jwt.signAsync({ sub: 'u1', roles: ['admin'], email: 'a@b.c' });
    const out = await ctx.create(
      opts({
        authorization: `Bearer ${token}`,
        'x-user-id': 'spoofed',
        'x-user-roles': 'admin',
        'x-correlation-id': 'c-1',
      }),
    );
    expect(out.user).toEqual({ id: 'u1', roles: ['admin'], email: 'a@b.c' });
    expect(out.correlationId).toBe('c-1');
  });

  it('rejects a missing or invalid token with UNAUTHORIZED', async () => {
    await expect(ctx.create(opts({ 'x-user-id': 'spoofed' }))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(ctx.create(opts({ authorization: 'Bearer nope' }))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});

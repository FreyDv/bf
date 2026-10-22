import { generateKeyPairSync } from 'node:crypto';

import { baseEnvSchema, createEnvValidator } from './env';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const b64 = (s: string) => Buffer.from(s).toString('base64');

describe('baseEnvSchema', () => {
  const validate = createEnvValidator(baseEnvSchema);
  it('applies defaults, parses csv and decodes base64 PEM keys', () => {
    const env = validate({
      JWT_PUBLIC_KEY: b64(publicKey),
      JWT_PRIVATE_KEY: b64(privateKey),
      CORS_ORIGINS: 'http://a.com, http://b.com',
    });
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://a.com', 'http://b.com']);
    expect(env.JWT_PUBLIC_KEY).toBe(publicKey);
    expect(env.JWT_PRIVATE_KEY).toBe(privateKey);
  });
  it('accepts raw PEM and leaves the private key undefined when absent', () => {
    const env = validate({ JWT_PUBLIC_KEY: publicKey });
    expect(env.JWT_PUBLIC_KEY).toBe(publicKey);
    expect(env.JWT_PRIVATE_KEY).toBeUndefined();
  });
  it('trusts one proxy hop by default and accepts an override', () => {
    expect(validate({ JWT_PUBLIC_KEY: publicKey }).TRUST_PROXY_HOPS).toBe(1);
    expect(validate({ JWT_PUBLIC_KEY: publicKey, TRUST_PROXY_HOPS: '2' }).TRUST_PROXY_HOPS).toBe(2);
    expect(() => validate({ JWT_PUBLIC_KEY: publicKey, TRUST_PROXY_HOPS: '-1' })).toThrow();
  });
  it('fails loudly on a non-PEM public key', () => {
    expect(() => validate({ JWT_PUBLIC_KEY: b64('not a key') })).toThrow(/JWT_PUBLIC_KEY/);
  });
});

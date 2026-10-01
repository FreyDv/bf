import { storageEnvSchema, storageOptionsFromEnv } from './env';

describe('storageOptionsFromEnv', () => {
  it('MinIO mode when S3_ENDPOINT is set', () => {
    const env = storageEnvSchema.parse({
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY_ID: 'bf',
      S3_SECRET_ACCESS_KEY: 'bfbfbfbf',
      S3_BUCKET: 'bf-api',
    });
    const o = storageOptionsFromEnv(env);
    expect(o.forcePathStyle).toBe(true);
    expect(o.credentials?.accessKeyId).toBe('bf');
    expect(o.region).toBe('us-east-1');
  });

  it('AWS mode uses default credential chain', () => {
    const o = storageOptionsFromEnv(
      storageEnvSchema.parse({ S3_BUCKET: 'bf-prod-api', S3_REGION: 'eu-central-1' }),
    );
    expect(o.endpoint).toBeUndefined();
    expect(o.credentials).toBeUndefined();
    expect(o.forcePathStyle).toBe(false);
  });

  it('rejects MinIO mode without static credentials', () => {
    expect(() =>
      storageOptionsFromEnv(
        storageEnvSchema.parse({ S3_ENDPOINT: 'http://x:9000', S3_BUCKET: 'bf-api' }),
      ),
    ).toThrow();
  });
});

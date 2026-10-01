import { z } from 'zod';

/**
 * S3_* env. Rule: if S3_ENDPOINT is set we are talking to MinIO (path-style, static creds);
 * if it is absent we are on AWS and credentials come from the default provider chain (task role).
 */
export const storageEnvSchema = z.object({
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().min(3),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  S3_PRESIGN_TTL: z.coerce.number().int().positive().default(900),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

export interface StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  credentials?: { accessKeyId: string; secretAccessKey: string };
  presignTtlSeconds?: number;
}

export function storageOptionsFromEnv(env: StorageEnv): StorageOptions {
  const minio = Boolean(env.S3_ENDPOINT);
  const hasStatic = Boolean(env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  if (minio && !hasStatic) {
    throw new Error(
      'S3_ENDPOINT is set (MinIO mode) but S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY are missing',
    );
  }
  return {
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE ?? minio,
    credentials: hasStatic
      ? { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! }
      : undefined,
    presignTtlSeconds: env.S3_PRESIGN_TTL,
  };
}

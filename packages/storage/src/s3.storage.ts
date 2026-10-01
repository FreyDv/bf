import { Readable } from 'node:stream';

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { StorageOptions } from './env';
import type {
  ListObjectsInput,
  ListObjectsResult,
  ObjectHead,
  ObjectStoragePort,
  PresignOptions,
  PutObjectInput,
  StoredObject,
} from './port';

/** S3-compatible adapter. Works unchanged against MinIO and AWS S3 (see storageOptionsFromEnv). */
export class S3ObjectStorage implements ObjectStoragePort {
  readonly client: S3Client;
  readonly defaultBucket: string;
  private readonly presignTtl: number;

  constructor(options: StorageOptions, client?: S3Client) {
    this.defaultBucket = options.bucket;
    this.presignTtl = options.presignTtlSeconds ?? 900;
    this.client =
      client ??
      new S3Client({
        region: options.region,
        endpoint: options.endpoint,
        forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
        credentials: options.credentials,
      });
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const Bucket = input.bucket ?? this.defaultBucket;
    if (input.body instanceof Readable) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          Metadata: input.metadata,
          CacheControl: input.cacheControl,
        },
      });
      const res = await upload.done();
      return { key: input.key, bucket: Bucket, etag: res.ETag };
    }
    const res = await this.client.send(
      new PutObjectCommand({
        Bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        Metadata: input.metadata,
        CacheControl: input.cacheControl,
      }),
    );
    return { key: input.key, bucket: Bucket, etag: res.ETag };
  }

  async getObject(key: string, bucket?: string): Promise<Readable> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Empty body for ${key}`);
    return res.Body as Readable;
  }

  async getObjectBuffer(key: string, bucket?: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
    );
    if (!res.Body) throw new Error(`Empty body for ${key}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async headObject(key: string, bucket?: string): Promise<ObjectHead | undefined> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
      );
      return {
        key,
        size: res.ContentLength ?? 0,
        contentType: res.ContentType,
        etag: res.ETag,
        lastModified: res.LastModified,
        metadata: res.Metadata ?? {},
      };
    } catch (e) {
      if (isNotFound(e)) return undefined;
      throw e;
    }
  }

  async exists(key: string, bucket?: string): Promise<boolean> {
    return (await this.headObject(key, bucket)) !== undefined;
  }

  async deleteObject(key: string, bucket?: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket ?? this.defaultBucket, Key: key }),
    );
  }

  async deleteObjects(keys: string[], bucket?: string): Promise<void> {
    for (let i = 0; i < keys.length; i += 1000) {
      const chunk = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: bucket ?? this.defaultBucket,
          Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  }

  async listObjects(input: ListObjectsInput = {}): Promise<ListObjectsResult> {
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: input.bucket ?? this.defaultBucket,
        Prefix: input.prefix,
        MaxKeys: input.maxKeys,
        ContinuationToken: input.continuationToken,
      }),
    );
    return {
      objects: (res.Contents ?? []).map((o) => ({
        key: o.Key ?? '',
        size: o.Size ?? 0,
        lastModified: o.LastModified,
        etag: o.ETag,
      })),
      nextContinuationToken: res.NextContinuationToken,
    };
  }

  async copyObject(
    sourceKey: string,
    targetKey: string,
    opts: { sourceBucket?: string; targetBucket?: string } = {},
  ): Promise<void> {
    const sourceBucket = opts.sourceBucket ?? this.defaultBucket;
    await this.client.send(
      new CopyObjectCommand({
        Bucket: opts.targetBucket ?? this.defaultBucket,
        Key: targetKey,
        CopySource: `/${sourceBucket}/${encodeURIComponent(sourceKey)}`,
      }),
    );
  }

  presignGet(key: string, opts: PresignOptions = {}): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: opts.bucket ?? this.defaultBucket, Key: key }),
      {
        expiresIn: opts.expiresIn ?? this.presignTtl,
      },
    );
  }

  presignPut(key: string, opts: PresignOptions = {}): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: opts.bucket ?? this.defaultBucket,
        Key: key,
        ContentType: opts.contentType,
      }),
      { expiresIn: opts.expiresIn ?? this.presignTtl },
    );
  }

  async destroy(): Promise<void> {
    this.client.destroy();
  }
}

function isNotFound(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404
  );
}

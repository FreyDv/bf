import { Readable } from 'node:stream';

import type {
  ListObjectsInput,
  ListObjectsResult,
  ObjectHead,
  ObjectStoragePort,
  PresignOptions,
  PutObjectInput,
  StoredObject,
} from './port';

/** Test double: keeps objects in a Map. Presigned URLs are fake `memory://` URIs. */
export class InMemoryObjectStorage implements ObjectStoragePort {
  readonly store = new Map<
    string,
    { body: Buffer; contentType?: string; metadata: Record<string, string>; at: Date }
  >();

  constructor(readonly defaultBucket = 'test') {}

  private k(bucket: string | undefined, key: string) {
    return `${bucket ?? this.defaultBucket}/${key}`;
  }

  async putObject(input: PutObjectInput): Promise<StoredObject> {
    const body =
      input.body instanceof Readable
        ? Buffer.concat(
            await input.body.toArray().then((c) => c.map((x) => Buffer.from(x as Uint8Array))),
          )
        : Buffer.from(input.body);
    this.store.set(this.k(input.bucket, input.key), {
      body,
      contentType: input.contentType,
      metadata: input.metadata ?? {},
      at: new Date(),
    });
    return { key: input.key, bucket: input.bucket ?? this.defaultBucket, size: body.length };
  }
  async getObject(key: string, bucket?: string): Promise<Readable> {
    return Readable.from(await this.getObjectBuffer(key, bucket));
  }
  async getObjectBuffer(key: string, bucket?: string): Promise<Buffer> {
    const o = this.store.get(this.k(bucket, key));
    if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    return o.body;
  }
  async headObject(key: string, bucket?: string): Promise<ObjectHead | undefined> {
    const o = this.store.get(this.k(bucket, key));
    return o
      ? {
          key,
          size: o.body.length,
          contentType: o.contentType,
          lastModified: o.at,
          metadata: o.metadata,
        }
      : undefined;
  }
  async exists(key: string, bucket?: string): Promise<boolean> {
    return this.store.has(this.k(bucket, key));
  }
  async deleteObject(key: string, bucket?: string): Promise<void> {
    this.store.delete(this.k(bucket, key));
  }
  async deleteObjects(keys: string[], bucket?: string): Promise<void> {
    for (const key of keys) this.store.delete(this.k(bucket, key));
  }
  async listObjects(input: ListObjectsInput = {}): Promise<ListObjectsResult> {
    const prefix = this.k(input.bucket, input.prefix ?? '');
    const objects = [...this.store.entries()]
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({
        key: k.slice(k.indexOf('/') + 1),
        size: v.body.length,
        lastModified: v.at,
      }));
    return { objects };
  }
  async copyObject(
    sourceKey: string,
    targetKey: string,
    opts: { sourceBucket?: string; targetBucket?: string } = {},
  ): Promise<void> {
    const o = this.store.get(this.k(opts.sourceBucket, sourceKey));
    if (!o) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
    this.store.set(this.k(opts.targetBucket, targetKey), { ...o });
  }
  async presignGet(key: string, opts: PresignOptions = {}): Promise<string> {
    return `memory://${opts.bucket ?? this.defaultBucket}/${key}?op=get`;
  }
  async presignPut(key: string, opts: PresignOptions = {}): Promise<string> {
    return `memory://${opts.bucket ?? this.defaultBucket}/${key}?op=put`;
  }
}

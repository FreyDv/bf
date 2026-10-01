/** `@bf/storage/port` — framework-free object storage contract (domain/application layers may import this). */
import type { Readable } from 'node:stream';

export const OBJECT_STORAGE = Symbol.for('bf.OBJECT_STORAGE');

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array | string | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
  /** Override the default bucket. */
  bucket?: string;
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  bucket: string;
  etag?: string;
  size?: number;
}

export interface ObjectHead {
  key: string;
  size: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata: Record<string, string>;
}

export interface ListObjectsInput {
  prefix?: string;
  bucket?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListObjectsResult {
  objects: Array<{ key: string; size: number; lastModified?: Date; etag?: string }>;
  nextContinuationToken?: string;
}

export interface PresignOptions {
  bucket?: string;
  /** Seconds. Default 900. */
  expiresIn?: number;
  contentType?: string;
}

export interface ObjectStoragePort {
  readonly defaultBucket: string;
  putObject(input: PutObjectInput): Promise<StoredObject>;
  getObject(key: string, bucket?: string): Promise<Readable>;
  getObjectBuffer(key: string, bucket?: string): Promise<Buffer>;
  headObject(key: string, bucket?: string): Promise<ObjectHead | undefined>;
  exists(key: string, bucket?: string): Promise<boolean>;
  deleteObject(key: string, bucket?: string): Promise<void>;
  deleteObjects(keys: string[], bucket?: string): Promise<void>;
  listObjects(input?: ListObjectsInput): Promise<ListObjectsResult>;
  copyObject(
    sourceKey: string,
    targetKey: string,
    opts?: { sourceBucket?: string; targetBucket?: string },
  ): Promise<void>;
  presignGet(key: string, opts?: PresignOptions): Promise<string>;
  presignPut(key: string, opts?: PresignOptions): Promise<string>;
}

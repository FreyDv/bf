/** Options for the shared HTTP filters; provided by @bf/server bootstrap (or manually in tests). */
export const SHARED_HTTP_OPTIONS = Symbol.for('bf.SHARED_HTTP_OPTIONS');

export interface SharedHttpOptions {
  /** Base URL used to build RFC 9457 `type` URIs, e.g. https://api.example.com */
  apiBaseUrl: string;
  isProduction: boolean;
  throttle?: { ttlMs: number; limit: number };
}

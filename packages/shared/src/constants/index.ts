/** Allowed NODE_ENV values; single source of truth for env schemas, logger config and Dockerfiles. */
export const NODE_ENVS = ['development', 'production', 'test'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];
export const DEFAULT_NODE_ENV: NodeEnv = 'development';

export const HEADERS = {
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
} as const;

export const CLS_KEYS = {
  CORRELATION_ID: 'correlationId',
  TRACE_ID: 'traceId',
  USER: 'user',
} as const;

export const METADATA_KEYS = {
  IS_PUBLIC: 'bf:isPublic',
  ROLES: 'bf:roles',
  USE_ENVELOPE: 'bf:useEnvelope',
} as const;

export const DEFAULT_TIMEOUT_MS = 30_000;
export const ROLES = { ADMIN: 'admin', USER: 'user', SERVICE: 'service' } as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

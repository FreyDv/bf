import type { ProblemDetails } from '../interfaces';
import type { ClsService } from 'nestjs-cls';

const TYPE_MAP: Record<number, string> = {
  400: 'bad-request',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  408: 'request-timeout',
  409: 'conflict',
  422: 'validation-failed',
  429: 'rate-limit-exceeded',
  500: 'internal-server-error',
  502: 'bad-gateway',
  503: 'service-unavailable',
  504: 'gateway-timeout',
};

const TITLE_MAP: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export const problemType = (baseUrl: string, status: number) =>
  `${baseUrl}/errors/${TYPE_MAP[status] ?? 'unknown-error'}`;

export const problemTitle = (status: number, fallback: string) => TITLE_MAP[status] ?? fallback;

export function baseProblem(
  cls: ClsService | undefined,
  baseUrl: string,
  status: number,
  instance: string,
  title?: string,
): ProblemDetails {
  return {
    type: problemType(baseUrl, status),
    title: title ?? problemTitle(status, 'Error'),
    status,
    instance,
    request_id: cls?.getId(),
    correlation_id: cls?.get<string>('correlationId'),
    trace_id: cls?.get<string>('traceId'),
    timestamp: new Date().toISOString(),
  };
}

export function tracePrefix(cls?: ClsService): string {
  const parts: string[] = [];
  const req = cls?.getId();
  const corr = cls?.get<string>('correlationId');
  const trace = cls?.get<string>('traceId');
  if (req) parts.push(`req:${req}`);
  if (corr) parts.push(`corr:${corr}`);
  if (trace) parts.push(`trace:${trace}`);
  return parts.length ? `[${parts.join('|')}] ` : '';
}

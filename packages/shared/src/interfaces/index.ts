export interface AuthenticatedUser {
  id: string;
  email?: string;
  roles: string[];
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
  traceId?: string;
  user?: AuthenticatedUser;
}

export interface FieldError {
  field?: string;
  pointer?: string;
  code: string;
  message: string;
  constraints?: Record<string, unknown>;
}

/** RFC 9457 Problem Details body. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  request_id?: string;
  correlation_id?: string;
  trace_id?: string;
  timestamp: string;
  errors?: FieldError[];
}

export interface Paginated<T> {
  object: 'list';
  data: T[];
  hasMore: boolean;
  total?: number;
}

export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  iat?: number;
  exp?: number;
}

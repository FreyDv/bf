/**
 * Base class for domain rule violations. Framework-free.
 * `code` is a stable machine-readable identifier; `@bf/shared/filters` maps
 * known subclasses to HTTP statuses (DomainExceptionFilter).
 */
export class DomainException extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundDomainException extends DomainException {
  constructor(entity: string, id: string) {
    super('RESOURCE_NOT_FOUND', `${entity} ${id} not found`, { entity, id });
  }
}

export class InvariantViolation extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('INVARIANT_VIOLATION', message, details);
  }
}

export class ConflictDomainException extends DomainException {
  constructor(message: string, details?: Record<string, unknown>) {
    super('RESOURCE_CONFLICT', message, details);
  }
}

/**
 * `@bf/contracts` — contract-first tRPC contracts for every Nest service.
 *
 * Prefer the per-service entrypoints (`@bf/contracts/auth`, `@bf/contracts/order`, …) so that a
 * consumer only pulls the schemas it needs. See README.md for the rules.
 */
export * as common from './common';
export * as auth from './auth';
export * as order from './order';
export * as course from './course';
export * as billing from './billing';
export * as admin from './admin';
export * as ai from './ai';

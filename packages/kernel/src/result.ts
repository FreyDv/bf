// The only place the repository imports neverthrow (ADR-048 item 3, ADR-015). The names are exactly what a module
// needs today; a name added later is not a breaking change.
export { err, ok } from 'neverthrow';
export type { Err, Ok, Result } from 'neverthrow';

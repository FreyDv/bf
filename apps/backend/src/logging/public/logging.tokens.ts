// What other modules inject by token (ADR-070): the Logger port and the read-only request context of @bf/kernel.
// Symbols, so no two providers collide and the file imports nothing (public/ may import only contract files, ADR-068).
export const LOGGER = Symbol('LOGGER');
export const REQUEST_CONTEXT = Symbol('REQUEST_CONTEXT');

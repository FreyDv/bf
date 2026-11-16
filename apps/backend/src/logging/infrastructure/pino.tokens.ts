// Internal to the logging module: where records go (a token, so a test reads them instead of stdout) and the one pino
// instance. Other modules inject LOGGER and REQUEST_CONTEXT from public/.
export const LOG_DESTINATION = Symbol('LOG_DESTINATION');
export const PINO = Symbol('PINO');

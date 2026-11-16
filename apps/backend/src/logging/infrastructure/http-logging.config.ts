import type { Logger as PinoLogger } from 'pino';
import type { Options } from 'pino-http';

// A request is logged by what is safe to keep: no headers (cookie, authorization), no remote address, no query string,
// where a tRPC call carries its input (ADR-043 item 4.1, ERR-6). Each serializer is an allowlist.
export function pathOf(url: string | undefined): string {
  return (url ?? '').split(/[?#]/, 1)[0] ?? '';
}

type Req = { method?: string; url?: string };
type Res = { statusCode?: number };

export function httpLoggingOptions(logger: PinoLogger): Options {
  return {
    logger,
    serializers: {
      req: (req: Req) => ({ method: req.method, path: pathOf(req.url) }),
      res: (res: Res) => ({ statusCode: res.statusCode }),
    },
  };
}

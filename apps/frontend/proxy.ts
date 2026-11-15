import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// A per-request nonce: headers() in next.config.ts cannot carry one, so the policy is built here (ADR-066,
// which replaces ADR-055 items 1-2). Next.js reads the nonce from the Content-Security-Policy request header
// and puts it on its own inline and framework scripts; this needs dynamic rendering, forced in app/layout.tsx.
// Next's experimental SRI was tried first and does not work: its inline bootstrap scripts get no integrity
// attribute (ADR-066), so 'unsafe-inline' could not be dropped with it.
const isProduction = process.env.NODE_ENV === 'production';

function buildPolicy(nonce: string): string {
  const directives: ReadonlyArray<readonly [name: string, values: readonly string[]]> = [
    // Anything not listed below falls back to the own origin, so a new resource type is blocked by default.
    ['default-src', ["'self'"]],
    // The nonce allows Next's own scripts; 'strict-dynamic' lets them load their chunks and makes browsers that
    // support it ignore 'self' and any host list. An injected inline script has no nonce and is blocked.
    // 'unsafe-eval' is development only: React refresh evaluates code, a production build never does.
    [
      'script-src',
      [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(isProduction ? [] : ["'unsafe-eval'"]),
      ],
    ],
    // Next.js and UI libraries inject inline styles; style-src stays on 'unsafe-inline' (ADR-066, revisit trigger there).
    ['style-src', ["'self'", "'unsafe-inline'"]],
    // Images come from the app itself. blob: and data: are added when a feature needs them (ADR-042 item 2).
    ['img-src', ["'self'"]],
    // Fonts are served from the own origin (self-hosted), never from a font CDN.
    ['font-src', ["'self'"]],
    // One origin serves the pages and /api (ADR-038 item 2), so fetch and WebSocket (dev HMR) stay on it.
    // The Spaces address joins here, and media-src, when a feature uploads or plays media from the browser (ADR-042 item 2).
    ['connect-src', ["'self'"]],
    // No <object>, <embed> or <applet>: plugins have no use here and are a classic injection vector.
    ['object-src', ["'none'"]],
    // An injected <base href> would redirect every relative URL on the page to an attacker.
    ['base-uri', ["'self'"]],
    // A form can only post back to this origin, so an injected form cannot send input elsewhere.
    ['form-action', ["'self'"]],
    // Nobody embeds the pages; backs up the ingress X-Frame-Options: DENY (ADR-038 item 5) in the app itself.
    ['frame-ancestors', ["'none'"]],
  ];

  return [
    ...directives.map(([name, values]) => `${name} ${values.join(' ')}`),
    // Rewrites http subresources to https. Production only: next dev and a local http run have no TLS,
    // and the policy would break them.
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = buildPolicy(nonce);

  // The request header is what Next.js parses the nonce from while rendering; the response header is what the browser enforces.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Static assets and the favicon carry no document to protect; prefetches render no page here.
      // A path that matches nothing (a 404) still goes through the proxy, so its error page gets the header.
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

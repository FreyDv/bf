import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// The one home of the Content-Security-Policy (ADR-059). A nonce exists only per request, so the policy
// is built here and not in next.config.ts headers(); Next reads the nonce from the request header below
// and stamps it on every script it renders, which is why every page must render dynamically.
const isProduction = process.env.NODE_ENV === 'production';

const buildDirectives = (
  nonce: string,
): ReadonlyArray<readonly [name: string, values: readonly string[]]> => [
  // Anything not listed below falls back to the own origin, so a new resource type is blocked by default.
  ['default-src', ["'self'"]],
  // The nonce lets Next's own inline bootstrap run and 'strict-dynamic' lets those scripts load their chunks,
  // so an injected inline script has no nonce and is blocked. A browser that understands 'strict-dynamic'
  // ignores 'self' here; 'self' stays as the fallback for one that does not, so its own chunks still load.
  // 'unsafe-eval' is development only: React refresh evaluates code, a production build never does.
  [
    'script-src',
    ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isProduction ? [] : ["'unsafe-eval'"])],
  ],
  // Next.js and UI libraries inject inline styles that carry no nonce. A known residual risk (ADR-059):
  // revisit with the first UI library or the first page that shows user content.
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

function buildPolicy(nonce: string): string {
  return [
    ...buildDirectives(nonce).map(([name, values]) => `${name} ${values.join(' ')}`),
    // Rewrites http subresources to https. Production only: next dev and a local http run have no TLS,
    // and the policy would break them.
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = buildPolicy(nonce);

  // Next extracts the nonce from the request's own Content-Security-Policy while rendering.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: [
    {
      // Every page route, the 404 included: the header must not depend on what matched. Static assets carry
      // no document, so a policy on them would only cost a proxy run per file.
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      // A prefetch response is not a document either, and a nonce minted for it would be wasted.
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};

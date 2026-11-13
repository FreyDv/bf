import type { NextConfig } from 'next';

// A static policy: headers() cannot see a per-request nonce (that needs proxy.ts and dynamic
// rendering of every page), so script-src and style-src carry 'unsafe-inline' and pages stay static.
// This stops loading from foreign origins, plugins, <base> hijacking, form exfiltration and framing,
// but it does NOT stop an injected inline script. ADR-055 records the gap; backlog row CSP-2 closes it.
const isProduction = process.env.NODE_ENV === 'production';

const directives: ReadonlyArray<readonly [name: string, values: readonly string[]]> = [
  // Anything not listed below falls back to the own origin, so a new resource type is blocked by default.
  ['default-src', ["'self'"]],
  // Next.js emits inline bootstrap scripts that carry no nonce here (see the note above). 'unsafe-eval'
  // is development only: React refresh evaluates code, a production build never does.
  ['script-src', ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])]],
  // Next.js and UI libraries inject inline styles; without a nonce only 'unsafe-inline' allows them.
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

// Rewrites http subresources to https. Production only: next dev and a local http run have no TLS,
// and the policy would break them.
const policy = [
  ...directives.map(([name, values]) => `${name} ${values.join(' ')}`),
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

const config: NextConfig = {
  output: 'standalone',
  headers: () =>
    Promise.resolve([
      {
        // Every route, including the ones without a page: the header must not depend on what matched.
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: policy }],
      },
    ]),
};

export default config;

// The probe of the platform (ADR-080): liveness of the Next.js server, outside /api because /api on the host belongs to
// the backend (ADR-038). Plain text, no data. Dynamic, so that every probe runs the handler instead of reading a
// response prerendered at build time.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}

import type { ReactNode } from 'react';
import { connection } from 'next/server';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The Content-Security-Policy nonce exists only per request (proxy.ts, ADR-059), and Next stamps it while
  // rendering. A page prerendered at build time has no request, so its inline scripts would carry no nonce and
  // the policy would block them. Waiting for a request here makes every page, the 404 included, render per request.
  await connection();
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

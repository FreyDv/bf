import type { ReactNode } from 'react';
import { connection } from 'next/server';

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page renders per request: a nonce exists only for a request, and a prerendered page has none
  // (ADR-066). Placed here so that no page can opt back into static rendering by forgetting it.
  await connection();
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

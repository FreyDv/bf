import { env } from '@/config/env';

export const TOKEN_KEY = 'bf-admin:dev-token';

/**
 * The bearer token every call to the edge carries. It comes from `auth`'s dev-token endpoint (roles `admin,user`,
 * disabled in production) and lives in localStorage; `resetToken()` drops it so the next call fetches a fresh one.
 * Paste a real admin access token under the same key to use the UI against production.
 */
export class TokenError extends Error {
  constructor(readonly status: number) {
    super(
      `Could not get a dev token (${status}). In production put an admin access token in localStorage["${TOKEN_KEY}"].`,
    );
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private mode / blocked storage: the token lives for this call only
  }
}

let pending: Promise<string> | undefined;

async function fetchDevToken(): Promise<string> {
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/api/auth/dev-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: env.NEXT_PUBLIC_DEV_TOKEN_SUB, roles: ['admin', 'user'] }),
  });
  if (!response.ok) throw new TokenError(response.status);
  const { accessToken } = (await response.json()) as { accessToken: string };
  writeToken(accessToken);
  return accessToken;
}

export async function getToken(): Promise<string> {
  const stored = readToken();
  if (stored) return stored;
  pending ??= fetchDevToken().finally(() => (pending = undefined));
  return pending;
}

export function resetToken(): void {
  writeToken(null);
}

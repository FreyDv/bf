import { describe, expect, it } from 'vitest';
import { GET } from './route.js';

describe('GET /healthz', () => {
  it('answers 200 with the plain text ok and nothing else', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(await response.text()).toBe('ok');
  });
});

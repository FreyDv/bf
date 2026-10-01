// Creates or updates ONE sticky bot comment on a PR (identified by a hidden marker), so pushes don't spam the thread.
// Usage: node scripts/pr-comment.ts <marker> <body.md> <pr-number>
// Env:   GH_TOKEN, GITHUB_REPOSITORY (needs `pull-requests: write`)
import { existsSync, readFileSync } from 'node:fs';

import { main } from './ci/_gh.ts';

interface Comment {
  id: number;
  body?: string;
  user?: { login: string };
}

main(async () => {
  const [marker, file, pr] = process.argv.slice(2);
  const token = process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!marker || !file || !pr)
    throw new Error('usage: pr-comment.ts <marker> <body.md> <pr-number>');
  if (!token || !repository) throw new Error('GH_TOKEN and GITHUB_REPOSITORY must be set');

  const api = async <T>(path: string, method = 'GET', body?: object): Promise<T> => {
    const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok)
      throw new Error(`GitHub ${method} ${path}: ${response.status} ${await response.text()}`);
    return (await response.json()) as T;
  };

  const tag = `<!-- ${marker} -->`;
  // a missing/empty body file means the step that should have produced it failed
  const content = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  const body = `${tag}\n${content || '❌ Preview failed — see the workflow run.'}`;

  let existing: Comment | undefined;
  for (let page = 1; !existing; page++) {
    const comments = await api<Comment[]>(`/issues/${pr}/comments?per_page=100&page=${page}`);
    existing = comments.find(
      (c) => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(tag),
    );
    if (comments.length < 100) break;
  }

  if (existing) await api(`/issues/comments/${existing.id}`, 'PATCH', { body });
  else await api(`/issues/${pr}/comments`, 'POST', { body });
  console.log(`${existing ? 'updated' : 'created'} comment "${marker}" on PR #${pr}`);
});

// PR test report: turns the Jest JSON files uploaded by the `unit` and `e2e` jobs into one Markdown comment.
// Usage: node scripts/ci/test-report.ts <reports-dir> <out.md>
// The directory holds one sub-directory per uploaded artifact, named `report-<unit|e2e>-<app>`, each with a jest.json
// (`jest --json --outputFile=…`). A missing directory simply means no job produced a report.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { main, summary } from './_gh.ts';

interface JestAssertion {
  fullName: string;
  status: string;
  failureMessages: string[];
}
interface JestSuite {
  name: string;
  status: string;
  message: string;
  startTime: number;
  endTime: number;
  assertionResults: JestAssertion[];
}
interface JestReport {
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  numTotalTests: number;
  testResults: JestSuite[];
}
interface Row {
  kind: string;
  app: string;
  report: JestReport;
}

const MAX_FAILURES = 15;
const MAX_MESSAGE = 1500;
// eslint-disable-next-line no-control-regex -- strips the colors Jest puts in failure messages
const ANSI = /\u001b\[[0-9;]*m/g;

const clean = (text: string) => {
  const plain = text.replace(ANSI, '').trim();
  return plain.length > MAX_MESSAGE ? `${plain.slice(0, MAX_MESSAGE)}\n…` : plain;
};
// a suite that failed without a single failed test (compile error, broken setup) counts once; failing tests count each
const failedCount = (report: JestReport) =>
  report.numFailedTests +
  report.testResults.filter(
    (s) => s.status === 'failed' && !s.assertionResults.some((a) => a.status === 'failed'),
  ).length;
const seconds = (report: JestReport) =>
  (report.testResults.reduce((sum, s) => sum + (s.endTime - s.startTime), 0) / 1000).toFixed(1);

function load(dir: string): Row[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((entry) => /^report-(unit|e2e)-(.+)$/.exec(entry))
    .filter((m): m is RegExpExecArray => m !== null)
    .map(([entry, kind = '', app = '']) => ({
      kind,
      app,
      file: join(dir, entry, 'jest.json'),
    }))
    .filter(({ file }) => existsSync(file))
    .map(({ kind, app, file }) => ({
      kind,
      app,
      report: JSON.parse(readFileSync(file, 'utf8')) as JestReport,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.app.localeCompare(b.app));
}

function failures(row: Row): string[] {
  const out: string[] = [];
  for (const suite of row.report.testResults) {
    const failed = suite.assertionResults.filter((a) => a.status === 'failed');
    for (const test of failed) {
      out.push(
        `**${row.app} · ${row.kind}** — ${test.fullName}\n\n${fence(test.failureMessages.join('\n'))}`,
      );
    }
    // the suite itself did not run (compile error, failing setup): Jest reports no individual test
    if (suite.status === 'failed' && !failed.length) {
      out.push(
        `**${row.app} · ${row.kind}** — \`${suite.name.split('/').slice(-3).join('/')}\` could not run\n\n${fence(suite.message)}`,
      );
    }
  }
  return out;
}

const fence = (text: string) => `\`\`\`\n${clean(text)}\n\`\`\``;

main(() => {
  const [dir, out] = process.argv.slice(2);
  if (!dir || !out) throw new Error('usage: test-report.ts <reports-dir> <out.md>');
  const rows = load(dir);

  const lines: string[] = [];
  if (!rows.length) {
    lines.push('### Test report', '', 'No unit or e2e tests ran for the apps affected by this PR.');
  } else {
    const total = (pick: (r: JestReport) => number) => rows.reduce((s, r) => s + pick(r.report), 0);
    const passed = total((r) => r.numPassedTests);
    const failed = total(failedCount);
    const skipped = total((r) => r.numPendingTests);
    lines.push(
      `### Test report · ${failed ? '❌' : '✅'} ${passed} passed · ${failed} failed · ${skipped} skipped`,
      '',
      '| App | Stage | Tests | Passed | Failed | Skipped | Time |',
      '|---|---|--:|--:|--:|--:|--:|',
      ...rows.map(({ app, kind, report: r }) => {
        const bad = failedCount(r);
        return `| \`${app}\` | ${kind} | ${r.numTotalTests} | ${r.numPassedTests} | ${bad ? `❌ ${bad}` : 0} | ${r.numPendingTests} | ${seconds(r)}s |`;
      }),
    );
    const bad = rows.flatMap(failures);
    if (bad.length) {
      lines.push(
        '',
        `<details open><summary><b>Failures</b> (${bad.length})</summary>`,
        '',
        ...bad.slice(0, MAX_FAILURES).flatMap((f) => [f, '']),
        bad.length > MAX_FAILURES
          ? `…and ${bad.length - MAX_FAILURES} more, see the workflow log.`
          : '',
        '</details>',
      );
    }
  }

  const markdown = lines.join('\n');
  writeFileSync(out, `${markdown}\n`);
  summary(markdown);
});

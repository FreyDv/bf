// Proves each rule of .dependency-cruiser.mjs fires on a violating import and stays quiet on a
// legal one (ENF-1). Fixtures are built in a temp tree so the real config is used unmodified.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '..');
const S = 'apps/backend/src';

const files: Record<string, string> = {
  // legal imports - none of these may be reported
  [`${S}/orders/domain/money.value-object.ts`]: 'export const money = 1;',
  [`${S}/orders/domain/order.aggregate.ts`]:
    "import { money } from './money.value-object.js';\nexport const order = money;",
  [`${S}/orders/application/ports/order.port.ts`]:
    "import { order } from '../../domain/order.aggregate.js';\nexport const port = order;",
  [`${S}/orders/commands/place/place.command.ts`]: 'export const command = 1;',
  [`${S}/orders/commands/place/place.router.ts`]:
    "import { command } from './place.command.js';\nexport const router = command;",
  [`${S}/orders/infrastructure/order.repository.ts`]:
    "import { port } from '../application/ports/order.port.js';\nexport const repo = port;",
  [`${S}/billing/public/invoice.facade.ts`]: 'export const facade = 1;',
  [`${S}/billing/domain/invoice.aggregate.ts`]: 'export const invoice = 1;',
  [`${S}/orders/application/uses-facade.service.ts`]:
    "import { facade } from '../../billing/public/invoice.facade.js';\nexport const x = facade;",
  [`${S}/app.module.ts`]:
    "import { repo } from './orders/infrastructure/order.repository.js';\nexport const app = repo;",

  [`${S}/orders/commands/place/place.request.dto.ts`]: 'export const dto = 1;',
  'packages/contracts/src/generated/server.ts': `import { dto } from '../../../../apps/backend/src/orders/commands/place/place.request.dto.js';\nexport const a = dto;`,

  // violations
  'packages/contracts/src/bad-domain.ts': `import { order } from '../../../apps/backend/src/orders/domain/order.aggregate.js';\nexport const a = order;`,
  [`${S}/orders/domain/bad-application.ts`]:
    "import { port } from '../application/ports/order.port.js';\nexport const a = port;",
  [`${S}/orders/domain/bad-infrastructure.ts`]:
    "import { repo } from '../infrastructure/order.repository.js';\nexport const a = repo;",
  [`${S}/orders/domain/bad-library.ts`]: "import { z } from 'zod';\nexport const a = z;",
  [`${S}/orders/domain/bad-io.ts`]:
    "import { readFileSync } from 'node:fs';\nexport const a = readFileSync;",
  [`${S}/orders/application/bad-infrastructure.service.ts`]:
    "import { repo } from '../infrastructure/order.repository.js';\nexport const a = repo;",
  [`${S}/orders/application/event-handlers/some.domain-event-handler.ts`]: 'export const h = 1;',
  [`${S}/orders/infrastructure/bad-application.adapter.ts`]:
    "import { h } from '../application/event-handlers/some.domain-event-handler.js';\nexport const a = h;",
  [`${S}/orders/commands/place/bad-domain.router.ts`]:
    "import { order } from '../../domain/order.aggregate.js';\nexport const a = order;",
  [`${S}/orders/application/bad-cross-module.service.ts`]:
    "import { invoice } from '../../billing/domain/invoice.aggregate.js';\nexport const a = invoice;",
  [`${S}/orders/commands/cancel/cancel.command.ts`]: 'export const cancel = 1;',
  [`${S}/orders/commands/place/bad-slice.command-handler.ts`]:
    "import { cancel } from '../cancel/cancel.command.js';\nexport const a = cancel;",
  [`${S}/orders/domain/cycle-a.ts`]: "import { b } from './cycle-b.js';\nexport const a = b;",
  [`${S}/orders/domain/cycle-b.ts`]: "import { a } from './cycle-a.js';\nexport const b = a;",
  [`${S}/orders/domain/bad-unresolved.ts`]:
    "import { nope } from './missing.js';\nexport const a = nope;",
  'apps/frontend/app/bad-app-import.ts': `import { app } from '../../backend/src/app.module.js';\nexport const a = app;`,
};

const expected: Array<[rule: string, from: string]> = [
  ['dep-2-domain-is-innermost', `${S}/orders/domain/bad-application.ts`],
  ['dep-2-domain-is-innermost', `${S}/orders/domain/bad-infrastructure.ts`],
  ['dep-3-domain-no-libraries', `${S}/orders/domain/bad-library.ts`],
  ['dep-3-domain-no-io', `${S}/orders/domain/bad-io.ts`],
  ['dep-2-application-no-outer-layers', `${S}/orders/application/bad-infrastructure.service.ts`],
  ['dep-2-infrastructure-only-ports', `${S}/orders/infrastructure/bad-application.adapter.ts`],
  ['dep-2-adapters-no-domain-no-infrastructure', `${S}/orders/commands/place/bad-domain.router.ts`],
  ['dep-5-modules-only-through-public', `${S}/orders/application/bad-cross-module.service.ts`],
  ['dep-8-no-slice-to-slice', `${S}/orders/commands/place/bad-slice.command-handler.ts`],
  ['dep-9-no-circular', `${S}/orders/domain/cycle-a.ts`],
  ['not-to-unresolvable', `${S}/orders/domain/bad-unresolved.ts`],
  ['apps-do-not-import-each-other', 'apps/frontend/app/bad-app-import.ts'],
  ['contracts-only-dtos-from-backend', 'packages/contracts/src/bad-domain.ts'],
];

interface Violation {
  rule: { name: string };
  from: string;
}

describe('dependency-cruiser boundaries', () => {
  let tmp = '';
  let violations: Violation[] = [];

  before(() => {
    tmp = mkdtempSync(join(tmpdir(), 'bf-boundaries-'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(tmp, path)), { recursive: true });
      writeFileSync(join(tmp, path), content);
    }
    writeFileSync(
      join(tmp, 'apps/backend/tsconfig.json'),
      readFileSync(join(root, 'apps/backend/tsconfig.json')),
    );
    writeFileSync(
      join(tmp, 'apps/backend/package.json'),
      readFileSync(join(root, 'apps/backend/package.json')),
    );
    symlinkSync(join(root, 'node_modules'), join(tmp, 'node_modules'));
    symlinkSync(join(root, 'apps/backend/node_modules'), join(tmp, 'apps/backend/node_modules'));

    let stdout = '';
    try {
      stdout = execFileSync(
        join(root, 'node_modules/.bin/depcruise'),
        [
          'apps',
          'packages',
          '--config',
          join(root, '.dependency-cruiser.mjs'),
          '--output-type',
          'json',
        ],
        { cwd: tmp, encoding: 'utf8', maxBuffer: 1 << 26 },
      );
    } catch (error) {
      stdout = (error as { stdout: string }).stdout;
    }
    violations = (JSON.parse(stdout) as { summary: { violations: Violation[] } }).summary
      .violations;
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  for (const [rule, from] of expected) {
    it(`${rule} fires on ${from}`, () => {
      assert.ok(
        violations.some((v) => v.rule.name === rule && v.from === from),
        `expected ${rule} on ${from}; got ${JSON.stringify(violations.map((v) => [v.rule.name, v.from]))}`,
      );
    });
  }

  it('reports nothing on the legal imports', () => {
    const legal = new Set(Object.keys(files).filter((p) => !expected.some(([, f]) => f === p)));
    const falsePositives = violations.filter(
      (v) => legal.has(v.from) && !/cycle-|bad-/.test(v.from),
    );
    assert.deepEqual(falsePositives, []);
  });
});

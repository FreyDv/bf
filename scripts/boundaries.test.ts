// Proves each rule of .dependency-cruiser.mjs fires on a violating import and stays quiet on a
// legal one (ENF-1). Fixtures are built in a temp tree so the real config is used unmodified.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
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

  // Test files (ADR-039 item 4): vitest and the layers of their own module are allowed
  [`${S}/orders/dtos/order.response.dto.ts`]: 'export const response = 1;',
  [`${S}/orders/domain/order.aggregate.test.ts`]: `import { it } from 'vitest';\nimport { order } from './order.aggregate.js';\nimport { port } from '../application/ports/order.port.js';\nexport const t = [it, order, port];`,
  [`${S}/orders/domain/order.e2e.test.ts`]:
    "import { repo } from '../infrastructure/order.repository.js';\nexport const t = repo;",
  [`${S}/orders/application/place.service.test.ts`]:
    "import { repo } from '../infrastructure/order.repository.js';\nexport const t = repo;",
  [`${S}/orders/infrastructure/order.repository.test.ts`]:
    "import { h } from '../application/event-handlers/some.domain-event-handler.js';\nexport const t = h;",
  [`${S}/orders/dtos/order.response.dto.test.ts`]:
    "import { order } from '../domain/order.aggregate.js';\nexport const t = order;",
  [`${S}/orders/commands/place/place.e2e.test.ts`]:
    "import { repo } from '../../infrastructure/order.repository.js';\nexport const t = repo;",

  // The openai SDK (ADR-041): an adapter in infrastructure/ may import it, nothing else may
  [`${S}/orders/infrastructure/legal-openai.adapter.ts`]:
    "import { ok } from 'openai';\nexport const a = ok;",

  // Shared kernel (ENF-4, ADR-048). The package does not exist in the repository yet; the tree
  // simulates its path, name and source entry so the rules are proven before the first consumer.
  'packages/kernel/package.json': JSON.stringify({
    name: '@bf/kernel',
    type: 'module',
    exports: { '.': './src/index.ts' },
  }),
  'packages/kernel/src/index.ts': 'export const ok = 1;',
  [`${S}/orders/domain/uses-kernel.ts`]: "import { ok } from '@bf/kernel';\nexport const a = ok;",
  [`${S}/orders/domain/bad-neverthrow.ts`]:
    "import { ok } from 'neverthrow';\nexport const a = ok;",
  [`${S}/orders/domain/bad-library.test.ts`]: "import { z } from 'zod';\nexport const a = z;",
  [`${S}/orders/domain/bad-io.test.ts`]:
    "import { readFileSync } from 'node:fs';\nexport const a = readFileSync;",
  [`${S}/orders/domain/bad-cross-module.test.ts`]:
    "import { invoice } from '../../billing/domain/invoice.aggregate.js';\nexport const a = invoice;",
  [`${S}/orders/domain/bad-imports-test.ts`]:
    "import { t } from './order.aggregate.test.js';\nexport const a = t;",
  [`${S}/orders/commands/place/bad-slice.e2e.test.ts`]:
    "import { cancel } from '../cancel/cancel.command.js';\nexport const a = cancel;",
  [`${S}/orders/domain/cycle-c.test.ts`]:
    "import { d } from './cycle-d.test.js';\nexport const c = d;",
  [`${S}/orders/domain/cycle-d.test.ts`]:
    "import { c } from './cycle-c.test.js';\nexport const d = c;",
  [`${S}/orders/application/bad-openai.service.ts`]:
    "import { ok } from 'openai';\nexport const a = ok;",
  [`${S}/bad-openai-root.ts`]: "import { ok } from 'openai';\nexport const a = ok;",
  'packages/kernel/src/bad-backend.ts': `import { order } from '../../../apps/backend/src/orders/domain/order.aggregate.js';\nexport const a = order;`,
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
  ['dep-3-domain-no-libraries', `${S}/orders/domain/bad-neverthrow.ts`],
  ['dep-3-domain-tests-only-vitest', `${S}/orders/domain/bad-library.test.ts`],
  ['dep-3-domain-no-io', `${S}/orders/domain/bad-io.test.ts`],
  ['dep-5-modules-only-through-public', `${S}/orders/domain/bad-cross-module.test.ts`],
  ['tests-are-leaves', `${S}/orders/domain/bad-imports-test.ts`],
  ['dep-8-no-slice-to-slice', `${S}/orders/commands/place/bad-slice.e2e.test.ts`],
  ['dep-9-no-circular', `${S}/orders/domain/cycle-c.test.ts`],
  ['dep-4-openai-only-in-infrastructure', `${S}/orders/application/bad-openai.service.ts`],
  ['dep-4-openai-only-in-infrastructure', `${S}/bad-openai-root.ts`],
  ['kernel-is-domain-free', 'packages/kernel/src/bad-backend.ts'],
  ['apps-do-not-import-each-other', 'apps/frontend/app/bad-app-import.ts'],
  ['contracts-only-dtos-from-backend', 'packages/contracts/src/bad-domain.ts'],
];

interface Module {
  source: string;
  dependencies: Array<{ resolved: string }>;
}

interface Violation {
  rule: { name: string };
  from: string;
}

/**
 * Mirrors a real node_modules entry by entry, so a fixture can add a package the repository does
 * not have (the kernel, a library that is not installed) without touching the real tree. `extra`
 * maps a package name to the directory it links to.
 */
function linkNodeModules(real: string, into: string, extra: Record<string, string>): void {
  mkdirSync(into, { recursive: true });
  const scopes = new Set(
    Object.keys(extra)
      .filter((n) => n.startsWith('@'))
      .map((n) => n.split('/')[0]),
  );
  for (const entry of readdirSync(real)) {
    if (scopes.has(entry)) {
      mkdirSync(join(into, entry), { recursive: true });
      for (const inner of readdirSync(join(real, entry))) {
        symlinkSync(join(real, entry, inner), join(into, entry, inner));
      }
    } else {
      symlinkSync(join(real, entry), join(into, entry));
    }
  }
  for (const [name, target] of Object.entries(extra)) {
    mkdirSync(dirname(join(into, name)), { recursive: true });
    symlinkSync(target, join(into, name));
  }
}

/** A package directory with an entry file, standing in for a library the repository has not installed. */
function stubPackage(dir: string, name: string): string {
  const path = join(dir, name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name, main: 'index.js' }));
  writeFileSync(join(path, 'index.js'), 'exports.ok = 1;');
  return path;
}

describe('dependency-cruiser boundaries', () => {
  let tmp = '';
  let violations: Violation[] = [];
  let modules: Module[] = [];

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
    linkNodeModules(join(root, 'node_modules'), join(tmp, 'node_modules'), {
      '@bf/kernel': join(tmp, 'packages/kernel'),
      neverthrow: stubPackage(join(tmp, '.stubs/node_modules'), 'neverthrow'),
      openai: stubPackage(join(tmp, '.stubs/node_modules'), 'openai'),
    });
    linkNodeModules(
      join(root, 'apps/backend/node_modules'),
      join(tmp, 'apps/backend/node_modules'),
      {},
    );

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
    const report = JSON.parse(stdout) as {
      modules: Module[];
      summary: { violations: Violation[] };
    };
    violations = report.summary.violations;
    modules = report.modules;
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

  // Without this the legal kernel fixture could pass because the checker never saw the import.
  it('sees the domain import of the shared kernel and finds it legal', () => {
    const domainFile = modules.find((m) => m.source === `${S}/orders/domain/uses-kernel.ts`);
    assert.ok(domainFile?.dependencies.some((d) => d.resolved === 'packages/kernel/src/index.ts'));
  });

  it('reports nothing on the legal imports', () => {
    const legal = new Set(Object.keys(files).filter((p) => !expected.some(([, f]) => f === p)));
    const falsePositives = violations.filter(
      (v) => legal.has(v.from) && !/cycle-|bad-/.test(v.from),
    );
    assert.deepEqual(falsePositives, []);
  });
});

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
  // The domain whitelist for packages/ (ADR-049): the kernel is importable, any other package is not
  'packages/contracts/package.json': JSON.stringify({
    name: '@bf/contracts',
    type: 'module',
    exports: { '.': './src/index.ts' },
  }),
  'packages/contracts/src/index.ts': 'export const contracts = 1;',
  [`${S}/orders/domain/bad-contracts.ts`]:
    "import { contracts } from '@bf/contracts';\nexport const a = contracts;",
  [`${S}/orders/domain/bad-contracts.test.ts`]:
    "import { contracts } from '@bf/contracts';\nexport const a = contracts;",
  [`${S}/orders/domain/bad-contracts-relative.ts`]:
    "import { contracts } from '../../../../../packages/contracts/src/index.js';\nexport const a = contracts;",
  'apps/frontend/src/feature/domain/bad-contracts.ts':
    "import { contracts } from '@bf/contracts';\nexport const a = contracts;",

  // The filter toolkit (QRY-6, QRY-7, ADR-050): one package, entries core and zod, built to dist/ like a
  // real install. The tree simulates it, so the rules are proven before a module imports it.
  'packages/query-filter/package.json': JSON.stringify({
    name: '@bf/query-filter',
    type: 'module',
    exports: {
      './core': './dist/core/index.js',
      './zod': './dist/zod/index.js',
      './drizzle': './dist/drizzle/index.js',
    },
  }),
  'packages/query-filter/dist/core/index.js': 'export const Op = 1;',
  'packages/query-filter/dist/zod/index.js': 'export const toZod = 1;',
  'packages/query-filter/dist/drizzle/index.js': 'export const compile = 1;',
  'packages/query-filter/src/core/index.ts': 'export const Op = 1;',
  'packages/query-filter/src/core/limits.test.ts':
    "import { it } from 'vitest';\nimport { Op } from './index.js';\nexport const t = [it, Op];",
  'packages/query-filter/src/drizzle/binding.test.ts':
    "import { it } from 'vitest';\nimport pg from 'pg';\nimport { sql } from 'drizzle-orm';\nimport { Op } from '../core/index.js';\nexport const t = [it, pg, sql, Op];",
  'packages/query-filter/src/zod/to-zod.ts':
    "import { z } from 'zod';\nimport { Op } from '../core/index.js';\nexport const a = [z, Op];",
  'packages/query-filter/src/zod/to-zod.test.ts':
    "import { it } from 'vitest';\nimport { z } from 'zod';\nimport { a } from './to-zod.js';\nexport const t = [it, z, a];",
  // legal: core from every layer but the domain, the zod entry from a router, a request DTO and a test
  [`${S}/orders/queries/find/find.filter-spec.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const spec = Op;",
  [`${S}/orders/queries/find/find.request.dto.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const dto = toZod;",
  [`${S}/orders/queries/find/find.router.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const router = toZod;",
  [`${S}/orders/queries/find/find.query.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const query = Op;",
  [`${S}/orders/application/uses-toolkit-core.service.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const a = Op;",
  [`${S}/orders/infrastructure/order-read.adapter.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const a = Op;",
  [`${S}/orders/commands/place/place.router.test.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const t = toZod;",
  // violations
  [`${S}/orders/domain/bad-toolkit-core.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const a = Op;",
  [`${S}/orders/domain/bad-toolkit-zod.test.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
  [`${S}/orders/application/bad-toolkit-zod.service.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
  [`${S}/orders/infrastructure/bad-toolkit-zod.adapter.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
  [`${S}/orders/queries/find/bad-toolkit-zod.filter-spec.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
  [`${S}/orders/queries/find/bad-toolkit-zod.query-handler.ts`]:
    "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
  'packages/query-filter/src/core/bad-library.ts': "import { z } from 'zod';\nexport const a = z;",
  'packages/query-filter/src/core/bad-library.test.ts':
    "import { z } from 'zod';\nexport const a = z;",
  'packages/query-filter/src/core/bad-entry.ts':
    "import { a } from '../zod/to-zod.js';\nexport const b = a;",
  'packages/query-filter/src/zod/bad-library.ts':
    "import { ok } from 'neverthrow';\nexport const a = ok;",
  'packages/query-filter/src/zod/bad-vitest.ts':
    "import { it } from 'vitest';\nexport const a = it;",
  'packages/query-filter/src/zod/bad-library.test.ts':
    "import { ok } from 'neverthrow';\nexport const a = ok;",
  'packages/query-filter/src/zod/bad-drizzle-entry.ts':
    "import { a } from '../drizzle/compile.js';\nexport const b = a;",
  'packages/query-filter/src/drizzle/compile.ts':
    "import { sql } from 'drizzle-orm';\nimport { Op } from '../core/index.js';\nexport const a = [sql, Op];",
  'packages/query-filter/src/drizzle/bad-library.ts':
    "import { z } from 'zod';\nexport const a = z;",
  'packages/query-filter/src/drizzle/bad-pg.ts': "import pg from 'pg';\nexport const a = pg;",
  'packages/query-filter/src/drizzle/bad-vitest.ts':
    "import { it } from 'vitest';\nexport const a = it;",
  'packages/query-filter/src/drizzle/bad-library.test.ts':
    "import { z } from 'zod';\nexport const a = z;",
  // legal: the drizzle entry from infrastructure and from a filter compiler in public/, the compiler from the
  // infrastructure of another module, a spec from any layer but the domain
  [`${S}/orders/infrastructure/find-orders.filter-binding.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/billing/public/invoice.filter-compiler.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/billing/public/invoice.filter-spec.ts`]:
    "import { Op } from '@bf/query-filter/core';\nexport const spec = Op;",
  [`${S}/orders/infrastructure/uses-billing-compiler.adapter.ts`]:
    "import { a } from '../../billing/public/invoice.filter-compiler.js';\nexport const b = a;",
  [`${S}/orders/application/uses-billing-spec.service.ts`]:
    "import { spec } from '../../billing/public/invoice.filter-spec.js';\nexport const a = spec;",
  [`${S}/orders/queries/find/find.e2e.test.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const t = compile;",
  // violations
  [`${S}/orders/domain/bad-toolkit-drizzle.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/orders/application/bad-toolkit-drizzle.service.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/orders/queries/find/bad-toolkit-drizzle.router.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/orders/queries/find/bad-toolkit-drizzle.query-handler.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/orders/queries/find/bad-toolkit-drizzle.filter-spec.ts`]:
    "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  [`${S}/orders/application/bad-billing-compiler.service.ts`]:
    "import { a } from '../../billing/public/invoice.filter-compiler.js';\nexport const b = a;",
  [`${S}/orders/queries/find/bad-billing-compiler.router.ts`]:
    "import { a } from '../../../billing/public/invoice.filter-compiler.js';\nexport const b = a;",
  'packages/query-filter/src/drizzle/bad-zod-entry.ts':
    "import { a } from '../zod/to-zod.js';\nexport const b = a;",
  'packages/query-filter/src/zod/bad-app.ts': `import { order } from '../../../../apps/backend/src/orders/domain/order.aggregate.js';\nexport const a = order;`,

  // What the kernel itself may import (ADR-049): neverthrow, and vitest in a test file
  'packages/kernel/src/uses-neverthrow.ts':
    "import { ok } from 'neverthrow';\nexport const a = ok;",
  'packages/kernel/src/result.test.ts':
    "import { it } from 'vitest';\nimport { ok } from 'neverthrow';\nexport const t = [it, ok];",
  'packages/kernel/src/bad-library.ts': "import { z } from 'zod';\nexport const a = z;",
  'packages/kernel/src/bad-vitest.ts': "import { it } from 'vitest';\nexport const a = it;",
  'packages/kernel/src/bad-library.test.ts': "import { z } from 'zod';\nexport const a = z;",
  'packages/kernel/src/bad-contracts.ts':
    "import { contracts } from '@bf/contracts';\nexport const a = contracts;",
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
  ['kernel-is-domain-free', 'packages/kernel/src/bad-contracts.ts'],
  ['kernel-npm-only-neverthrow', 'packages/kernel/src/bad-library.ts'],
  ['kernel-npm-only-neverthrow', 'packages/kernel/src/bad-vitest.ts'],
  ['kernel-tests-only-neverthrow-and-vitest', 'packages/kernel/src/bad-library.test.ts'],
  ['domain-packages-only-kernel', `${S}/orders/domain/bad-contracts.ts`],
  ['domain-packages-only-kernel', `${S}/orders/domain/bad-contracts.test.ts`],
  ['domain-packages-only-kernel', `${S}/orders/domain/bad-contracts-relative.ts`],
  ['domain-packages-only-kernel', 'apps/frontend/src/feature/domain/bad-contracts.ts'],
  ['qry-7-domain-no-toolkit', `${S}/orders/domain/bad-toolkit-core.ts`],
  ['qry-7-domain-no-toolkit', `${S}/orders/domain/bad-toolkit-zod.test.ts`],
  ['domain-packages-only-kernel', `${S}/orders/domain/bad-toolkit-core.ts`],
  ['qry-7-zod-entry-only-in-adapters', `${S}/orders/application/bad-toolkit-zod.service.ts`],
  ['qry-7-zod-entry-only-in-adapters', `${S}/orders/infrastructure/bad-toolkit-zod.adapter.ts`],
  ['qry-7-zod-entry-only-in-adapters', `${S}/orders/queries/find/bad-toolkit-zod.filter-spec.ts`],
  ['qry-7-zod-entry-only-in-adapters', `${S}/orders/queries/find/bad-toolkit-zod.query-handler.ts`],
  ['qry-7-domain-no-toolkit', `${S}/orders/domain/bad-toolkit-drizzle.ts`],
  [
    'qry-7-drizzle-entry-only-in-infrastructure',
    `${S}/orders/application/bad-toolkit-drizzle.service.ts`,
  ],
  [
    'qry-7-drizzle-entry-only-in-infrastructure',
    `${S}/orders/queries/find/bad-toolkit-drizzle.router.ts`,
  ],
  [
    'qry-7-drizzle-entry-only-in-infrastructure',
    `${S}/orders/queries/find/bad-toolkit-drizzle.query-handler.ts`,
  ],
  [
    'qry-7-drizzle-entry-only-in-infrastructure',
    `${S}/orders/queries/find/bad-toolkit-drizzle.filter-spec.ts`,
  ],
  [
    'qry-12-filter-compiler-only-from-infrastructure',
    `${S}/orders/application/bad-billing-compiler.service.ts`,
  ],
  [
    'qry-12-filter-compiler-only-from-infrastructure',
    `${S}/orders/queries/find/bad-billing-compiler.router.ts`,
  ],
  ['qry-6-drizzle-entry-only-drizzle-orm', 'packages/query-filter/src/drizzle/bad-library.ts'],
  ['qry-6-drizzle-entry-only-drizzle-orm', 'packages/query-filter/src/drizzle/bad-pg.ts'],
  ['qry-6-drizzle-entry-only-drizzle-orm', 'packages/query-filter/src/drizzle/bad-vitest.ts'],
  [
    'qry-6-drizzle-tests-only-drizzle-orm-pg-and-vitest',
    'packages/query-filter/src/drizzle/bad-library.test.ts',
  ],
  ['qry-6-core-no-libraries', 'packages/query-filter/src/core/bad-library.ts'],
  ['qry-6-core-tests-only-vitest', 'packages/query-filter/src/core/bad-library.test.ts'],
  ['qry-6-entries-are-independent', 'packages/query-filter/src/core/bad-entry.ts'],
  ['qry-6-zod-entry-only-zod', 'packages/query-filter/src/zod/bad-library.ts'],
  ['qry-6-zod-entry-only-zod', 'packages/query-filter/src/zod/bad-vitest.ts'],
  ['qry-6-zod-tests-only-zod-and-vitest', 'packages/query-filter/src/zod/bad-library.test.ts'],
  ['qry-6-entries-are-independent', 'packages/query-filter/src/zod/bad-drizzle-entry.ts'],
  ['qry-6-entries-are-independent', 'packages/query-filter/src/drizzle/bad-zod-entry.ts'],
  ['qry-6-toolkit-no-apps', 'packages/query-filter/src/zod/bad-app.ts'],
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
  to: string;
}

interface Cruise {
  violations: Violation[];
  modules: Module[];
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

/**
 * A package directory with an entry file, standing in for a library the repository has not
 * installed. `entry` places the file the way real packages ship it, often under dist/.
 */
function stubPackage(dir: string, name: string, entry = 'index.js'): string {
  const path = join(dir, name);
  mkdirSync(dirname(join(path, entry)), { recursive: true });
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name, main: entry }));
  writeFileSync(join(path, entry), 'exports.ok = 1;');
  return path;
}

/**
 * Writes `tree` into a temp directory next to the repository's real config, links the packages
 * it names, runs the real depcruise command over it and returns what it found.
 */
function cruiseTree(
  tree: Record<string, string>,
  links: string[],
  stubs: string[],
): [Cruise, string] {
  const tmp = mkdtempSync(join(tmpdir(), 'bf-boundaries-'));
  for (const [path, content] of Object.entries(tree)) {
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
  const extra: Record<string, string> = {};
  for (const name of links) extra[`@bf/${name}`] = join(tmp, `packages/${name}`);
  for (const name of stubs) {
    // neverthrow ships its entry under dist/, the shape that used to leave the graph
    extra[name] = stubPackage(
      join(tmp, '.stubs/node_modules'),
      name,
      name === 'neverthrow' ? 'dist/index.js' : 'index.js',
    );
  }
  linkNodeModules(join(root, 'node_modules'), join(tmp, 'node_modules'), extra);
  const appNodeModules = join(root, 'apps/backend/node_modules');
  linkNodeModules(appNodeModules, join(tmp, 'apps/backend/node_modules'), {});
  // a pnpm package carries its own node_modules; the kernel needs vitest and zod to resolve, the toolkit its own libraries
  linkNodeModules(appNodeModules, join(tmp, 'packages/kernel/node_modules'), {});
  linkNodeModules(
    join(root, 'packages/query-filter/node_modules'),
    join(tmp, 'packages/query-filter/node_modules'),
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
  const report = JSON.parse(stdout) as { modules: Module[]; summary: { violations: Violation[] } };
  return [{ violations: report.summary.violations, modules: report.modules }, tmp];
}

describe('dependency-cruiser boundaries', () => {
  let tmp = '';
  let violations: Violation[] = [];
  let modules: Module[] = [];

  before(() => {
    let cruise: Cruise;
    [cruise, tmp] = cruiseTree(
      files,
      ['kernel', 'contracts', 'query-filter'],
      ['neverthrow', 'openai'],
    );
    ({ violations, modules } = cruise);
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

  // Same reason: a rule that allows an import must have been shown that import.
  it('sees the kernel importing neverthrow, which ships from dist/, and finds it legal', () => {
    const kernelFile = modules.find((m) => m.source === 'packages/kernel/src/uses-neverthrow.ts');
    assert.ok(
      kernelFile?.dependencies.some((d) => /(^|\/)node_modules\/neverthrow\//.test(d.resolved)),
    );
  });

  // The same reason for the toolkit: the zod entry of a package built to dist/ must show in the graph.
  it('sees the router import of the toolkit zod entry in dist/ and finds it legal', () => {
    const router = modules.find((m) => m.source === `${S}/orders/queries/find/find.router.ts`);
    assert.ok(
      router?.dependencies.some((d) => d.resolved === 'packages/query-filter/dist/zod/index.js'),
    );
  });

  it('sees the application import of the toolkit core entry in dist/ and finds it legal', () => {
    const service = modules.find(
      (m) => m.source === `${S}/orders/application/uses-toolkit-core.service.ts`,
    );
    assert.ok(
      service?.dependencies.some((d) => d.resolved === 'packages/query-filter/dist/core/index.js'),
    );
  });

  it('sees the infrastructure import of the toolkit drizzle entry in dist/ and finds it legal', () => {
    const binding = modules.find(
      (m) => m.source === `${S}/orders/infrastructure/find-orders.filter-binding.ts`,
    );
    assert.ok(
      binding?.dependencies.some(
        (d) => d.resolved === 'packages/query-filter/dist/drizzle/index.js',
      ),
    );
  });

  it('sees the import of another module compiler from infrastructure and finds it legal', () => {
    const adapter = modules.find(
      (m) => m.source === `${S}/orders/infrastructure/uses-billing-compiler.adapter.ts`,
    );
    assert.ok(
      adapter?.dependencies.some(
        (d) => d.resolved === `${S}/billing/public/invoice.filter-compiler.ts`,
      ),
    );
  });

  it('reports nothing on the legal imports', () => {
    const legal = new Set(Object.keys(files).filter((p) => !expected.some(([, f]) => f === p)));
    const falsePositives = violations.filter(
      (v) => legal.has(v.from) && !/cycle-|bad-/.test(v.from),
    );
    assert.deepEqual(falsePositives, []);
  });
});

// ADR-049: a package that exports from dist/ must not drop out of the graph. The same rules are
// proven on a tree where the kernel and the contracts both resolve to a built file.
describe('dependency-cruiser boundaries with packages exported from dist/', () => {
  const dist = (name: string): Record<string, string> => ({
    [`packages/${name}/package.json`]: JSON.stringify({
      name: `@bf/${name}`,
      type: 'module',
      exports: { '.': './dist/index.js' },
    }),
    // the build output imports a library the kernel may not: it is a leaf, so nothing reads it
    [`packages/${name}/dist/index.js`]: "import 'zod';\nexport const ok = 1;",
  });
  const tree: Record<string, string> = {
    ...dist('kernel'),
    ...dist('contracts'),
    [`${S}/orders/domain/uses-kernel.ts`]: "import { ok } from '@bf/kernel';\nexport const a = ok;",
    [`${S}/orders/domain/bad-contracts.ts`]:
      "import { ok } from '@bf/contracts';\nexport const a = ok;",
  };
  let tmp = '';
  let cruise: Cruise = { violations: [], modules: [] };

  before(() => {
    [cruise, tmp] = cruiseTree(tree, ['kernel', 'contracts'], []);
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  it('sees the domain import of the kernel in dist/ and finds it legal', () => {
    const domainFile = cruise.modules.find((m) => m.source === `${S}/orders/domain/uses-kernel.ts`);
    assert.ok(domainFile?.dependencies.some((d) => d.resolved === 'packages/kernel/dist/index.js'));
    assert.deepEqual(
      cruise.violations.filter((v) => v.from === `${S}/orders/domain/uses-kernel.ts`),
      [],
    );
  });

  it('rejects the domain import of the contracts in dist/', () => {
    assert.ok(
      cruise.violations.some(
        (v) =>
          v.rule.name === 'domain-packages-only-kernel' &&
          v.from === `${S}/orders/domain/bad-contracts.ts` &&
          v.to === 'packages/contracts/dist/index.js',
      ),
      JSON.stringify(cruise.violations.map((v) => [v.rule.name, v.from, v.to])),
    );
  });

  it('keeps dist/ a leaf: what the build output imports is not judged', () => {
    assert.deepEqual(
      cruise.violations.filter((v) => v.from.startsWith('packages/')),
      [],
    );
  });
});

// ADR-050: the toolkit is imported by a name the checker cannot resolve (not installed, not built). The rules
// read the name too, so the import is judged although the file behind it is not there.
describe('dependency-cruiser boundaries with the toolkit not installed', () => {
  const tree: Record<string, string> = {
    [`${S}/orders/domain/bad-toolkit-core.ts`]:
      "import { Op } from '@bf/query-filter/core';\nexport const a = Op;",
    [`${S}/orders/application/bad-toolkit-zod.service.ts`]:
      "import { toZod } from '@bf/query-filter/zod';\nexport const a = toZod;",
    [`${S}/orders/queries/find/find.request.dto.ts`]:
      "import { toZod } from '@bf/query-filter/zod';\nexport const dto = toZod;",
    [`${S}/orders/domain/bad-toolkit-drizzle.ts`]:
      "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
    [`${S}/orders/application/bad-toolkit-drizzle.service.ts`]:
      "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
    [`${S}/orders/infrastructure/find-orders.filter-binding.ts`]:
      "import { compile } from '@bf/query-filter/drizzle';\nexport const a = compile;",
  };
  let tmp = '';
  let cruise: Cruise = { violations: [], modules: [] };

  before(() => {
    [cruise, tmp] = cruiseTree(tree, [], []);
  });

  after(() => rmSync(tmp, { recursive: true, force: true }));

  const fires = (rule: string, from: string) =>
    cruise.violations.some((v) => v.rule.name === rule && v.from === from);

  it('rejects the toolkit in the domain by name', () => {
    assert.ok(fires('qry-7-domain-no-toolkit', `${S}/orders/domain/bad-toolkit-core.ts`));
  });

  it('rejects the zod entry outside an adapter by name', () => {
    assert.ok(
      fires(
        'qry-7-zod-entry-only-in-adapters',
        `${S}/orders/application/bad-toolkit-zod.service.ts`,
      ),
    );
  });

  it('rejects the drizzle entry outside infrastructure by name', () => {
    assert.ok(fires('qry-7-domain-no-toolkit', `${S}/orders/domain/bad-toolkit-drizzle.ts`));
    assert.ok(
      fires(
        'qry-7-drizzle-entry-only-in-infrastructure',
        `${S}/orders/application/bad-toolkit-drizzle.service.ts`,
      ),
    );
  });

  it('lets infrastructure import the drizzle entry by name', () => {
    assert.ok(
      !cruise.violations.some(
        (v) =>
          v.from === `${S}/orders/infrastructure/find-orders.filter-binding.ts` &&
          v.rule.name.startsWith('qry-'),
      ),
    );
  });

  it('lets the request DTO import the zod entry by name', () => {
    assert.ok(
      !cruise.violations.some(
        (v) =>
          v.from === `${S}/orders/queries/find/find.request.dto.ts` &&
          v.rule.name.startsWith('qry-'),
      ),
    );
  });
});

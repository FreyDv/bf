/**
 * Domain-Driven Hexagon boundaries, as bound by ADR-025 and spelled out in
 * docs/standards/domain-driven-hexagon/bf-mapping.md (section 3). `pnpm deps` fails the build on a
 * violation; the same file ships in every NestJS app so the rules cannot drift per service.
 *
 * Layers are recognised by folder AND by file suffix (DDH-114/115), so a file in the right folder
 * with the wrong suffix, or the reverse, is still judged.
 */
const DOMAIN = [
  '^src/modules/[^/]+/domain/',
  '\\.(aggregate|entity|value-object|domain-event|errors|domain-service)\\.ts$',
];
const APPLICATION = [
  '^src/modules/[^/]+/application/',
  '^src/modules/[^/]+/(commands|queries)/[^/]+/[^/]+\\.(service|command|query|query-handler)\\.ts$',
  '\\.(port|domain-event-handler|mapper)\\.ts$',
];
const INFRASTRUCTURE = ['^src/modules/[^/]+/infrastructure/', '\\.(repository|adapter)\\.ts$'];
const INTERFACE = [
  '\\.(router|controller|dto)\\.ts$',
  '^src/modules/[^/]+/(commands|queries)/[^/]+/[^/]+\\.router\\.ts$',
];
/**
 * Recorded exception (backlog ARCH-1): the skeleton modules `identity` (auth), `invoices` (billing) and
 * `courses` (course) predate the standard and keep their flat shape (router/controller reaching Drizzle)
 * until migrated. The
 * application-layer and schema rules skip it; nothing new is added to it in that shape.
 */
const LEGACY = ['^src/modules/(identity|invoices|courses)/'];
const FRAMEWORK_AND_IO = [
  'node_modules/@nestjs',
  'node_modules/nestjs-trpc',
  'node_modules/@trpc',
  'node_modules/drizzle-orm',
  'node_modules/drizzle-kit',
  'node_modules/pg($|/)',
  'node_modules/express',
  'node_modules/@aws-sdk',
  'node_modules/openai',
  'node_modules/@bf/(contracts|db|events|trpc|storage|llm|server)',
  '^src/db/',
  '^src/app/',
];

module.exports = {
  forbidden: [
    {
      name: 'domain-is-framework-free',
      severity: 'error',
      comment: 'DDH-19/78/80: the domain imports only @bf/shared/ddd, built-ins and pure helpers',
      from: { path: DOMAIN },
      to: { path: FRAMEWORK_AND_IO },
    },
    {
      name: 'domain-knows-no-outer-layer',
      severity: 'error',
      comment: 'DDH-27: entities know nothing about services, adapters or routers',
      from: { path: DOMAIN },
      to: { path: [...APPLICATION, ...INFRASTRUCTURE, ...INTERFACE] },
    },
    {
      name: 'application-depends-on-ports-only',
      severity: 'error',
      comment: 'DDH-19/97: use cases talk to infrastructure through ports; no Drizzle, no adapters',
      from: { path: APPLICATION, pathNot: LEGACY },
      to: {
        path: [
          ...INFRASTRUCTURE,
          'node_modules/drizzle-orm',
          'node_modules/pg($|/)',
          '^src/db/',
          'node_modules/nestjs-trpc',
        ],
        pathNot: ['\\.port\\.ts$'],
      },
    },
    {
      name: 'use-cases-do-not-import-the-interface-layer',
      severity: 'error',
      comment:
        'DDH-115: commands, queries and services never depend on routers, controllers or DTOs',
      from: { path: APPLICATION },
      to: { path: INTERFACE },
    },
    {
      name: 'routers-do-not-touch-persistence',
      severity: 'error',
      comment:
        'bf-mapping section 6: a router validates, dispatches on the bus and maps the Result',
      from: { path: INTERFACE, pathNot: LEGACY },
      to: { path: [...INFRASTRUCTURE, 'node_modules/drizzle-orm', '^src/db/'] },
    },
    {
      name: 'infrastructure-does-not-import-the-interface-layer',
      severity: 'error',
      from: { path: INFRASTRUCTURE },
      to: { path: INTERFACE },
    },
    {
      name: 'no-cross-module-internals',
      severity: 'error',
      comment:
        'DDH-7/8: modules communicate through exported ports, tRPC clients or events, never by importing internals',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: [
          '^src/modules/$1/',
          '^src/modules/[^/]+/application/ports/',
          '^src/modules/[^/]+/contracts/',
        ],
      },
    },
    {
      name: 'schema-is-infrastructure-only',
      severity: 'error',
      comment: 'DDH-100: the Drizzle tables are the persistence model; only adapters read them',
      from: { path: '^src/modules/', pathNot: [...INFRASTRUCTURE, ...LEGACY] },
      to: { path: '^src/db/schema' },
    },
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'default', 'types'],
    },
  },
};

/** Hexagonal boundaries per bounded context. `pnpm deps` fails the build on violations. */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-framework-free',
      severity: 'error',
      comment: 'Domain layer must not import NestJS, drizzle, pg, express or any infrastructure',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: {
        path: [
          '^node_modules/@nestjs',
          'node_modules/drizzle-orm',
          'node_modules/pg',
          'node_modules/express',
          '^src/modules/[^/]+/(application|infrastructure|presentation)/',
          '^src/app/',
          '^src/db/',
        ],
      },
    },
    {
      name: 'application-no-infra',
      severity: 'error',
      comment: 'Application layer talks to infrastructure only through ports',
      from: { path: '^src/modules/[^/]+/application/' },
      to: {
        path: [
          '^src/modules/[^/]+/(infrastructure|presentation)/',
          'node_modules/drizzle-orm',
          'node_modules/pg',
        ],
      },
    },
    {
      name: 'no-cross-context-imports',
      severity: 'error',
      comment: 'Bounded contexts communicate via events/contracts, never by importing each other',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/contracts/'],
      },
    },
    {
      name: 'presentation-no-infra',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/presentation/' },
      to: { path: '^src/modules/[^/]+/infrastructure/' },
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

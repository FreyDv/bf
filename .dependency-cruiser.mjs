// Architecture boundaries (ENF-1, ADR-014). Layers are told apart by folder and by file suffix
// (STR-6, STR-7). Loosening a rule needs an ADR naming its ID; fix the import instead.

const SRC = '^apps/backend/src';
const MODULE = `${SRC}/([^/]+)`;

const ADAPTER =
  '\\.(router|controller|resolver|cli-controller|message-controller|request\\.dto)\\.ts$';
const APPLICATION_IN_SLICE =
  '\\.(command|query|command-handler|query-handler|service|port|domain-event-handler)\\.ts$';

const DOMAIN = `${MODULE}/domain/`;
const APPLICATION = `${MODULE}/application/`;
const INFRASTRUCTURE = `${MODULE}/infrastructure/`;
const DTOS = `${MODULE}/dtos/`;
const SLICE = `${MODULE}/(commands|queries)/`;

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'dep-2-domain-is-innermost',
      comment: 'DEP-2: the domain imports only the domain and the shared kernel.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        path: [APPLICATION, INFRASTRUCTURE, DTOS, `${SLICE}.*(${ADAPTER}|${APPLICATION_IN_SLICE})`],
      },
    },
    {
      name: 'dep-3-domain-no-libraries',
      comment:
        'DEP-3, DEP-6: no framework, ORM, driver, HTTP, logger, SDK or validation library in the domain. A single-purpose library needs an ADR.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        dependencyTypes: [
          'npm',
          'npm-dev',
          'npm-optional',
          'npm-peer',
          'npm-bundled',
          'npm-no-pkg',
          'npm-unknown',
        ],
      },
    },
    {
      name: 'dep-3-domain-no-io',
      comment: 'DEP-3: no process-external access from the domain.',
      severity: 'error',
      from: { path: DOMAIN },
      to: {
        dependencyTypes: ['core'],
        path: '^(node:)?(fs|fs/promises|net|http|http2|https|tls|dgram|dns|child_process|cluster|worker_threads)$',
      },
    },
    {
      name: 'dep-2-application-no-outer-layers',
      comment: 'DEP-2: application code does not reach infrastructure or interface adapters.',
      severity: 'error',
      from: { path: [APPLICATION, `${SLICE}.*${APPLICATION_IN_SLICE}`] },
      to: { path: [INFRASTRUCTURE, DTOS, `${SLICE}.*${ADAPTER}`] },
    },
    {
      name: 'dep-2-infrastructure-only-ports',
      comment:
        'DEP-2: infrastructure implements application ports and never imports other application code or adapters.',
      severity: 'error',
      from: { path: INFRASTRUCTURE },
      to: {
        path: [
          `${APPLICATION}(?!ports/)`,
          DTOS,
          `${SLICE}.*(${ADAPTER}|\\.(command|query|command-handler|query-handler|service|domain-event-handler)\\.ts$)`,
        ],
      },
    },
    {
      name: 'dep-2-adapters-no-domain-no-infrastructure',
      comment:
        'DEP-2, ADP-3: interface adapters talk to the application through commands, queries and the bus only.',
      severity: 'error',
      from: { path: [`${SLICE}.*${ADAPTER}`, DTOS] },
      to: { path: [DOMAIN, INFRASTRUCTURE] },
    },
    {
      name: 'dep-5-modules-only-through-public',
      comment: 'DEP-5, QRY-12: another module is reachable only through its public/ folder.',
      severity: 'error',
      from: { path: `${MODULE}/` },
      to: { path: `${SRC}/[^/]+/(?!public/)`, pathNot: `${SRC}/$1/` },
    },
    {
      name: 'dep-8-no-slice-to-slice',
      comment:
        'DEP-8: a use case does not import another use case; shared logic moves to module level.',
      severity: 'error',
      from: { path: `${MODULE}/(?:commands|queries)/([^/]+)/` },
      to: {
        path: `${SRC}/$1/(?:commands|queries)/`,
        pathNot: `${SRC}/$1/(?:commands|queries)/$2/`,
      },
    },
    {
      name: 'dep-9-no-circular',
      comment: 'DEP-9: cycles are forbidden at every level.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'apps-do-not-import-each-other',
      comment: 'ADR-008, ADR-009: apps share code only through packages.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/', pathNot: '^apps/$1/' },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'An import the checker cannot resolve is an import it cannot check.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'not-to-dev-dep-from-prod',
      comment: 'Production code does not import devDependencies.',
      severity: 'error',
      from: { path: '^apps/[^/]+/(src|app)/', pathNot: '\\.test\\.tsx?$' },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['(^|/)dist/', '(^|/)\\.next/', '(^|/)coverage/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/backend/tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    reporterOptions: { text: { highlightFocused: true } },
  },
};

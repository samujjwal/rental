/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-common-to-modules',
      comment:
        'Files in common/ must not import from modules/. ' +
        'common/ is the lower-level shared layer; modules/ depends on common/, not the other way.',
      severity: 'error',
      from: { path: '^src/common/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      comment:
        'Files that are not reachable from any entry point are likely dead code. ' +
        'Severity set to warn so it does not block builds.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.(spec|test|e2e-spec)\\.(ts|js)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)jest\\.config\\.',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};

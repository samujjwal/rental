module.exports = {
  options: {
    /* TypeScript/JavaScript: import tsconfig.json */
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    /* Base directory for module resolution */
    baseDir: __dirname,
    /* Enhanced reporting */
    enhancedResolveOptions: {
      /* Use TypeScript for module resolution */
      tsConfigPath: './tsconfig.json',
    },
    /* Do not report on node_modules */
    exclude: {
      path: 'node_modules',
    },
    /* Do not report on test files */
    exclude: {
      path: ['.*/test/.*', '.*/spec.ts'],
    },
  },
  rules: [
    /* Detect circular dependencies */
    {
      name: 'no-circular',
      comment:
        'This rule detects circular dependencies between modules. Circular dependencies cause runtime errors in NestJS.',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },
    /* Prevent importing from test files */
    {
      name: 'no-test-in-production',
      comment: 'Production code should not import from test files.',
      severity: 'error',
      from: {
        path: '^(apps|packages)/',
      },
      to: {
        path: '/test/',
      },
    },
    /* Prevent importing from common modules into app-specific modules (architectural boundary) */
    {
      name: 'arch-boundary',
      comment: 'App-specific modules should not import from other apps directly.',
      severity: 'error',
      from: {
        path: '^apps/[^/]+/src/',
      },
      to: {
        path: '^apps/[^/]+/src/',
        notSamePackage: true,
      },
    },
  ],
};

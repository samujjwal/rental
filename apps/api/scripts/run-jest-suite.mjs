import { spawnSync } from 'node:child_process';

const suite = process.argv[2] ?? 'unit';
const extraArgs = process.argv.slice(3);

const suites = {
  unit: [],
  watch: ['--watch'],
  coverage: ['--coverage'],
  e2e: ['--config', './test/jest-e2e.json', '--runInBand'],
  smoke: ['--config', './test/jest-e2e.json', '--testPathPatterns', 'smoke', '--runInBand'],
  security: ['--config', './test/jest-e2e.json', '--testPathPatterns', 'security', '--runInBand'],
  property: ['--testPathPatterns', 'property'],
  chaos: ['--testPathPatterns', 'chaos'],
};

if (!(suite in suites)) {
  console.error(
    `Unknown Jest suite "${suite}". Expected one of: ${Object.keys(suites).join(', ')}`,
  );
  process.exit(1);
}

const localStorageFlag = '--localstorage-file=/tmp/rental-api-localstorage.json';
const nodeOptions = process.env.NODE_OPTIONS?.includes(localStorageFlag)
  ? process.env.NODE_OPTIONS
  : [process.env.NODE_OPTIONS, localStorageFlag].filter(Boolean).join(' ');

const result = spawnSync('pnpm', ['exec', 'jest', ...suites[suite], ...extraArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

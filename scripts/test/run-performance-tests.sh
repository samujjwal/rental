import { spawnSync } from 'node:child_process';

const suite = process.argv[2] ?? 'api';
const extraArgs = process.argv.slice(3);

const suites = {
  api: 'tests/load/api-load-test.js',
  journey: 'tests/load/user-journey-test.js',
  stress: 'tests/load/stress-test.js',
  spike: 'tests/load/spike-test.js',
};

const runSuite = (name) => {
  const file = suites[name];

  if (!file) {
    console.error(
      `Unknown k6 suite "${name}". Expected one of: ${[...Object.keys(suites), 'all'].join(', ')}`,
    );
    process.exit(1);
  }

  const result = spawnSync('k6', ['run', file, ...extraArgs], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (suite === 'all') {
  Object.keys(suites).forEach(runSuite);
  process.exit(0);
}

runSuite(suite);

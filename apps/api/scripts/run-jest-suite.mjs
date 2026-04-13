import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const suite = process.argv[2] ?? 'unit';
const extraArgs = process.argv.slice(3);

// Check if Docker is running for integration tests
if (suite === 'e2e' || suite === 'security' || suite === 'smoke') {
  console.log('🔍 Checking Docker status...');
  const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' });
  if (dockerCheck.status !== 0) {
    console.log('❌ Docker is not running. Starting Docker...');
    spawnSync('open', ['-a', 'Docker'], { stdio: 'inherit' });
    console.log('⏳ Waiting for Docker to start...');
    // Wait for Docker to be ready
    let attempts = 0;
    const maxAttempts = 30;
    while (attempts < maxAttempts) {
      const check = spawnSync('docker', ['info'], { stdio: 'pipe' });
      if (check.status === 0) {
        console.log('✅ Docker is ready');
        break;
      }
      attempts++;
      if (attempts < maxAttempts) {
        spawnSync('sleep', ['2'], { stdio: 'inherit' });
      }
    }
    if (attempts === maxAttempts) {
      console.error('❌ Docker failed to start. Please start Docker manually.');
      process.exit(1);
    }
  } else {
    console.log('✅ Docker is running');
  }

  // Check if test infrastructure is running
  console.log('🔍 Checking test infrastructure...');
  const postgresCheck = spawnSync('docker', ['ps', '--filter', 'name=rental-postgres-test', '--format', '{{.Status}}'], { stdio: 'pipe' });
  if (!postgresCheck.stdout.toString().includes('Up')) {
    console.log('🚀 Starting test infrastructure...');
    const setupResult = spawnSync('./scripts/env/start-env.sh', ['test', 'start'], { 
      stdio: 'inherit',
      cwd: process.env.PWD 
    });
    if (setupResult.status !== 0) {
      console.error('❌ Failed to start test infrastructure');
      process.exit(1);
    }
    console.log('✅ Test infrastructure is ready');
  } else {
    console.log('✅ Test infrastructure is running');
  }
}

const suites = {
  unit: [],
  watch: ['--watch'],
  coverage: ['--coverage'],
  contract: ['--testPathPatterns', '\.contract\.spec\.ts$'],
  e2e: ['--config', './test/jest-e2e.json', '--runInBand'],
  smoke: ['--config', './test/jest-e2e.json', '--testPathPatterns', 'smoke', '--runInBand'],
  security: ['--config', './test/jest-e2e.json', '--testPathPatterns', 'security', '--runInBand'],
  property: ['--testPathPatterns', 'property'],
  chaos: ['--config', './test/jest-e2e.json', '--testPathPatterns', 'chaos', '--runInBand'],
  integration: ['--config', './test/jest.integration.config.js', '--runInBand'],
  reliability: ['--config', './test/jest.reliability.config.js', '--runInBand'],
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

// Load .env.test for integration tests
let env = { ...process.env, NODE_OPTIONS: nodeOptions };
if (suite === 'e2e' || suite === 'security' || suite === 'smoke') {
  const envTestPath = '.env.test';
  if (existsSync(envTestPath)) {
    console.log('📄 Loading .env.test configuration');
    const envTestContent = readFileSync(envTestPath, 'utf-8');
    envTestContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
}

const result = spawnSync('pnpm', ['exec', 'jest', ...suites[suite], ...extraArgs], {
  stdio: 'inherit',
  env,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

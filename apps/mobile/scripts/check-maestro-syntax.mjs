import { readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = path.resolve(process.cwd(), '.maestro');
const flowFiles = readdirSync(rootDir)
  .filter((entry) => entry.endsWith('.yaml'))
  .sort();

if (flowFiles.length === 0) {
  console.error('No Maestro flow files were found in .maestro/.');
  process.exit(1);
}

let hasFailure = false;

for (const flowFile of flowFiles) {
  const flowPath = path.join(rootDir, flowFile);
  console.log(`Checking ${flowFile}`);
  const result = spawnSync('maestro', ['check-syntax', flowPath], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    hasFailure = true;
    break;
  }
}

if (hasFailure) {
  process.exit(1);
}

console.log(`Validated ${flowFiles.length} Maestro flow files.`);
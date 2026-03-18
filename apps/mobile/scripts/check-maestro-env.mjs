import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function run(command, args = []) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function printCheck(label, ok, details) {
  const prefix = ok ? '[ok]' : '[missing]';
  console.log(`${prefix} ${label}`);
  if (details) {
    console.log(`      ${details}`);
  }
}

const maestro = run('maestro', ['--version']);
printCheck('Maestro CLI', maestro.ok, maestro.ok ? maestro.stdout : maestro.stderr || 'Install Maestro first.');

const developerDir = run('xcode-select', ['-p']);
const simctl = run('xcrun', ['--find', 'simctl']);
const iosAvailable = developerDir.ok && simctl.ok;
printCheck(
  'iOS simulator tooling',
  iosAvailable,
  iosAvailable
    ? `${developerDir.stdout} | simctl at ${simctl.stdout}`
    : simctl.stderr || developerDir.stderr || 'Full Xcode with simulator tooling is not configured.'
);

const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
const fallbackSdkRoot = path.join(process.env.HOME || '', 'Library', 'Android', 'sdk');
const resolvedSdkRoot = androidHome || (existsSync(fallbackSdkRoot) ? fallbackSdkRoot : '');
const adb = run('sh', ['-lc', 'command -v adb']);
const emulator = run('sh', ['-lc', 'command -v emulator']);
const androidAvailable = Boolean(resolvedSdkRoot) && adb.ok && emulator.ok;
printCheck(
  'Android emulator tooling',
  androidAvailable,
  androidAvailable
    ? `SDK: ${resolvedSdkRoot}`
    : [
        resolvedSdkRoot ? `SDK root candidate: ${resolvedSdkRoot}` : 'ANDROID_HOME / ANDROID_SDK_ROOT is not set.',
        adb.ok ? null : 'adb is not on PATH.',
        emulator.ok ? null : 'emulator is not on PATH.',
      ]
        .filter(Boolean)
        .join(' ')
);

const hasRuntime = iosAvailable || androidAvailable;

if (!hasRuntime) {
  console.error('\nNo local iOS simulator or Android emulator tooling is ready for Maestro.');
  console.error('Next steps:');
  console.error('  1. Install full Xcode and confirm `xcrun --find simctl` works, or');
  console.error('  2. Install Android SDK/emulator and export ANDROID_HOME or ANDROID_SDK_ROOT.');
  process.exit(1);
}

console.log('\nAt least one local mobile runtime is available for Maestro.');
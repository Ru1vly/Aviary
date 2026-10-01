import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const help = spawnSync(process.execPath, ['dist/cli.js', '--help'], {
  encoding: 'utf8',
});

if (help.error) {
  throw help.error;
}

if (help.status !== 0) {
  process.stderr.write(help.stderr);
  process.exit(help.status ?? 1);
}

const documentation = ['README.md', 'docs/GEO.md']
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const longOptions = (text) =>
  new Set([...text.matchAll(/--[a-z][a-z0-9-]*/g)].map(([option]) => option));

const cliOptions = longOptions(`${help.stdout}\n${help.stderr}`);
const documentedOptions = longOptions(documentation);
const missingOptions = [...cliOptions].filter((option) => !documentedOptions.has(option));

if (missingOptions.length > 0) {
  console.error(
    `Undocumented CLI options (${missingOptions.length} of ${cliOptions.size}):\n${missingOptions.map((option) => `- ${option}`).join('\n')}`
  );
  process.exit(1);
}

console.log(`CLI options documented: ${cliOptions.size}/${cliOptions.size}`);

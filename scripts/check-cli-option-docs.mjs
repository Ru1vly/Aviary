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

const documentation = ['README.md', 'docs/CLI.md', 'docs/GEO.md']
  .map((path) => readFileSync(path, 'utf8'))
  .join('\n');
const optionsMatching = (text, pattern) =>
  new Set([...text.matchAll(pattern)].map(([option]) => option));

const cliHelp = `${help.stdout}\n${help.stderr}`;
const cliOptions = optionsMatching(cliHelp, /--[a-z][a-z0-9-]*/g);
const documentedOptions = optionsMatching(documentation, /--[a-z][a-z0-9-]*/g);
const cliShortcuts = optionsMatching(cliHelp, /(?<![a-zA-Z0-9-])-[a-zA-Z]\b/g);
const documentedShortcuts = optionsMatching(documentation, /(?<![a-zA-Z0-9-])-[a-zA-Z]\b/g);
const missingOptions = [...cliOptions].filter((option) => !documentedOptions.has(option));
const missingShortcuts = [...cliShortcuts].filter((option) => !documentedShortcuts.has(option));

if (missingOptions.length > 0 || missingShortcuts.length > 0) {
  if (missingOptions.length > 0) {
    console.error(
      `Undocumented long options (${missingOptions.length} of ${cliOptions.size}):\n${missingOptions.map((option) => `- ${option}`).join('\n')}`
    );
  }
  if (missingShortcuts.length > 0) {
    console.error(
      `Undocumented shortcuts (${missingShortcuts.length} of ${cliShortcuts.size}):\n${missingShortcuts.map((option) => `- ${option}`).join('\n')}`
    );
  }
  process.exit(1);
}

console.log(
  `CLI switches documented: ${cliOptions.size + cliShortcuts.size}/${cliOptions.size + cliShortcuts.size} (${cliOptions.size} long, ${cliShortcuts.size} short)`
);

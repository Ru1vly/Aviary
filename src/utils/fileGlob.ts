import * as fs from 'node:fs';
import * as path from 'node:path';

const MAX_MATCHED_FILES = 1_000;
const MAX_VISITED_ENTRIES = 100_000;
const MAX_DIRECTORY_DEPTH = 32;

function hasMagic(segment: string): boolean {
  return /[*?]/.test(segment);
}

function matchesSegment(pattern: string, value: string): boolean {
  let expression = '^';
  for (const character of pattern) {
    if (character === '*') expression += '.*';
    else if (character === '?') expression += '.';
    else expression += '\\^$+?.()|[]{}'.includes(character) ? `\\${character}` : character;
  }
  expression += '$';
  return new RegExp(expression).test(value);
}

function readDirectory(directory: string): fs.Dirent[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Expand a local URL-list file glob. Supports `*`, `?`, and recursive `**`; symlinks are not followed. */
export function expandUrlListFiles(pattern: string): string[] {
  const absolute = path.resolve(pattern);
  const parsed = path.parse(absolute);
  const segments = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  const wildcardIndex = segments.findIndex(hasMagic);
  if (wildcardIndex === -1) return [absolute];

  const root = path.join(parsed.root, ...segments.slice(0, wildcardIndex));
  const remaining = segments.slice(wildcardIndex);
  const matches = new Set<string>();
  const visitedStates = new Set<string>();
  let visitedEntries = 0;

  const addFile = (filePath: string): void => {
    matches.add(filePath);
    if (matches.size > MAX_MATCHED_FILES) {
      throw new Error(
        `URL-list glob matched more than ${MAX_MATCHED_FILES} files; narrow the pattern.`
      );
    }
  };

  const visit = (directory: string, segmentIndex: number, depth: number): void => {
    if (depth > MAX_DIRECTORY_DEPTH) {
      throw new Error(
        `URL-list glob traversal exceeded ${MAX_DIRECTORY_DEPTH} directory levels; narrow the pattern.`
      );
    }
    const state = `${directory}\0${segmentIndex}`;
    if (visitedStates.has(state)) return;
    visitedStates.add(state);

    if (segmentIndex >= remaining.length) {
      try {
        if (fs.statSync(directory).isFile()) addFile(directory);
      } catch {
        // Missing paths are reported as an empty glob result below.
      }
      return;
    }

    const segment = remaining[segmentIndex];
    if (!segment) return;
    if (segment === '**') {
      visit(directory, segmentIndex + 1, depth);
      for (const entry of readDirectory(directory)) {
        visitedEntries += 1;
        if (visitedEntries > MAX_VISITED_ENTRIES) {
          throw new Error(
            `URL-list glob visited more than ${MAX_VISITED_ENTRIES} filesystem entries; narrow the pattern.`
          );
        }
        if (entry.name.startsWith('.')) continue;
        const childPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(childPath, segmentIndex, depth + 1);
        } else if (segmentIndex === remaining.length - 1 && entry.isFile()) {
          addFile(childPath);
        }
      }
      return;
    }

    for (const entry of readDirectory(directory)) {
      visitedEntries += 1;
      if (visitedEntries > MAX_VISITED_ENTRIES) {
        throw new Error(
          `URL-list glob visited more than ${MAX_VISITED_ENTRIES} filesystem entries; narrow the pattern.`
        );
      }
      if (entry.name.startsWith('.') && !segment.startsWith('.')) continue;
      if (!matchesSegment(segment, entry.name)) continue;
      const childPath = path.join(directory, entry.name);
      if (segmentIndex === remaining.length - 1) {
        if (entry.isFile()) addFile(childPath);
      } else if (entry.isDirectory()) {
        visit(childPath, segmentIndex + 1, depth + 1);
      }
    }
  };

  visit(root, 0, 0);
  if (matches.size === 0)
    throw new Error(`No URL-list files matched the glob pattern "${pattern}".`);
  return [...matches].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

import { describe, expect, it } from 'vitest';
import { API_CLI_HELP, parseApiCliAction } from '../../src/api/cliOptions';

describe('API entrypoint arguments', () => {
  it('starts the server only with no arguments', () => {
    expect(parseApiCliAction([])).toBe('serve');
  });
  it.each(['--help', '-h'])('recognizes %s without starting a listener', (flag) => {
    expect(parseApiCliAction([flag])).toBe('help');
  });
  it.each(['--version', '-v'])('recognizes %s without starting a listener', (flag) => {
    expect(parseApiCliAction([flag])).toBe('version');
  });
  it.each([
    ['--unknown'],
    ['--port', '4444'],
    ['--help', '--unknown'],
    ['--help', '--version'],
    ['URL'],
  ])('rejects unsupported or combined arguments %j', (...args) => {
    expect(() => parseApiCliAction(args)).toThrow(/Unsupported API arguments/);
  });
  it('documents environment configuration and listener security requirements', () => {
    expect(API_CLI_HELP).toContain('Usage: aviary-api');
    expect(API_CLI_HELP).toContain('AVIARY_API_PORT');
    expect(API_CLI_HELP).toContain('Non-loopback listeners require bearer authentication and TLS');
  });
});

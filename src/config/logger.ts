// 12-Factor: route all logs to stderr as structured event streams, keeping
// stdout reserved for program output (e.g. `aviary --json`). Logging to
// stdout would interleave log lines with the JSON report and corrupt it.
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.level]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data ? { data } : {}),
    };
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  debug(msg: string, data?: Record<string, unknown>) {
    this.log('debug', msg, data);
  }
  info(msg: string, data?: Record<string, unknown>) {
    this.log('info', msg, data);
  }
  warn(msg: string, data?: Record<string, unknown>) {
    this.log('warn', msg, data);
  }
  error(msg: string, data?: Record<string, unknown>) {
    this.log('error', msg, data);
  }
}

export const createLogger = (level: LogLevel = 'info') => new Logger(level);
export type { LogLevel };

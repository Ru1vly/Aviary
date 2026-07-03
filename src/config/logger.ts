// 12-Factor: Route all logs to stdout as structured event streams
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
    process.stdout.write(JSON.stringify(entry) + '\n');
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

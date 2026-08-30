/**
 * Error logging and reporting system
 */

import { SEOCheckerError, ErrorSeverity } from './types.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  error?: SEOCheckerError;
  metadata?: Record<string, unknown>;
}

export interface LoggerOptions {
  /**
   * Minimum log level to output
   * @default LogLevel.INFO
   */
  minLevel?: LogLevel;

  /**
   * Whether to output to console
   * @default true
   */
  console?: boolean;

  /**
   * Whether to include stack traces in logs
   * @default true
   */
  includeStackTrace?: boolean;

  /**
   * Whether to use colored output in console
   * @default true
   */
  colorize?: boolean;
}

/**
 * Singleton error logger for centralized logging
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private options: Required<LoggerOptions>;

  private constructor(options: LoggerOptions = {}) {
    this.options = {
      minLevel: options.minLevel ?? LogLevel.INFO,
      console: options.console ?? true,
      includeStackTrace: options.includeStackTrace ?? true,
      colorize: options.colorize ?? true,
    };
  }

  static getInstance(options?: LoggerOptions): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger(options);
    } else if (options) {
      // Update options if provided
      ErrorLogger.instance.options = {
        ...ErrorLogger.instance.options,
        ...options,
      };
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an info message
   */
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, undefined, metadata);
  }

  /**
   * Log a warning message
   */
  logWarning(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, undefined, metadata);
  }

  /**
   * Log an error
   */
  logError(error: SEOCheckerError, metadata?: Record<string, unknown>): void {
    const level = this.severityToLogLevel(error.context.severity);
    this.log(level, error.message, error, metadata);
  }

  /**
   * Log a retry attempt
   */
  logRetry(error: SEOCheckerError, attempt: number, delay: number): void {
    this.log(LogLevel.WARN, `Retry attempt ${attempt} after ${delay}ms`, error, {
      retryAttempt: attempt,
      retryDelay: delay,
    });
  }

  /**
   * Core logging function
   */
  private log(
    level: LogLevel,
    message: string,
    error?: SEOCheckerError,
    metadata?: Record<string, unknown>
  ): void {
    if (level < this.options.minLevel) {
      return;
    }

    if (this.options.console) {
      this.logToConsole({ timestamp: new Date(), level, message, error, metadata });
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelStr}]`;

    let output = `${prefix} ${entry.message}`;

    if (this.options.colorize) {
      output = this.colorize(output, entry.level);
    }

    if (entry.error) {
      const errorDetails = this.formatError(entry.error);
      output += `\n${errorDetails}`;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      output += `\n  Metadata: ${JSON.stringify(entry.metadata, null, 2)}`;
    }

    // All levels go to stderr, not just ERROR+: stdout is reserved for
    // program output (e.g. `aviary --json`). Writing INFO/WARN/DEBUG to
    // stdout here would interleave log lines with the JSON report and
    // corrupt it, exactly like the bug fixed in src/config/logger.ts.
    process.stderr.write(output + '\n');
  }

  /**
   * Format error for display
   */
  private formatError(error: SEOCheckerError): string {
    let output = `  Error: ${error.name}\n`;
    output += `  Category: ${error.context.category}\n`;
    output += `  Severity: ${error.context.severity}\n`;

    if (error.context.url) {
      output += `  URL: ${error.context.url}\n`;
    }

    if (error.context.checkName) {
      output += `  Check: ${error.context.checkName}\n`;
    }

    if (error.context.retryCount !== undefined) {
      output += `  Retry Count: ${error.context.retryCount}\n`;
    }

    if (this.options.includeStackTrace && error.context.stackTrace) {
      output += `  Stack Trace:\n${error.context.stackTrace
        .split('\n')
        .map((line) => `    ${line}`)
        .join('\n')}`;
    }

    return output;
  }

  /**
   * Colorize output based on log level
   */
  private colorize(text: string, level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: '\x1b[90m', // Gray
      [LogLevel.INFO]: '\x1b[36m', // Cyan
      [LogLevel.WARN]: '\x1b[33m', // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.CRITICAL]: '\x1b[41m\x1b[37m', // Red background, white text
    };

    const reset = '\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  /**
   * Convert error severity to log level
   */
  private severityToLogLevel(severity: ErrorSeverity): LogLevel {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return LogLevel.CRITICAL;
      case ErrorSeverity.ERROR:
        return LogLevel.ERROR;
      case ErrorSeverity.WARNING:
        return LogLevel.WARN;
      case ErrorSeverity.INFO:
        return LogLevel.INFO;
      default:
        return LogLevel.INFO;
    }
  }
}

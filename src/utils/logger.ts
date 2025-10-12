type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  isDevelopment: boolean;
  minLevel: LogLevel;
  enableTimestamps: boolean;
}

class Logger {
  private config: LoggerConfig;
  private readonly levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor() {
    const isDev = __DEV__ || process.env.NODE_ENV === 'development';
    
    this.config = {
      isDevelopment: isDev,
      // Changed: dev mode now defaults to 'info' instead of 'debug' to reduce noise
      minLevel: isDev ? 'info' : 'warn',
      enableTimestamps: isDev,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const timestamp = this.config.enableTimestamps
      ? `[${new Date().toISOString()}]`
      : '';
    
    const levelTag = `[${level.toUpperCase()}]`;
    const formattedMessage = `${timestamp}${levelTag} ${message}`;
    
    return [formattedMessage, ...args];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message, ...args));
    }
  }

  group(label: string): void {
    if (this.config.isDevelopment && console.group) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.config.isDevelopment && console.groupEnd) {
      console.groupEnd();
    }
  }

  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): Readonly<LoggerConfig> {
    return { ...this.config };
  }

  // Utility to temporarily enable debug mode
  enableDebugMode(): void {
    this.config.minLevel = 'debug';
    console.log('[LOGGER] Debug mode enabled - all logs will be shown');
  }

  // Utility to disable debug mode
  disableDebugMode(): void {
    const isDev = __DEV__ || process.env.NODE_ENV === 'development';
    this.config.minLevel = isDev ? 'info' : 'warn';
    console.log('[LOGGER] Debug mode disabled - normal filtering resumed');
  }
}

export const logger = new Logger();
export type { LogLevel, LoggerConfig };
export const { debug, info, warn, error, group, groupEnd } = logger;

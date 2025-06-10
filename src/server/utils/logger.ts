// Logging utility
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

interface TLogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: any;
}

function formatLogEntry(level: LogLevel, message: string, metadata?: any): TLogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    metadata
  };
}

export function logError(message: string, error?: Error | any): void {
  const entry = formatLogEntry(LogLevel.ERROR, message, {
    error: error?.message,
    stack: error?.stack
  });
  console.error(JSON.stringify(entry));
}

export function logWarn(message: string, metadata?: any): void {
  const entry = formatLogEntry(LogLevel.WARN, message, metadata);
  console.warn(JSON.stringify(entry));
}

export function logInfo(message: string, metadata?: any): void {
  const entry = formatLogEntry(LogLevel.INFO, message, metadata);
  console.log(JSON.stringify(entry));
}

export function logDebug(message: string, metadata?: any): void {
  if (process.env.NODE_ENV === 'development') {
    const entry = formatLogEntry(LogLevel.DEBUG, message, metadata);
    console.debug(JSON.stringify(entry));
  }
}

export function logRequest(req: any): void {
  logInfo('Request received', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });
}

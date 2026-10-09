/**
 * Tiny leveled logger. Deliberately dependency-free and never logs secrets:
 * callers must pass already-sanitised messages.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function currentLevel(): LogLevel {
  const fromEnv = process.env.AGZOS_LOG_LEVEL as LogLevel | undefined;
  if (fromEnv && fromEnv in ORDER) return fromEnv;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function emit(level: LogLevel, scope: string, message: string, meta?: unknown): void {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const line = `[agzos:${scope}] ${message}`;
  const args: unknown[] = meta === undefined ? [line] : [line, meta];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  // eslint-disable-next-line no-console
  else console.log(...args);
}

export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, meta) => emit('debug', scope, m, meta),
    info: (m, meta) => emit('info', scope, m, meta),
    warn: (m, meta) => emit('warn', scope, m, meta),
    error: (m, meta) => emit('error', scope, m, meta),
  };
}

'use strict';

import config from './config';

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const currentLevel: number = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= currentLevel;
}

const logger = {
  error(...args: unknown[]): void {
    if (shouldLog('error')) console.error(...args);
  },
  warn(...args: unknown[]): void {
    if (shouldLog('warn')) console.warn(...args);
  },
  info(...args: unknown[]): void {
    if (shouldLog('info')) console.log(...args);
  },
  debug(...args: unknown[]): void {
    if (shouldLog('debug')) console.debug(...args);
  },
};

export default logger;

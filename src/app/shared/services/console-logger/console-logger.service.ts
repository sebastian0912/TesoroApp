import { Injectable } from '@angular/core';

export interface ConsoleEntry {
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ConsoleLoggerService {
  private logs: ConsoleEntry[] = [];
  private maxLogs = 50;
  private initialized = false;
  private capturing = false;

  private originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  };

  private readonly IGNORED_PATTERNS = [
    'NG0956',
    'NG0955',
    'tracking expression',
    'angular.dev/errors',
    'console-logger.service',
  ];

  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    (['log', 'warn', 'error', 'info'] as const).forEach((type) => {
      const original = this.originalConsole[type];
      console[type] = (...args: any[]) => {
        if (!this.capturing) {
          this.capturing = true;
          this.capture(type, args);
          this.capturing = false;
        }
        original.apply(console, args);
      };
    });

    window.addEventListener('error', (event) => {
      this.capture('error', [`[Uncaught] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`]);
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.capture('error', [`[UnhandledPromise] ${event.reason}`]);
    });
  }

  private capture(type: ConsoleEntry['type'], args: any[]): void {
    const message = args
      .map((a) => {
        try {
          return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

    if (this.IGNORED_PATTERNS.some((p) => message.includes(p))) return;

    this.logs.push({
      type,
      message: message.substring(0, 500),
      timestamp: new Date().toISOString(),
    });

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  getLogs(): ConsoleEntry[] {
    return [...this.logs];
  }

  getErrorLogs(): ConsoleEntry[] {
    return this.logs.filter((l) => l.type === 'error' || l.type === 'warn');
  }

  getLogsAsText(): string {
    return this.logs
      .map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`)
      .join('\n');
  }

  clear(): void {
    this.logs = [];
  }
}

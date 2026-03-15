type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";

class Logger {
  private minLevel: LogLevel;
  private prefix: string;

  constructor(prefix: string = "Engine", minLevel: LogLevel = "debug") {
    this.prefix = prefix;
    this.minLevel = minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const timestamp = this.formatTimestamp();
    const color = LEVEL_COLORS[level];
    const levelStr = level.toUpperCase().padEnd(5);
    const formatted = `${color}[${timestamp}] [${levelStr}] [${this.prefix}]${RESET} ${message}`;

    if (data !== undefined) {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
        formatted,
        typeof data === "object" ? JSON.stringify(data, null, 2) : data
      );
    } else {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
        formatted
      );
    }
  }

  debug(message: string, data?: unknown): void {
    this.log("debug", message, data);
  }

  info(message: string, data?: unknown): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: unknown): void {
    this.log("error", message, data);
  }

  child(prefix: string): Logger {
    return new Logger(`${this.prefix}:${prefix}`, this.minLevel);
  }
}

export const logger = new Logger("ClawWars");
export { Logger };

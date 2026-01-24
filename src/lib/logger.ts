import { isTTY } from "../utility/terminal-utils.js";
import { serializeError } from "../utility/error-utils.js";

const STYLE = {
  FgYellow: "\x1b[33m",
  FgWhite: "\x1b[37m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgBlue: "\x1b[34m",
  FgCyan: "\x1b[36m",
  FgOrange: "\x1b[38;5;208m",
  Reset: "\x1b[0m",
};

export type LoggerSwitches = {
  debug: boolean;
  log: boolean;
  important: boolean;
  warning: boolean;
  error: boolean;
  color?: boolean; // Optional, defaults to true for TTY
};

const DEFAULT_SWITCHES: LoggerSwitches = {
  debug: false,
  log: true,
  important: true,
  warning: true,
  error: true,
};

type LogEntry = {
  timestamp: string;
  level: string;
  args: any[];
  style: string | null;
};

class Logger {
  private switches: LoggerSwitches;
  private buffering = false;
  private logBuffer: LogEntry[] = [];
  private logStreamCallback: ((level: string, message: string) => void) | null = null;

  constructor(switches: LoggerSwitches) {
    this.switches = {
      ...switches,
    };
  }

  /**
   * Register a callback to stream logs to (e.g., for TUI display)
   */
  public setLogStreamCallback(callback: ((level: string, message: string) => void) | null): void {
    this.logStreamCallback = callback;
  }

  /**
   * Set the verbosity of the logger
   */
  public setVerbosity(verbose: boolean) {
    if (verbose) {
      this.switches.debug = true;
      this.debug("Logger verbosity set to verbose");
    } else {
      this.switches.debug = false;
      this.debug("Logger verbosity set to non-verbose");
    }
  }

  /**
   * Enable log buffering mode
   */
  public enableBufferingIfTty() {
    if (!isTTY()) {
      return;
    }
    this.buffering = true;
    this.logBuffer = [];
  }

  /**
   * Flush all buffered logs to console
   */
  public flushBufferedLogs() {
    if (this.logBuffer.length === 0) {
      return;
    }

    console.log("\n");
    console.log("═".repeat(80));
    console.log("DETAILED LOGS:");
    console.log("═".repeat(80));

    for (const entry of this.logBuffer) {
      if (entry.style !== null) {
        console.log.apply(console, [entry.style, entry.timestamp, entry.level, ...entry.args]);
      } else {
        console.log.apply(console, [entry.timestamp, entry.level, ...entry.args]);
      }
    }

    console.log("═".repeat(80));
    console.log(`Total log entries: ${this.logBuffer.length}`);
    console.log("═".repeat(80));

    this.logBuffer = [];
  }

  /**
   * Get count of buffered logs
   */
  public getBufferedLogCount(): number {
    return this.logBuffer.length;
  }

  /**
   * Internal method to log or buffer based on mode
   */
  private logOrBuffer(level: string, style: string, args: any[]) {
    const timestamp = new Date().toISOString();
    const effectiveStyle = isTTY() ? style : null;

    // Format message for streaming
    const message = args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");

    // Stream to display service if callback is registered
    if (this.logStreamCallback && isTTY()) {
      this.logStreamCallback(level.trim(), message);
    }

    if (this.buffering && isTTY()) {
      this.logBuffer.push({ timestamp, level, args, style: effectiveStyle });
    } else {
      if (effectiveStyle !== null) {
        console.log.apply(console, [effectiveStyle, timestamp, level, ...args]);
      } else {
        console.log.apply(console, [timestamp, level, ...args]);
      }
    }
  }

  public debug(...args: any) {
    if (!this.switches.debug) return;
    this.logOrBuffer("DEBUG\t", STYLE.Reset, args);
  }

  public log(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("LOG\t", STYLE.FgWhite, args);
  }

  public logNegative(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("NEG\t", STYLE.FgRed, args);
  }

  public logPositive(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("POS\t", STYLE.FgGreen, args);
  }

  public important(...args: any) {
    if (!this.switches.important) return;
    this.logOrBuffer("IMP\t", STYLE.FgBlue, args);
  }

  public warn(errorObject: Error) {
    if (!this.switches.warning) return;
    const errorString = serializeError(errorObject);
    this.logOrBuffer("WARN\t", STYLE.FgOrange, [errorString]);
  }

  public error(errorObject: Error) {
    if (!this.switches.error) return;
    const errorString = serializeError(errorObject);
    this.logOrBuffer("ERROR\t", STYLE.FgRed, [errorString]);
  }
}

const logger = new Logger(DEFAULT_SWITCHES);

export { logger };

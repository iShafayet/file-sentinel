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
  urgent: boolean;
  color?: boolean; // Optional, defaults to true for TTY
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

  constructor(switches: LoggerSwitches) {
    this.switches = {
      ...switches,
      // Color defaults to true, will be checked at runtime
      color: switches.color !== undefined ? switches.color : true,
    };
  }

  init(verbose: boolean) {
    this.setVerbosity(verbose);
    this.debug("Logger initated");
  }

  setVerbosity(verbose: boolean) {
    if (verbose) {
      this.switches.debug = true;
    } else {
      this.switches.debug = false;
    }
  }

  /**
   * Enable log buffering mode
   */
  enableBuffering() {
    this.buffering = true;
    this.logBuffer = [];
  }

  /**
   * Disable log buffering and return buffered logs
   */
  disableBuffering(): LogEntry[] {
    this.buffering = false;
    return this.logBuffer;
  }

  /**
   * Flush all buffered logs to console
   */
  flushBufferedLogs() {
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
  getBufferedLogCount(): number {
    return this.logBuffer.length;
  }

  /**
   * Internal method to log or buffer based on mode
   */
  private logOrBuffer(level: string, style: string, args: any[]) {
    const timestamp = new Date().toISOString();
    // Check TTY status at runtime - disable colors if either stdin or stdout is not a TTY
    const isTTY = process.stdin.isTTY && process.stdout.isTTY;
    const shouldUseColor = this.switches.color && isTTY;
    const effectiveStyle = shouldUseColor ? style : null;

    if (this.buffering) {
      this.logBuffer.push({ timestamp, level, args, style: effectiveStyle });
    } else {
      if (effectiveStyle !== null) {
        console.log.apply(console, [effectiveStyle, timestamp, level, ...args]);
      } else {
        console.log.apply(console, [timestamp, level, ...args]);
      }
    }
  }

  debug(...args: any) {
    if (!this.switches.debug) return;
    // Debug logs should not be colored
    this.logOrBuffer("DEBUG\t", STYLE.Reset, args);
  }

  log(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("LOG\t", STYLE.FgWhite, args);
  }

  logNegative(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("NEG\t", STYLE.FgRed, args);
  }

  logPositive(...args: any) {
    if (!this.switches.log) return;
    this.logOrBuffer("POS\t", STYLE.FgGreen, args);
  }

  urgent(...args: any) {
    if (!this.switches.important) return;
    args.forEach((arg: any, index: number) => {
      args[index] = JSON.stringify(arg, null, 2);
    });
    this.logOrBuffer("URG\t", STYLE.FgCyan, args);
  }

  important(...args: any) {
    if (!this.switches.important) return;
    this.logOrBuffer("IMP\t", STYLE.FgBlue, args);
  }

  warn(errorObject: Error, optionalContext = null) {
    if (this.buffering) {
      let errorString = JSON.stringify(errorObject, Object.getOwnPropertyNames(errorObject));
      this.logOrBuffer("WARN\t", STYLE.FgOrange, [errorString, optionalContext]);
    } else {
      console.warn(errorObject);
      let errorString = JSON.stringify(errorObject, Object.getOwnPropertyNames(errorObject));
      const timestamp = new Date().toISOString();
      console.log.apply(console, [STYLE.FgOrange, timestamp, "WARN\t", errorString, optionalContext]);
    }
  }

  error(errorObject: Error, optionalContext = null) {
    if (this.buffering) {
      let errorString = JSON.stringify(errorObject, Object.getOwnPropertyNames(errorObject));
      this.logOrBuffer("ERROR\t", STYLE.FgRed, [errorString, optionalContext]);
    } else {
      console.error(errorObject);
    }
  }
}

const logger = new Logger({
  debug: false,
  log: true,
  important: true,
  warning: true,
  error: true,
  urgent: true,
});

export { logger };

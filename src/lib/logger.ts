const STYLE = {
  FgYellow: "\x1b[33m",
  FgWhite: "\x1b[37m",
  FgRed: "\x1b[31m",
  FgBlue: "\x1b[34m",
  FgOrange: "\x1b[38;5;208m",
};

export type LoggerSwitches = {
  debug: boolean;
  log: boolean;
  important: boolean;
  warning: boolean;
  error: boolean;
  urgent: boolean;
};
class Logger {
  private switches: LoggerSwitches;

  constructor(switches: LoggerSwitches) {
    this.switches = {
      ...switches,
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

  debug(...args: any) {
    if (!this.switches.debug) return;
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgYellow, timestamp, "DEBUG\t", ...args]);
  }

  log(...args: any) {
    if (!this.switches.log) return;
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgWhite, timestamp, "LOG\t", ...args]);
  }

  logNegative(...args: any) {
    if (!this.switches.log) return;
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgRed, timestamp, "NEG\t", ...args]);
  }

  logPositive(...args: any) {
    if (!this.switches.log) return;
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgBlue, timestamp, "POS\t", ...args]);
  }

  urgent(...args: any) {
    if (!this.switches.important) return;
    args.forEach((arg: any, index: number) => {
      args[index] = JSON.stringify(arg, null, 2);
    });
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgBlue, timestamp, "URG\t", ...args]);
  }

  important(...args: any) {
    if (!this.switches.important) return;
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgBlue, timestamp, "IMP\t", ...args]);
  }

  warn(errorObject: Error, optionalContext = null) {
    console.warn(errorObject);

    let errorString = JSON.stringify(
      errorObject,
      Object.getOwnPropertyNames(errorObject)
    );
    const timestamp = new Date().toISOString();
    console.log.apply(console, [STYLE.FgOrange, timestamp, "WARN\t", errorString, optionalContext]);
  }

  error(errorObject: Error, optionalContext = null) {
    console.error(errorObject);

    // let errorString = JSON.stringify(
    //   errorObject,
    //   Object.getOwnPropertyNames(errorObject)
    // );
    // console.log.apply(console, ["IMPORTANT\t", errorString, optionalContext]);
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

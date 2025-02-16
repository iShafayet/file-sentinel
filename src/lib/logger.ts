const STYLE = {
  FgYellow: "\x1b[33m"
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
    if (verbose) {
      this.switches.log = true;
      this.switches.debug = true;
    }
    this.log("Logger initated");
  }

  debug(...args: any) {
    if (!this.switches.debug) return;
    console.log.apply(console, [STYLE.FgYellow, "DEBUG\t", ...args]);
  }

  log(...args: any) {
    if (!this.switches.log) return;
    console.log.apply(console, ["LOG\t", ...args]);
  }

  logNegative(...args: any) {
    if (!this.switches.log) return;
    console.log.apply(console, ["NEG\t", ...args]);
  }

  urgent(...args: any) {
    if (!this.switches.important) return;
    args.forEach((arg: any, index: number) => {
      args[index] = JSON.stringify(arg, null, 2);
    });
    console.log.apply(console, ["URGENT\t", ...args]);
  }

  important(...args: any) {
    if (!this.switches.important) return;
    console.log.apply(console, ["IMPORTANT\t", ...args]);
  }

  warn(errorObject: Error, optionalContext = null) {
    console.warn(errorObject);

    let errorString = JSON.stringify(
      errorObject,
      Object.getOwnPropertyNames(errorObject)
    );
    console.log.apply(console, ["IMPORTANT\t", errorString, optionalContext]);
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

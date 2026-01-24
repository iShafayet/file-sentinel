class DirectLogger {
  constructor() {}

  public log(...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log.apply(console, [timestamp, "D_LOG", ...args]);
  }

  public error(...args: any[]) {
    const timestamp = new Date().toISOString();
    console.error.apply(console, [timestamp, "D_ERR", ...args]);
  }
}

export const directLogger = new DirectLogger();

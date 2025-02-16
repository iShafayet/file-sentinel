import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";

class ErrorService {

  private config: Config | null = null;

  setConfig(config: Config): void {
    this.config = config;
  }

  handleErrorDuringIteration(error: Error | unknown): void {
    if (!this.config) {
      throw new Error("Fatal error: Config is not set");
    }

    let actualError: Error;
    if (!(error instanceof Error)) {
      actualError = new Error(String(error));
    } else {
      actualError = error;
    }

    logger.error(actualError);

    if (this.config.panicOnError) {
      logger.logNegative("(error-service)> Panicking due to error");
      process.exit(1);
    }
  }
}

export const errorService = new ErrorService();


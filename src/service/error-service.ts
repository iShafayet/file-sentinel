import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { progressService } from "./progress-service.js";

class ErrorService {
  private config: Config | null = null;

  setConfig(config: Config): void {
    this.config = config;
  }

  handleError(error: Error | unknown): void {
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

  async terminateOnError(error: Error | unknown): Promise<void> {
    if (!this.config) {
      throw new Error("Fatal error: Config is not set");
      process.exit(2);
    }
    if (error instanceof Error) {
      logger.logNegative(`(error-service)> Terminating due to error: ${error.message}`);
    } else {
      logger.logNegative(`(error-service)> Terminating due to error: ${String(error)}`);
    }

    await progressService.stopDisplayAndShowLogs({ waitForKeyPress: false });
    process.exit(1);
  }
}

export const errorService = new ErrorService();

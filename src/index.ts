import { Config } from "./model/config.js";
import { logger } from "./lib/logger.js";

logger.init();

export class FileSentinelProgram {
  config!: Config;

  async start(config: Config) {
    try {
      this.config = config;
      await this._initialize();
    } catch (ex) {
      logger.log("Error was propagated to root level. Throwing again.");
      throw ex;
    }
  }

  async _initialize() {
    logger.log("(program)> Initializing server");
    logger.log("(program)> Initialization complete");
  }

  async terminate() {
    logger.log("(program)> Terminating server");
    logger.log("(program)> Termination complete");
  }
}

process.on("uncaughtException", function (err) {
  console.log("Suppressing uncaughtException");
  console.log("uncaughtException message:", JSON.stringify(err));
  console.log("uncaughtException stack:", err.stack);
  console.error(err);
});


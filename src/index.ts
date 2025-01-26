import { Config } from "./model/config.js";
import { logger } from "./lib/logger.js";
import { sanityService } from "./service/sanity-service.js";
import { coreService } from "./service/core-service.js";

logger.init();

export class FileSentinelProgram {
  config!: Config;

  async start(config: Config) {
    try {
      this.config = config;
      await this.initialize();
      await this.run();
    } catch (ex) {
      logger.log("Error was propagated to root level. Throwing again.");
      throw ex;
    }
  }

  private async initialize() {
    logger.log("(program)> Initializing file-sentinel");
    sanityService.verifyPathsInConfig(this.config);
    logger.log("(program)> Initialization complete");
  }

  private async run() {
    const operation = this.config.operation;
    logger.log(`(program)> Running file-sentinel. operation: "${operation}"`);
    coreService.handle(this.config);
    logger.log("(program)> Run complete");
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


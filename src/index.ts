import { Config } from "./model/config.js";
import { logger } from "./lib/logger.js";
import { sanityService } from "./service/sanity-service.js";
import { coreService } from "./service/core-service.js";
import { ExecutionResult } from "./model/execution-results.js";

export class FileSentinelProgram {
  config!: Config;

  public async execute(config: Config): Promise<ExecutionResult> {
    try {
      this.config = config;
      await this.initialize();
      return await this.run();
    } catch (ex) {
      logger.log("Error was propagated to root level. Throwing again.");
      throw ex;
    }
  }

  private async initialize() {
    logger.log("(program)> Initializing file-sentinel");
    sanityService.verifyPathsInConfig(this.config);
    logger.debug("(program)> Initialization complete");
  }

  private async run(): Promise<ExecutionResult> {
    const operation = this.config.operation;
    logger.log(`(program)> Executing operation: "${operation}"`);
    const result = await coreService.handle(this.config);
    logger.log("(program)> Operation complete");
    return result;
  }

  public async terminate() {
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


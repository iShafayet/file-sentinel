import { Config } from "./model/config.js";
import { logger } from "./lib/logger.js";
import { sanityService } from "./service/sanity-service.js";
import { coreService } from "./service/core-service.js";
import { displayService } from "./service/display-service.js";
import { ExecutionResult } from "./model/execution-results.js";
import { applyTtyAndVerbosityGlobally, getVersion } from "./utility/misc-utils.js";
import { DatabaseService } from "./service/database-service.js";

/**
 * Main program entry point
 */
export class FileSentinelProgram {
  config!: Config;

  /**
   * Executes the program with the given configuration
   */
  public async execute(config: Config): Promise<ExecutionResult> {
    try {
      this.config = config;

      applyTtyAndVerbosityGlobally(this.config);

      await this.initialize();
      return await this.run();
    } catch (ex) {
      logger.logNegative("(program)> Error was propagated to root level");
      logger.error(ex as Error);
      throw ex;
    }
  }

  /**
   * Initializes the program and validates configuration
   */
  private async initialize(): Promise<void> {
    logger.log(`(program)> Initializing file-sentinel v${getVersion()}`);

    try {
      sanityService.verifyPathsInConfig(this.config);
      logger.debug("(program)> Configuration validated successfully");
    } catch (error) {
      logger.logNegative("(program)> Configuration validation failed");
      throw error;
    }
  }

  /**
   * Runs the main operation
   */
  private async run(): Promise<ExecutionResult> {
    const command = this.config.command;
    logger.log(`(program)> Executing command: "${command}"`);

    const result = await coreService.handle(this.config);

    logger.log("(program)> Command execution complete");

    // After operation completes, wait for keypress to show logs
    await displayService.stopDisplayAndShowLogs({ waitForKeyPress: true });

    return result;
  }

  /**
   * Terminates the program gracefully
   */
  public async terminate(): Promise<void> {
    logger.log("(program)> Terminating program");
    logger.log("(program)> Termination complete");
  }
}

// Global error handlers
process.on("uncaughtException", function (err) {
  console.error("=".repeat(80));
  console.error("UNCAUGHT EXCEPTION");
  console.error("=".repeat(80));
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("=".repeat(80));
  logger.flushBufferedLogs();
  DatabaseService.closeAllConnections();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", function (reason, promise) {
  console.error("=".repeat(80));
  console.error("UNHANDLED PROMISE REJECTION");
  console.error("=".repeat(80));
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  console.error("=".repeat(80));
  logger.flushBufferedLogs();
  DatabaseService.closeAllConnections();
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  logger.log("(program)> SIGINT received");
  const bufferedCount = logger.getBufferedLogCount();
  if (bufferedCount > 0) {
    console.log("\n");
    console.log("Interrupted by user. Flushing buffered logs...");
    logger.flushBufferedLogs();
  }

  DatabaseService.closeAllConnections();
  process.exit(130); // Standard exit code for SIGINT
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.log("(program)> SIGTERM received");
  const bufferedCount = logger.getBufferedLogCount();
  if (bufferedCount > 0) {
    console.log("\n");
    console.log("Interrupted by user. Flushing buffered logs...");
    logger.flushBufferedLogs();
  }

  DatabaseService.closeAllConnections();
  process.exit(143); // Standard exit code for SIGTERM
});

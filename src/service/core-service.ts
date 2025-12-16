import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { ExecutionResult } from "../model/execution-results.js";
import { digestService } from "./digest-service.js";
import { verifyService } from "./verify-service.js";
import { replicateService } from "./replicate-service.js";
import { healService } from "./heal-service.js";
import { errorService } from "./error-service.js";

/**
 * Core service that routes commands to appropriate service handlers
 */
class CoreService {
  /**
   * Handles the execution of a command based on the config
   */
  async handle(config: Config): Promise<ExecutionResult> {
    errorService.setConfig(config);

    logger.debug(`(core-service)> Handling command: ${config.command}`);

    switch (config.command) {
      case "digest":
        return await digestService.execute(config);

      case "verify":
        return await verifyService.execute(config);

      case "replicate":
        return await replicateService.execute(config);

      case "heal":
        return await healService.execute(config);

      default:
        // TypeScript should prevent this, but include for safety
        throw new Error(`Unknown command: ${(config as any).command}`);
    }
  }
}

export const coreService = new CoreService();

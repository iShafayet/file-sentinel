import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { taggingService } from "./tagging-service.js";
import { integrityService } from "./integrity-service.js";
import { recoveryService } from "./recovery-service.js";
import { errorService } from "./error-service.js";
import { ExecutionResult, makeExecutionResult } from "../model/execution-results.js";

class CoreService {
  async handle(config: Config): Promise<ExecutionResult> {
    errorService.setConfig(config);

    const executionResult = makeExecutionResult(config.operation);
    if (config.operation === "untag") {
      await taggingService.untag(config, executionResult);
    } else if (config.operation === "tag-new-only") {
      await taggingService.tagNewOnly(config, executionResult);
    } else if (config.operation === "tag-new-and-update-existing") {
      await taggingService.tagNewAndUpdateExisting(config, executionResult);
    } else if (config.operation === "prune") {
      await integrityService.prune(config, executionResult);
    } else if (config.operation === "verify-integrity") {
      const listMap = await integrityService.verifyIntegrity(config, executionResult);
    } else if (config.operation === "verify-and-recover") {
      await recoveryService.checkIntegrityAndRecover(config, executionResult);
    } else {
      throw new Error(`Invalid operation: ${config.operation}`);
    }

    return executionResult;
  }
}

export const coreService = new CoreService();

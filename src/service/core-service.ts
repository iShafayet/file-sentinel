import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { taggingService } from "./tagging-service.js";
import { integrityService } from "./integrity-service.js";
import { recoveryService } from "./recovery-service.js";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";

class CoreService {
  async handle(config: Config): Promise<ExecutionResult> {
    errorService.setConfig(config);

    if (config.operation === "untag") {
      return await taggingService.untag(config);
    } else if (config.operation === "tag-new-only") {
      return await taggingService.tagNewOnly(config);
    } else if (config.operation === "tag-new-and-update-existing") {
      return await taggingService.tagNewAndUpdateExisting(config);
    } else if (config.operation === "prune") {
      return await integrityService.prune(config);
    } else if (config.operation === "verify-integrity") {
      const [listMap, executionResult] = await integrityService.verifyIntegrity(config);
      return executionResult;
    } else if (config.operation === "verify-and-recover") {
      return await recoveryService.checkIntegrityAndRecover(config);
    }

    throw new Error(`Invalid operation: ${config.operation}`);
  }
}

export const coreService = new CoreService();

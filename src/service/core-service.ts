import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { taggingService } from "./tagging-service.js";
import { integrityService } from "./integrity-service.js";
import { recoveryService } from "./recovery-service.js";
import { errorService } from "./error-service.js";

class CoreService {
  async handle(config: Config): Promise<void> {
    errorService.setConfig(config);

    if (config.operation === "untag") {
      await taggingService.untag(config);
    } else if (config.operation === "tag-new-only") {
      await taggingService.tagNewOnly(config);
    } else if (config.operation === "tag-new-and-update") {
      await taggingService.tagNewAndUpdateExisting(config);
    } else if (config.operation === "prune") {
      await integrityService.prune(config);
    } else if (config.operation === "verify-integrity") {
      await integrityService.verifyIntegrity(config);
    } else if (config.operation === "verify-and-recover") {
      await recoveryService.checkIntegrityAndRecover(config);
    }
  }
}

export const coreService = new CoreService();

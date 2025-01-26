import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { taggingService } from "./tagging-service.js";
import { integrityService } from "./integrity-service.js";
import { recoveryService } from "./recovery-service.js";
class CoreService {

  async handle(config: Config): Promise<void> {
    if (config.operation === "untag") {
      await taggingService.untag(config);
    } else if (config.operation === "tag-new-only") {
      await taggingService.tagNewOnly(config);
    } else if (config.operation === "tag-new-and-update") {
      await taggingService.tagNewAndUpdateExisting(config);
    } else if (config.operation === "verify-integrity") {
      await integrityService.verifyIntegrity(config);
    } else if (config.operation === "verify-and-recover") {
      await recoveryService.checkIntegrityAndRecover(config);
    }
  }

  private tagNewAndUpdate(config: Config): void {
    logger.log("(core-service)> Tagging new files and updating existing files");
  }

  private verifyIntegrity(config: Config): void {
    logger.log("(core-service)> Verifying integrity");
  }

  private verifyAndRecover(config: Config): void {
    logger.log("(core-service)> Verifying and recovering");
  }
}

export const coreService = new CoreService();

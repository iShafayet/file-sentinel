import { Config } from "../model/config.js";
import { fileService } from "./file-service.js";

class SanityService {

  verifyPathsInConfig(config: Config): void {
    if (!config) {
      throw new Error(`Config is null`);
    }

    if (config.target.dir && !fileService.verifyDirectoryExists(config.target.dir)) {
      throw new Error(`Target directory "${config.target.dir}" does not exist`);
    }

    if (config.target.metaDataDir && !fileService.verifyDirectoryExists(config.target.metaDataDir)) {
      throw new Error(`Target metadata directory "${config.target.metaDataDir}" does not exist`);
    }

    if (config.recovery && config.recovery.mirrorDir && !fileService.verifyDirectoryExists(config.recovery.mirrorDir)) {
      throw new Error(`Mirror directory "${config.recovery.mirrorDir}" does not exist`);
    }

    if (config.recovery && config.recovery.mirrorMetaDataDir && !fileService.verifyDirectoryExists(config.recovery.mirrorMetaDataDir)) {
      throw new Error(`Mirror metadata directory "${config.recovery.mirrorMetaDataDir}" does not exist`);
    }

  }
}

export const sanityService = new SanityService();
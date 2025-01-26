import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import constants from "../constant/common-constants.js";
import { getMetaFilePath } from "../utility/meta-data-utils.js";

class DiscoveryService {
  public populateFilesToTag(dir: string, rootDir: string, metaDataRootDir: string, untaggedFileList: string[], previouslyTaggedFileList: string[]): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      const childPath = path.join(dir, child);
      const childStat = fs.statSync(childPath);
      if (childStat.isDirectory()) {
        this.populateFilesToTag(childPath, rootDir, metaDataRootDir, untaggedFileList, previouslyTaggedFileList);
        continue;
      }
      if (child.startsWith(constants.META_FILE_PREFIX)) {
        continue;
      }
      if (childStat.isFile()) {
        const metaDataPath = getMetaFilePath(childPath, rootDir, metaDataRootDir);
        if (!fs.existsSync(metaDataPath)) {
          logger.log(`(tagging-service)> File ${childPath} is new`);
          untaggedFileList.push(childPath);
        } else {
          logger.log(`(tagging-service)> File ${childPath} has existing meta data`);
          previouslyTaggedFileList.push(childPath);
        }
      }
    }
  }
}

export const discoveryService = new DiscoveryService();

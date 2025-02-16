import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import constants from "../constant/common-constants.js";
import { getMetaFilePath } from "../utility/meta-data-utils.js";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";

class DiscoveryService {
  public populateFilesToTag(dir: string, rootDir: string, metaDataRootDir: string, untaggedFileList: string[], previouslyTaggedFileList: string[], executionResult: ExecutionResult): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      try {
        const childPath = path.join(dir, child);
        const childStat = fs.statSync(childPath);
        if (childStat.isDirectory()) {
          this.populateFilesToTag(childPath, rootDir, metaDataRootDir, untaggedFileList, previouslyTaggedFileList, executionResult);
          continue;
        }
        if (child.startsWith(constants.META_FILE_PREFIX)) {
          continue;
        }
        if (childStat.isFile()) {
          const metaDataPath = getMetaFilePath(childPath, rootDir, metaDataRootDir);
          if (!fs.existsSync(metaDataPath)) {
            logger.debug(`(tagging-service)> File ${childPath} is new`);
            untaggedFileList.push(childPath);
          } else {
            logger.debug(`(tagging-service)> File ${childPath} has existing meta data`);
            previouslyTaggedFileList.push(childPath);
          }
        }
      } catch (error) {
        logger.logNegative(`(discovery-service)> Error while populating files to tag: ${child}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }
  }

  public populateMetadataFiles(dir: string, rootDir: string, metaDataRootDir: string, metadataFileList: string[]): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      try {
        const childPath = path.join(dir, child);
        const childStat = fs.statSync(childPath);
        if (childStat.isDirectory()) {
          this.populateMetadataFiles(childPath, rootDir, metaDataRootDir, metadataFileList);
          continue;
        }
        if (child.startsWith(constants.META_FILE_PREFIX)) {
          metadataFileList.push(childPath);
        }
      } catch (error) {
        logger.logNegative(`(discovery-service)> Error while populating metadata files: ${child}`);
        errorService.handleErrorDuringIteration(error);
      }
    }
  }
}

export const discoveryService = new DiscoveryService();

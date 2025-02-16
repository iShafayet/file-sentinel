import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { Config, VerificationMode } from "../model/config.js";
import constants from "../constant/common-constants.js";
import { FileMetaData, fileMetaDataSchema } from "../model/file-meta-data.js";
import { cryptoService } from "./crypto-service.js";
import { getMetaFilePath } from "../utility/meta-data-utils.js";
import { discoveryService } from "./discovery-service.js";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";
class TaggingService {

  private async tagFile(filePath: string, rootDir: string, metaDataRootDir: string): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.debug(`(tagging-service)> Tagging file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);
    const fileStat = fs.statSync(filePath);
    const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
    const metaData: FileMetaData = {
      file: {
        name: relativeFilePath,
        size: fileStat.size,
        createdAt: fileStat.birthtime.getTime(),
        modifiedAt: fileStat.mtime.getTime()
      },
      hash: {
        sha256: hash
      },
      verification: {
        lastVerifiedAt: Date.now(),
        lastVerifiedBy: constants.CLIENT_IDENTFIER
      },
      metaData: {
        approximateModifiedAt: Date.now()
      }
    };
    const metaDataString = JSON.stringify(metaData, null, 2);
    const metaDataDir = path.dirname(metaDataPath);
    fs.mkdirSync(metaDataDir, { recursive: true });
    fs.writeFileSync(metaDataPath, metaDataString);
  }

  private async updateFileTagIfNeeded(filePath: string, rootDir: string, metaDataRootDir: string, verificationMode: VerificationMode): Promise<boolean> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.debug(`(tagging-service)> Potentially updating file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.debug(`(tagging-service)> File ${relativeFilePath} has invalid meta data. It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir);
      return true;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir);
      return true;
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir);
        return true;
      } else {
        logger.debug(`(tagging-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        return false;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
      if (existingMeta.hash.sha256 !== hash) {
        logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir);
        return true;
      } else {
        logger.debug(`(tagging-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        return false;
      }
    }

    throw new Error("Code should not reach here");
  }

  public async tagNewAndUpdateExisting(config: Config): Promise<ExecutionResult> {
    logger.log("(tagging-service)> Tagging new files and updating existing files");

    const executionResult: ExecutionResult = {
      operation: "tag-new-and-update-existing",
      success: true,
      errorCount: 0,
      tagAddedCount: 0,
      tagUpdatedCount: 0,
    };

    const fileToTagList: string[] = [];
    const fileToPotentialUpdateList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, fileToPotentialUpdateList, executionResult);

    for (const filePath of fileToTagList) {
      try {
        await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir);
        executionResult.tagAddedCount!++;
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while tagging file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    for (const filePath of fileToPotentialUpdateList) {
      try {
        const wasUpdated = await this.updateFileTagIfNeeded(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.verification.mode);
        if (wasUpdated) {
          executionResult.tagUpdatedCount!++;
        }
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while updating file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    logger.log(`(tagging-service)> Tagged ${executionResult.tagAddedCount} files and updated ${executionResult.tagUpdatedCount} files`);
    return executionResult;
  }

  public async tagNewOnly(config: Config): Promise<ExecutionResult> {
    logger.log("(core-service)> Tagging new files");

    const executionResult: ExecutionResult = {
      operation: "tag-new-only",
      success: true,
      errorCount: 0,
      tagAddedCount: 0,
    };

    const fileToTagList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, [], executionResult);

    for (const filePath of fileToTagList) {
      try {
        await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir);
        logger.debug(`(tagging-service)> Tagged file: ${filePath}`, executionResult.tagAddedCount);
        executionResult.tagAddedCount!++;
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while tagging file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    logger.log(`(tagging-service)> Tagged ${fileToTagList.length} files`);
    return executionResult;
  }

  private untagFiles(dir: string, executionResult: ExecutionResult): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      try {
        const childPath = path.join(dir, child);
        const childStat = fs.statSync(childPath);
        if (childStat.isDirectory()) {
          this.untagFiles(childPath, executionResult);
          continue;
        }
        if (childStat.isFile() && child.startsWith(constants.META_FILE_PREFIX)) {
          logger.debug(`(tagging-service)> Untagging file: ${childPath}`);
          fs.unlinkSync(childPath);
          executionResult.tagRemovedCount!++;
        }
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while untagging file: ${child}`);
        errorService.handleErrorDuringIteration(error);
      }
    }
  }

  public async untag(config: Config): Promise<ExecutionResult> {
    logger.log("(tagging-service)> Untagging files");

    const executionResult: ExecutionResult = {
      operation: "untag",
      success: true,
      errorCount: 0,
      tagRemovedCount: 0,
    };

    this.untagFiles(config.target.metaDataDir || config.target.dir, executionResult);

    logger.log(`(tagging-service)> Untagged ${executionResult.tagRemovedCount} files`);

    return executionResult;
  }

}

export const taggingService = new TaggingService();
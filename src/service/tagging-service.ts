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
import { uxService } from "./ux-service.js";

class TaggingService {

  private async tagFile(filePath: string, rootDir: string, metaDataRootDir: string, executionResult: ExecutionResult): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.debug(`(tagging-service)> Tagging file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);
    const fileStat = fs.statSync(filePath);
    const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size, (bytesRead: number) => {
      const progressString = `${Math.floor(bytesRead / 1_000_000) / 1000}GB/${Math.floor(fileStat.size / 1_000_000) / 1000}GB`;
      const percentage = Math.floor((bytesRead / fileStat.size) * 10000) / 100;
      logger.log(`(tagging-service)> Processing ${relativeFilePath}. Progress: ${progressString} (${percentage}%)`);
      uxService.logProgress(executionResult);
    });
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

  private async updateFileTagIfNeeded(filePath: string, rootDir: string, metaDataRootDir: string, verificationMode: VerificationMode, executionResult: ExecutionResult): Promise<boolean> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.debug(`(tagging-service)> Potentially updating file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.debug(`(tagging-service)> File ${relativeFilePath} has invalid meta data. It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir, executionResult);
      return true;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir, executionResult);
      return true;
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir, executionResult);
        return true;
      } else {
        logger.debug(`(tagging-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        return false;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size, (bytesRead: number) => {
        const progressString = `${Math.floor(bytesRead / 1_000_000) / 1000}GB/${Math.floor(fileStat.size / 1_000_000) / 1000}GB`;
        const percentage = Math.floor((bytesRead / fileStat.size) * 10000) / 100;
        logger.log(`(tagging-service)> Processing ${relativeFilePath}. Progress: ${progressString} (${percentage}%)`);
        uxService.logProgress(executionResult);
      });
      if (existingMeta.hash.sha256 !== hash) {
        logger.debug(`(tagging-service)> File ${relativeFilePath} has been modified (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir, executionResult);
        return true;
      } else {
        logger.debug(`(tagging-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        return false;
      }
    }

    throw new Error("Code should not reach here");
  }

  public async tagNewAndUpdateExisting(config: Config, executionResult: ExecutionResult): Promise<void> {
    logger.log("(tagging-service)> Tagging new files and updating existing files");

    logger.debug(`(tagging-service)> Populating files to tag`);
    const fileToTagList: string[] = [];
    const fileToPotentialUpdateList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, fileToPotentialUpdateList, executionResult);
    logger.debug(`(tagging-service)> Found ${fileToTagList.length} files to tag and ${fileToPotentialUpdateList.length} files with existing tag`);
    executionResult.totalCount = fileToTagList.length;

    logger.debug(`(tagging-service)> Tagging files`);
    for (const filePath of fileToTagList) {
      try {
        await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, executionResult);
        logger.debug(`(tagging-service)> Tagged file: ${filePath}`);
        executionResult.tagAddedCount!++;
        uxService.logProgress(executionResult);
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while tagging file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }
    logger.debug(`(tagging-service)> Tagged ${executionResult.tagAddedCount} files`);

    logger.debug(`(tagging-service)> Updating files with existing tag`);
    for (const filePath of fileToPotentialUpdateList) {
      try {
        const wasUpdated = await this.updateFileTagIfNeeded(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.verification.mode, executionResult);
        if (wasUpdated) {
          logger.debug(`(tagging-service)> Updated file: ${filePath}`);
          executionResult.tagUpdatedCount!++;
        } else {
          logger.debug(`(tagging-service)> File ${filePath} is unchanged (tag check passed)`);
          executionResult.tagSkippedCount!++;
        }
        uxService.logProgress(executionResult);
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while updating file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    logger.log(`(tagging-service)> Tagged ${executionResult.tagAddedCount} files and updated ${executionResult.tagUpdatedCount} files`);
  }

  public async tagNewOnly(config: Config, executionResult: ExecutionResult): Promise<void> {
    logger.log("(core-service)> Tagging new files");

    logger.debug(`(tagging-service)> Populating files to tag`);
    const fileToTagList: string[] = [];
    const filesWithExistingTagList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, filesWithExistingTagList, executionResult);
    logger.debug(`(tagging-service)> Found ${fileToTagList.length} files to tag and ${filesWithExistingTagList.length} files with existing tag`);
    executionResult.totalCount = fileToTagList.length;

    logger.debug(`(tagging-service)> Tagging files`);
    for (const filePath of fileToTagList) {
      try {
        await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, executionResult);
        logger.debug(`(tagging-service)> Tagged file: ${filePath}`, executionResult.tagAddedCount);
        executionResult.tagAddedCount!++;
        uxService.logProgress(executionResult);
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while tagging file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    uxService.logProgress(executionResult);

    logger.log(`(tagging-service)> Tagged ${fileToTagList.length} files`);
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
          uxService.logProgress(executionResult);
        }
      } catch (error) {
        logger.logNegative(`(tagging-service)> Error while untagging file: ${child}`);
        errorService.handleErrorDuringIteration(error);
      }
    }
  }

  public async untag(config: Config, executionResult: ExecutionResult): Promise<void> {
    logger.log("(tagging-service)> Untagging files");

    executionResult.operation = "untag";

    this.untagFiles(config.target.metaDataDir || config.target.dir, executionResult);

    logger.log(`(tagging-service)> Untagged ${executionResult.tagRemovedCount} files`);
  }

}

export const taggingService = new TaggingService();
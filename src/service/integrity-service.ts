import { Config, VerificationMode } from "../model/config.js";
import { logger } from "../lib/logger.js";
import { discoveryService } from "./discovery-service.js";
import { fileMetaDataSchema } from "../model/file-meta-data.js";
import { getDataFilePath, getMetaFilePath } from "../utility/meta-data-utils.js";
import { FileMetaData } from "../model/file-meta-data.js";
import fs from "fs";
import { cryptoService } from "./crypto-service.js";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";
import { uxService } from "./ux-service.js";
export interface ListMap {
  skipped: string[];
  passed: string[];
  failed: string[];
  error: string[];
}

class IntegrityService {

  private async verifyFile(filePath: string, rootDir: string, metaDataRootDir: string, skipTransparentlyModified: boolean, verificationMode: VerificationMode, listMap: ListMap, executionResult: ExecutionResult): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.debug(`(integrity-service)> Verifying file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.logNegative(`(integrity-service)> ERROR: File ${relativeFilePath} has invalid meta data. Verification failed with error.`);
      listMap.error.push(relativeFilePath);
      executionResult.errorCount!++;
      return;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      if (skipTransparentlyModified) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be skipped.`);
        listMap.skipped.push(relativeFilePath);
        executionResult.verificationSkippedCount!++;
        return;
      } else {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be verified.`);
        listMap.failed.push(relativeFilePath);
        executionResult.verificationFailedCount!++;
        return;
      }
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been corrupted (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}) (changed without updating modifiedAt). Failed verification.`);
        listMap.failed.push(relativeFilePath);
        executionResult.verificationFailedCount!++;
        return;
      } else {
        logger.debug(`(integrity-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        listMap.passed.push(relativeFilePath);
        executionResult.verificationPassedCount!++;
        return;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size, (bytesRead: number) => {
        const progressString = `${Math.floor(bytesRead / 1_000_000) / 1000}GB/${Math.floor(fileStat.size / 1_000_000) / 1000}GB`;
        const percentage = Math.floor((bytesRead / fileStat.size) * 10000) / 100;
        logger.log(`(integrity-service)> Processing ${relativeFilePath}. Progress: ${progressString} (${percentage}%)`);
        uxService.logProgress(executionResult);
      });
      if (existingMeta.hash.sha256 !== hash) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been corrupted (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}) (changed without updating modifiedAt). Failed verification.`);
        listMap.failed.push(relativeFilePath);
        executionResult.verificationFailedCount!++;
        return;
      } else {
        logger.debug(`(integrity-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        listMap.passed.push(relativeFilePath);
        executionResult.verificationPassedCount!++;
        return;
      }
    }

    throw new Error("Code should not reach here");
  }

  public async verifyIntegrity(config: Config, executionResult: ExecutionResult): Promise<ListMap> {
    logger.log("(integrity-service)> Verifying integrity");

    const listMap: ListMap = {
      passed: [],
      failed: [],
      error: [],
      skipped: [],
    };

    logger.debug(`(integrity-service)> Populating files to verify`);
    const untaggedFileList: string[] = [];
    const previouslyTaggedFileList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, untaggedFileList, previouslyTaggedFileList, executionResult);
    logger.debug(`(integrity-service)> Found ${untaggedFileList.length} untagged files and ${previouslyTaggedFileList.length} previously tagged files`);
    executionResult.totalCount = previouslyTaggedFileList.length;

    if (untaggedFileList.length > 0) {
      logger.debug(`(integrity-service)> Found ${untaggedFileList.length} untagged files. These will not be able to be verified. It is recommended to tag those.`);
    }

    if (previouslyTaggedFileList.length > 0) {
      logger.debug(`(integrity-service)> Found ${previouslyTaggedFileList.length} previously tagged files. These will be verified.`);
    } else {
      logger.debug(`(integrity-service)> No previously tagged files found. Nothing to verify.`);
      return listMap;
    }

    for (const filePath of previouslyTaggedFileList) {
      try {
        await this.verifyFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.integrity.skipTransparentlyModified, config.verification.mode, listMap, executionResult);
      } catch (error) {
        logger.logNegative(`(integrity-service)> Error while verifying file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
      uxService.logProgress(executionResult);
    }

    logger.log(
      "(integrity-service)> Verification complete.\n" +
      `    • ${listMap.skipped.length} files skipped\n` +
      `    • ${listMap.passed.length} files passed\n` +
      `    • ${listMap.failed.length} files failed\n` +
      `    • ${listMap.error.length} files generated errors`
    );

    executionResult.verificationPassedCount = listMap.passed.length;
    executionResult.verificationFailedCount = listMap.failed.length;
    executionResult.verificationSkippedCount = listMap.skipped.length;
    executionResult.errorCount += listMap.error.length;

    return listMap;
  }

  public async prune(config: Config, executionResult: ExecutionResult): Promise<void> {
    logger.log("(integrity-service)> Pruning");

    logger.debug(`(integrity-service)> Populating metadata files`);
    const metadataFileList: string[] = [];
    discoveryService.populateMetadataFiles(config.target.metaDataDir || config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, metadataFileList);
    logger.debug(`(integrity-service)> Found ${metadataFileList.length} metadata files. Now checking if they are valid.`);
    executionResult.totalCount = metadataFileList.length;

    for (const metaDataFilePath of metadataFileList) {
      try {
        const dataFilePath = getDataFilePath(metaDataFilePath, config.target.dir, config.target.metaDataDir || config.target.dir);
        if (!fs.existsSync(dataFilePath)) {
          logger.debug(`(integrity-service)> File ${dataFilePath} does not exist. Removing meta data file ${metaDataFilePath}`);
          fs.unlinkSync(metaDataFilePath);
          executionResult.prunedTagCount++;
        }
      } catch (error) {
        logger.logNegative(`(integrity-service)> Error while pruning meta data file: ${metaDataFilePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount++;
      }
      uxService.logProgress(executionResult);
    }

    logger.log(`(integrity-service)> Pruned ${executionResult.prunedTagCount} meta data files`);
  }
}

export const integrityService = new IntegrityService();
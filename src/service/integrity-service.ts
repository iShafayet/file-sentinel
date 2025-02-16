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

export interface ListMap {
  skipped: string[];
  passed: string[];
  failed: string[];
  error: string[];
}

class IntegrityService {

  private async verifyFile(filePath: string, rootDir: string, metaDataRootDir: string, verificationMode: VerificationMode, listMap: ListMap): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.log(`(tagging-service)> Potentially updating file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.log(`(integrity-service)> ERROR: File ${relativeFilePath} has invalid meta data. Verification failed.`);
      listMap.error.push(relativeFilePath);
      return;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be skipped.`);
      listMap.skipped.push(relativeFilePath);
      return;
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been corrupted (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}) (changed without updating modifiedAt). Failed verification.`);
        listMap.failed.push(relativeFilePath);
        return;
      } else {
        logger.log(`(integrity-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        listMap.passed.push(relativeFilePath);
        return;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
      if (existingMeta.hash.sha256 !== hash) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been corrupted (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}) (changed without updating modifiedAt). Failed verification.`);
        listMap.failed.push(relativeFilePath);
        return;
      } else {
        logger.log(`(integrity-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        listMap.passed.push(relativeFilePath);
        return;
      }
    }

    throw new Error("Code should not reach here");
  }

  public async verifyIntegrity(config: Config): Promise<[ListMap, ExecutionResult]> {
    logger.log("(integrity-service)> Verifying integrity");

    const executionResult: ExecutionResult = {
      operation: "verify-integrity",
      success: true,
      errorCount: 0,
      tagAddedCount: 0,
      tagUpdatedCount: 0,
    };

    const listMap: ListMap = {
      passed: [],
      failed: [],
      error: [],
      skipped: [],
    };

    const untaggedFileList: string[] = [];
    const previouslyTaggedFileList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, untaggedFileList, previouslyTaggedFileList, executionResult);

    if (untaggedFileList.length > 0) {
      logger.log(`(integrity-service)> Found ${untaggedFileList.length} untagged files. These will not be able to be verified. It is recommended to tag those.`);
    }

    if (previouslyTaggedFileList.length > 0) {
      logger.log(`(integrity-service)> Found ${previouslyTaggedFileList.length} previously tagged files. These will be verified.`);
    } else {
      logger.log(`(integrity-service)> No previously tagged files found. Nothing to verify.`);
      return [listMap, executionResult];
    }

    for (const filePath of previouslyTaggedFileList) {
      try {
        await this.verifyFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.verification.mode, listMap);
      } catch (error) {
        logger.log(`(integrity-service)> Error while verifying file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
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

    return [listMap, executionResult];
  }

  public async prune(config: Config): Promise<ExecutionResult> {
    logger.log("(integrity-service)> Pruning");

    const executionResult: ExecutionResult = {
      operation: "prune",
      success: true,
      errorCount: 0,
      prunedCount: 0,
    };

    const metadataFileList: string[] = [];
    discoveryService.populateMetadataFiles(config.target.metaDataDir || config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, metadataFileList);

    for (const metaDataFilePath of metadataFileList) {
      try {
        const dataFilePath = getDataFilePath(metaDataFilePath, config.target.dir, config.target.metaDataDir || config.target.dir);
        if (!fs.existsSync(dataFilePath)) {
          logger.log(`(integrity-service)> File ${dataFilePath} does not exist. Removing meta data file ${metaDataFilePath}`);
          fs.unlinkSync(metaDataFilePath);
          executionResult.prunedCount!++;
        }
      } catch (error) {
        logger.log(`(integrity-service)> Error while pruning meta data file: ${metaDataFilePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    logger.log(`(integrity-service)> Pruned ${executionResult.prunedCount} meta data files`);
    return executionResult;
  }
}

export const integrityService = new IntegrityService();
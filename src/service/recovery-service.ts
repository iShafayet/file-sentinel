import path from "path";
import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import { FileMetaData, fileMetaDataSchema } from "../model/file-meta-data.js";
import { getMetaFilePath, getRecoveryFilePath } from "../utility/meta-data-utils.js";
import { integrityService } from "./integrity-service.js";
import fs from "fs";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";
import { fileService } from "./file-service.js";
import constants from "../constant/common-constants.js";

class RecoveryService {

  private async recoverFile(filePath: string, config: Config): Promise<boolean> {
    logger.log(`(recovery-service)> Attempting to recover file: ${filePath}`);

    // We need to at least be able to check local meta data
    const localMetaFilePath = getMetaFilePath(filePath, config.target.dir, config.target.metaDataDir || config.target.dir);
    const localMetaData: FileMetaData = JSON.parse(fs.readFileSync(localMetaFilePath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(localMetaData);
    if (error) {
      logger.logNegative(`(recovery-service)> Local meta data file has invalid meta data: ${localMetaFilePath}`);
      return false;
    }

    const recoveryFilePath = getRecoveryFilePath(filePath, config.target.dir, config.recovery!.mirrorDir);
    const recoveryMetaFilePath = getMetaFilePath(recoveryFilePath, config.recovery!.mirrorDir, config.recovery!.mirrorMetaDataDir || config.recovery!.mirrorDir);

    if (!fs.existsSync(recoveryFilePath)) {
      logger.logNegative(`(recovery-service)> Recovery file does not exist: ${recoveryFilePath}`);
      return false;
    }

    if (!fs.existsSync(recoveryMetaFilePath)) {
      logger.logNegative(`(recovery-service)> Recovery meta data file does not exist: ${recoveryMetaFilePath}`);
      return false;
    }

    // Get mirror meta data
    const recoveryMetaData: FileMetaData = JSON.parse(fs.readFileSync(recoveryMetaFilePath, "utf-8"));
    const { error: recoveryError } = fileMetaDataSchema.validate(recoveryMetaData);
    if (recoveryError) {
      logger.logNegative(`(recovery-service)> Recovery meta data file has invalid meta data: ${recoveryMetaFilePath}`);
      return false;
    }

    if (recoveryMetaData.hash.sha256 !== localMetaData.hash.sha256) {
      if (config.recovery!.mirrorModificationTakesPrecedence) {
        logger.log(`(recovery-service)> Meta data hash on mirror does not match local meta data hash. Mirror modification takes precedence. Proceeding with recovery.`);
      } else {
        logger.log(`(recovery-service)> Meta data hash on mirror does not match local meta data hash. Since mirror modification does not take precedence, skipping recovery.`);
        return false;
      }
    }

    const fullFilePath = path.join(config.target.dir, filePath);
    const fullRecoveryFilePath = recoveryFilePath;

    // Remove local file
    fs.unlinkSync(fullFilePath);

    // Copy recovery file to local file
    const stat = fs.statSync(fullRecoveryFilePath);
    if (stat.size > constants.SYNC_HASHFILE_SIZE_THRESHOLD_BYTES) {
      await fileService.copyLargeFile(fullRecoveryFilePath, fullFilePath, (bytesRead: number) => {
        logger.log(`(recovery-service)> Recovering ${filePath}. Progress: ${Math.floor(bytesRead / 1_000_000)}MB/${Math.floor(stat.size / 1_000_000)}MB`);
      });
    } else {
      fs.copyFileSync(fullRecoveryFilePath, fullFilePath);
    }
    fs.utimesSync(fullFilePath, new Date(recoveryMetaData.file.modifiedAt), new Date(recoveryMetaData.file.modifiedAt));

    // Update local meta data
    fs.writeFileSync(localMetaFilePath, JSON.stringify(recoveryMetaData, null, 2));

    logger.log(`(recovery-service)> Successfully recovered file: ${filePath}`);

    return true;
  }

  public async checkIntegrityAndRecover(config: Config): Promise<ExecutionResult> {
    if (!config.recovery) {
      logger.log("(recovery-service)> No recovery configuration found. Skipping recovery.");
      return {
        operation: "verify-and-recover",
        success: true,
        errorCount: 0,
        recoveredCount: 0,
      };
    }

    logger.log("(recovery-service)> Checking integrity before recovering.");
    const [listMap, executionResult] = await integrityService.verifyIntegrity(config);
    executionResult.operation = "verify-and-recover";
    executionResult.recoveredCount = 0;

    if (listMap.failed.length === 0) {
      logger.log("(recovery-service)> No files to recover.");
      return executionResult;
    }

    logger.log(`(recovery-service)> ${listMap.failed.length} files to recover.`);

    for (const filePath of listMap.failed) {
      try {
        const wasRecovered = await this.recoverFile(filePath, config);
        if (wasRecovered) {
          executionResult.recoveredCount!++;
        }
      } catch (error) {
        logger.logNegative(`(recovery-service)> Error while recovering file: ${filePath}`);
        errorService.handleErrorDuringIteration(error);
        executionResult.errorCount!++;
      }
    }

    logger.log(`(recovery-service)> ${executionResult.recoveredCount}/${listMap.failed.length} files recovered.`);
    return executionResult;
  }

}

export const recoveryService = new RecoveryService();
import { logger } from "../lib/logger.js";
import { VerifyConfig } from "../model/config.js";
import { ExecutionResult } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { progressService } from "./progress-service.js";
import { errorService } from "./error-service.js";
import { isInSubdirectory } from "../utility/path-utils.js";
import { getFileSystemErrorMessage } from "../utility/error-utils.js";
import { isFileWritable } from "../utility/file-utils.js";
import { shouldSkipFileByRecency } from "../utility/misc-utils.js";
import constants from "../constant/common-constants.js";
import path from "path";
import fs from "fs";

/**
 * Service for verifying directory against digest
 */
class VerifyService {
  /**
   * Executes the verify command
   */
  async execute(config: VerifyConfig): Promise<ExecutionResult> {
    // Enable buffering and start display (creates ExecutionResult)
    logger.enableBufferingIfTty();
    progressService.start(config);

    logger.log("=".repeat(80));
    logger.log("Starting Verify Operation");
    logger.log("=".repeat(80));
    logger.log(`Input Directory: ${config.inputDir}`);
    logger.log(`Digest File: ${config.digestFile}`);
    logger.log(`Subdirectory: ${config.subdirectory || "(entire directory)"}`);
    logger.log(`Hash Algorithm: ${config.hashAlgorithm}`);

    const db = new DatabaseService();
    let operationId: number | null = null;

    try {
      // Open database (must exist)
      if (!fs.existsSync(config.digestFile)) {
        throw new Error(`Digest file does not exist: ${config.digestFile}`);
      }

      // Check write permissions (needed for operation log)
      if (!isFileWritable(config.digestFile)) {
        throw new Error(
          `Digest file is read-only or cannot be written: ${config.digestFile}. ` +
            `Verify operation requires write access to log operations. ` +
            `Please check file permissions (use chmod to make it writable if needed).`,
        );
      }

      db.open(config.digestFile);
      operationId = db.startOperation("verify");
      logger.log("(verify-service)> Database opened successfully");

      // Get files from database
      let digestFiles = config.subdirectory ? db.getFilesInSubdirectory(config.subdirectory) : db.getAllFiles();

      logger.log(`(verify-service)> Found ${digestFiles.length} files in digest`);

      // Discover files on disk with progress
      progressService.startDiscovery();
      const discoveredFiles = await discoveryService.discoverFiles(
        config.inputDir,
        config.subdirectory,
        (fileCount, currentDir) => {
          progressService.updateDiscoveryProgress(fileCount, currentDir);
        },
      );
      progressService.stopDiscovery();
      logger.log(`(verify-service)> Discovered ${discoveredFiles.length} files on disk`);

      // Create maps for comparison
      const digestMap = new Map(digestFiles.map((f) => [f.relative_path, f]));
      const discoveredSet = new Set(discoveredFiles);

      // Verify each file in digest
      logger.log("(verify-service)> Verifying files...");

      let filesProcessedInBatch = 0;
      const batchCommitSize = constants.DB_BATCH_COMMIT_SIZE;

      for (let i = 0; i < digestFiles.length; i++) {
        const digestFile = digestFiles[i];
        const relativePath = digestFile.relative_path;

        // Check recency threshold
        if (shouldSkipFileByRecency(digestFile.last_attempted_at, config.recencyThreshold, relativePath, logger)) {
          continue;
        }

        if (!config.dryRun && db.isOpen() && filesProcessedInBatch === 0) {
          db.beginTransaction();
        }

        // Update progress display
        progressService.updateTaskProgress(i, digestFiles.length, "Verifying files");
        progressService.updateFileProgress(0, 100, relativePath);
        progressService.updateStats();

        if (config.verbose && i % 100 === 0) {
          logger.log(`(verify-service)> Progress: ${i}/${digestFiles.length} files verified`);
        }

        try {
          // Check if file exists on disk
          if (!discoveredSet.has(relativePath)) {
            progressService.incrementFilesMissing();
            const errorMsg = "Missing file";
            progressService.addError(`Missing file: ${relativePath}`);
            logger.logNegative(`(verify-service)> Missing: ${relativePath}`);
            if (db.isOpen() && !config.dryRun) {
              db.updateFileAttempt(relativePath, errorMsg);
              filesProcessedInBatch++;
            }

            if (config.panicOnError) {
              throw new Error(`File missing: ${relativePath}`);
            }

            // Commit batch if needed
            if (!config.dryRun && db.isOpen() && filesProcessedInBatch >= batchCommitSize) {
              db.commitTransaction();
              filesProcessedInBatch = 0;
            }
            continue;
          }

          // Verify the file
          const fullPath = path.join(config.inputDir, relativePath);
          const verifyResult = await this.verifyFile(
            fullPath,
            digestFile.hash_sha256,
            digestFile.size,
            config.hashAlgorithm,
          );

          if (verifyResult.success) {
            progressService.incrementFilesVerified();
            logger.debug(`(verify-service)> Verified: ${relativePath}`);
            if (db.isOpen() && !config.dryRun) {
              db.updateFileAttempt(relativePath, "success");
            }
          } else {
            progressService.incrementFilesFailed();
            const errorMsg = `Verification failed: ${verifyResult.reason}`;
            progressService.addError(`Verification failed for ${relativePath}: ${verifyResult.reason}`);
            logger.logNegative(`(verify-service)> Failed: ${relativePath} - ${verifyResult.reason}`);
            if (db.isOpen() && !config.dryRun) {
              db.updateFileAttempt(relativePath, errorMsg);
            }

            if (config.panicOnError) {
              throw new Error(`Verification failed: ${relativePath}`);
            }
          }

          progressService.incrementTotalFilesProcessed();
          progressService.addBytesProcessed(digestFile.size);
          filesProcessedInBatch++;

          // Update file completion
          progressService.updateFileProgress(100, 100, relativePath);

          // Commit batch if we've processed enough files
          if (!config.dryRun && db.isOpen() && filesProcessedInBatch >= batchCommitSize) {
            db.commitTransaction();
            filesProcessedInBatch = 0;
          }
        } catch (error) {
          logger.logNegative(`(verify-service)> Error verifying file: ${relativePath}`);
          const errorMsg = `Error: ${(error as Error).message}`;
          progressService.addError(`Error verifying ${relativePath}: ${(error as Error).message}`);
          if (db.isOpen() && !config.dryRun) {
            db.updateFileAttempt(relativePath, errorMsg);
            filesProcessedInBatch++;
          }
          errorService.handleError(error);

          if (config.panicOnError) {
            if (!config.dryRun && db.isOpen()) {
              db.commitTransaction();
              filesProcessedInBatch = 0;
            }
            throw error;
          }
        }
      }

      // Commit any remaining files in the current batch
      if (!config.dryRun && db.isOpen()) {
        db.commitTransaction();
      }

      // Check for extra files (on disk but not in digest)
      for (const relativePath of discoveredFiles) {
        if (!digestMap.has(relativePath)) {
          progressService.incrementFilesExtra();
          progressService.addError(`Extra file not in digest: ${relativePath}`);
          logger.logNegative(`(verify-service)> Extra: ${relativePath}`);
        }
      }

      // Complete operation
      const result = progressService.getExecutionResult();
      const success = result && result.filesFailed === 0 && result.filesMissing === 0 && result.filesExtra === 0;
      progressService.completeExecution(success || false);

      if (operationId !== null && result) {
        db.completeOperation(operationId, result.success, result.errorCount);
      }

      // Complete progress display
      progressService.updateTaskProgress(digestFiles.length, digestFiles.length, "Complete");
      progressService.updateStats();
      progressService.stop();

      // Report results
      progressService.logExecutionResult(config.verbose);
    } catch (error) {
      logger.logNegative("(verify-service)> Verify operation failed");

      // Check for SQLITE_READONLY errors and provide clearer message
      let errorMessage = (error as Error).message;
      if ((error as any).code === "SQLITE_READONLY" || errorMessage.includes("readonly database")) {
        errorMessage =
          `Digest file is read-only: ${config.digestFile}. ` +
          `Cannot write to the database. Please check file permissions (use chmod to make it writable if needed).`;
      }

      progressService.addError(`Verify failed: ${errorMessage}`);
      progressService.completeExecution(false);
      errorService.handleError(error);

      const result = progressService.getExecutionResult();
      if (db.isOpen() && operationId !== null && result) {
        db.completeOperation(operationId, false, result.errorCount);
      }

      // Stop display on error
      progressService.stop();
    } finally {
      if (db.isOpen()) {
        db.close();
      }
    }

    const result = progressService.getExecutionResult();
    if (!result) {
      throw new Error("Execution result not available");
    }
    return result;
  }

  /**
   * Verifies a single file
   */
  private async verifyFile(
    filePath: string,
    expectedHash: string,
    expectedSize: number,
    hashAlgorithm: "sha256",
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, reason: "File does not exist" };
      }

      // Check size
      let stats;
      try {
        stats = fs.statSync(filePath);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        const errorMsg = getFileSystemErrorMessage(err, `Failed to read file stats: ${filePath}`);
        return { success: false, reason: errorMsg };
      }

      if (stats.size !== expectedSize) {
        return { success: false, reason: `Size mismatch (expected: ${expectedSize}, actual: ${stats.size})` };
      }

      // Check hash
      const fileName = path.basename(filePath);
      let actualHash;
      try {
        actualHash = await cryptoService.hashFile(filePath, hashAlgorithm, (bytesRead, total) => {
          const percentage = Math.floor((bytesRead / total) * 100);
          progressService.updateFileProgress(percentage, 100, fileName);
        });
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        const errorMsg = getFileSystemErrorMessage(err, `Failed to hash file: ${filePath}`);
        return { success: false, reason: errorMsg };
      }

      if (actualHash !== expectedHash) {
        return { success: false, reason: `Hash mismatch` };
      }

      return { success: true };
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      const errorMsg = getFileSystemErrorMessage(err, `Error verifying file: ${filePath}`);
      return { success: false, reason: errorMsg };
    }
  }
}

export const verifyService = new VerifyService();

import { logger } from "../lib/logger.js";
import { VerifyConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { displayService } from "./display-service.js";
import { errorService } from "./error-service.js";
import { isInSubdirectory } from "../utility/path-utils.js";
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
    const result = createExecutionResult("verify");
    result.filesVerified = 0;
    result.filesFailed = 0;
    result.filesMissing = 0;
    result.filesExtra = 0;

    // Enable buffering and start display
    logger.enableBuffering();
    displayService.start("verify", config.inputDir);

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

      db.open(config.digestFile);
      operationId = db.startOperation("verify");
      logger.log("(verify-service)> Database opened successfully");

      // Get files from database
      let digestFiles = config.subdirectory ? db.getFilesInSubdirectory(config.subdirectory) : db.getAllFiles();

      logger.log(`(verify-service)> Found ${digestFiles.length} files in digest`);

      // Discover files on disk with progress
      displayService.startDiscovery();
      const discoveredFiles = await discoveryService.discoverFiles(
        config.inputDir,
        config.subdirectory,
        result,
        (fileCount, currentDir) => {
          displayService.updateDiscoveryProgress(fileCount, currentDir);
        }
      );
      displayService.stopDiscovery();
      logger.log(`(verify-service)> Discovered ${discoveredFiles.length} files on disk`);

      // Create maps for comparison
      const digestMap = new Map(digestFiles.map((f) => [f.relative_path, f]));
      const discoveredSet = new Set(discoveredFiles);

      // Verify each file in digest
      logger.log("(verify-service)> Verifying files...");

      for (let i = 0; i < digestFiles.length; i++) {
        const digestFile = digestFiles[i];
        const relativePath = digestFile.relative_path;

        // Update progress display
        displayService.updateTaskProgress(i, digestFiles.length, "Verifying files");
        displayService.updateFileProgress(0, 100, relativePath);
        displayService.updateStats(result);

        if (config.verbose && i % 100 === 0) {
          logger.log(`(verify-service)> Progress: ${i}/${digestFiles.length} files verified`);
        }

        try {
          // Check if file exists on disk
          if (!discoveredSet.has(relativePath)) {
            result.filesMissing!++;
            addError(result, `Missing file: ${relativePath}`);
            logger.logNegative(`(verify-service)> Missing: ${relativePath}`);

            if (config.panicOnError) {
              throw new Error(`File missing: ${relativePath}`);
            }
            continue;
          }

          // Verify the file
          const fullPath = path.join(config.inputDir, relativePath);
          const verifyResult = await this.verifyFile(
            fullPath,
            digestFile.hash_sha256,
            digestFile.size,
            config.hashAlgorithm
          );

          if (verifyResult.success) {
            result.filesVerified!++;
            logger.debug(`(verify-service)> Verified: ${relativePath}`);
          } else {
            result.filesFailed!++;
            addError(result, `Verification failed for ${relativePath}: ${verifyResult.reason}`);
            logger.logNegative(`(verify-service)> Failed: ${relativePath} - ${verifyResult.reason}`);

            if (config.panicOnError) {
              throw new Error(`Verification failed: ${relativePath}`);
            }
          }

          result.totalFilesProcessed++;

          // Update file completion
          displayService.updateFileProgress(100, 100, relativePath);
        } catch (error) {
          logger.logNegative(`(verify-service)> Error verifying file: ${relativePath}`);
          addError(result, `Error verifying ${relativePath}: ${(error as Error).message}`);
          errorService.handleError(error);

          if (config.panicOnError) {
            throw error;
          }
        }
      }

      // Check for extra files (on disk but not in digest)
      for (const relativePath of discoveredFiles) {
        if (!digestMap.has(relativePath)) {
          result.filesExtra!++;
          addError(result, `Extra file not in digest: ${relativePath}`);
          logger.logNegative(`(verify-service)> Extra: ${relativePath}`);
        }
      }

      // Complete operation
      const success = result.filesFailed === 0 && result.filesMissing === 0 && result.filesExtra === 0;
      completeExecution(result, success);

      if (operationId !== null) {
        db.completeOperation(operationId, result.success, result.errorCount);
      }

      // Complete progress display
      displayService.updateTaskProgress(digestFiles.length, digestFiles.length, "Complete");
      displayService.updateStats(result);
      displayService.stop();

      // Report results
      displayService.logExecutionResult(result, config.verbose);
    } catch (error) {
      logger.logNegative("(verify-service)> Verify operation failed");
      addError(result, `Verify failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

      if (db.isOpen() && operationId !== null) {
        db.completeOperation(operationId, false, result.errorCount);
      }

      // Stop display on error
      displayService.stop();
    } finally {
      if (db.isOpen()) {
        db.close();
      }
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
    hashAlgorithm: "sha256"
  ): Promise<{ success: boolean; reason?: string }> {
    // Check file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, reason: "File does not exist" };
    }

    // Check size
    const stats = fs.statSync(filePath);
    if (stats.size !== expectedSize) {
      return { success: false, reason: `Size mismatch (expected: ${expectedSize}, actual: ${stats.size})` };
    }

    // Check hash
    const fileName = path.basename(filePath);
    const actualHash = await cryptoService.hashFile(filePath, hashAlgorithm, (bytesRead, total) => {
      const percentage = Math.floor((bytesRead / total) * 100);
      displayService.updateFileProgress(percentage, 100, fileName);
    });
    if (actualHash !== expectedHash) {
      return { success: false, reason: `Hash mismatch` };
    }

    return { success: true };
  }
}

export const verifyService = new VerifyService();

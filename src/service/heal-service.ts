import { logger } from "../lib/logger.js";
import { HealConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { cryptoService } from "./crypto-service.js";
import { fileService } from "./file-service.js";
import { displayService } from "./display-service.js";
import { errorService } from "./error-service.js";
import { joinPath } from "../utility/path-utils.js";
import { getFileSystemErrorMessage } from "../utility/error-utils.js";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";

/**
 * Service for healing directory from mirrors
 */
class HealService {
  /**
   * Executes the heal command
   */
  async execute(config: HealConfig): Promise<ExecutionResult> {
    const result = createExecutionResult("heal");
    result.filesVerified = 0;
    result.filesRecovered = 0;
    result.filesRecoveryFailed = 0;

    // Enable buffering and start display
    logger.enableBuffering();
    displayService.start(config);

    logger.log("=".repeat(80));
    logger.log("Starting Heal Operation");
    logger.log("=".repeat(80));
    logger.log(`Input Directory: ${config.inputDir}`);
    logger.log(`Digest File: ${config.digestFile}`);
    logger.log(`Subdirectory: ${config.subdirectory || "(entire directory)"}`);
    logger.log(`Mirrors: ${config.mirrors.length}`);
    logger.log(`Dry Run: ${config.dryRun}`);

    const db = new DatabaseService();
    let operationId: number | null = null;

    try {
      // Open database (must exist)
      if (!fs.existsSync(config.digestFile)) {
        throw new Error(`Digest file does not exist: ${config.digestFile}`);
      }

      // Note: In dry-run mode, we still need to open the database to read file information
      // for verification. We just don't log operations or write any changes.
      if (!config.dryRun) {
        db.open(config.digestFile);
        operationId = db.startOperation("heal");
        logger.log("(heal-service)> Database opened successfully");
      } else {
        // For dry run, open database for reading only (no operation log)
        db.open(config.digestFile);
        logger.log("(heal-service)> Database opened in read-only mode (dry run)");
      }

      // Get files from database
      const digestFiles = config.subdirectory ? db.getFilesInSubdirectory(config.subdirectory) : db.getAllFiles();

      logger.log(`(heal-service)> Found ${digestFiles.length} files in digest`);

      // Heal each file
      logger.log("(heal-service)> Healing files...");

      for (let i = 0; i < digestFiles.length; i++) {
        const digestFile = digestFiles[i];
        const relativePath = digestFile.relative_path;

        // Update progress display
        displayService.updateTaskProgress(i, digestFiles.length, "Healing files");
        displayService.updateFileProgress(0, 100, relativePath);
        displayService.updateStats(result);

        if (config.verbose && i % 100 === 0) {
          logger.log(`(heal-service)> Progress: ${i}/${digestFiles.length} files processed`);
        }

        try {
          const healResult = await this.healFile(
            relativePath,
            digestFile.hash_sha256,
            digestFile.size,
            config.inputDir,
            config.mirrors,
            config.hashAlgorithm,
            config.dryRun,
            config.validatePostCopy
          );

          if (healResult.healed) {
            result.filesRecovered!++;
            result.totalBytesProcessed += digestFile.size;
            logger.debug(`(heal-service)> Healed: ${relativePath}`);
          } else if (healResult.verified) {
            result.filesVerified!++;
            logger.debug(`(heal-service)> Verified: ${relativePath}`);
          } else {
            result.filesRecoveryFailed!++;
            addError(result, `Failed to heal ${relativePath}: ${healResult.reason}`);
            logger.logNegative(`(heal-service)> Failed: ${relativePath} - ${healResult.reason}`);

            if (config.panicOnError) {
              throw new Error(`Heal failed: ${relativePath}`);
            }
          }

          displayService.updateFileProgress(100, 100, relativePath);
          result.totalFilesProcessed++;
        } catch (error) {
          logger.logNegative(`(heal-service)> Error healing file: ${relativePath}`);
          addError(result, `Error healing ${relativePath}: ${(error as Error).message}`);
          errorService.handleError(error);

          if (config.panicOnError) {
            throw error;
          }
        }
      }

      // Complete operation
      completeExecution(result, result.filesRecoveryFailed === 0);

      if (!config.dryRun && operationId !== null) {
        db.completeOperation(operationId, result.success, result.errorCount);
      }

      // Complete progress display
      displayService.updateTaskProgress(digestFiles.length, digestFiles.length, "Complete");
      displayService.updateStats(result);
      displayService.stop();

      // Report results
      displayService.logExecutionResult(result, config.verbose);
    } catch (error) {
      logger.logNegative("(heal-service)> Heal operation failed");
      addError(result, `Heal failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

      // Stop display on error
      displayService.stop();

      if (db.isOpen() && !config.dryRun && operationId !== null) {
        db.completeOperation(operationId, false, result.errorCount);
      }
    } finally {
      if (db.isOpen()) {
        db.close();
      }
    }

    return result;
  }

  /**
   * Heals a single file
   */
  private async healFile(
    relativePath: string,
    expectedHash: string,
    expectedSize: number,
    targetDir: string,
    mirrors: Array<{ dir: string; digestFile: string }>,
    hashAlgorithm: "sha256",
    dryRun: boolean,
    validatePostCopy: boolean
  ): Promise<{ verified: boolean; healed: boolean; reason?: string }> {
    const targetPath = joinPath(targetDir, relativePath);

    // Check if file exists and is valid
    if (fs.existsSync(targetPath)) {
      try {
        const stats = fs.statSync(targetPath);

        // Check size
        if (stats.size === expectedSize) {
          // Check hash
          const actualHash = await cryptoService.hashFile(targetPath, hashAlgorithm, (bytesRead, total) => {
            const percentage = Math.floor((bytesRead / total) * 100);
            displayService.updateFileProgress(percentage, 100, `[Check] ${relativePath}`);
          });
          if (actualHash === expectedHash) {
            // File is valid, no healing needed
            return { verified: true, healed: false };
          }
        }

        logger.log(`(heal-service)> File needs healing: ${relativePath}`);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        const errorMsg = getFileSystemErrorMessage(err, `Error checking file: ${relativePath}`);
        logger.logNegative(`(heal-service)> ${errorMsg}`);
      }
    } else {
      logger.log(`(heal-service)> File missing: ${relativePath}`);
    }

    // File is missing or corrupted, try to recover from mirrors
    for (const mirror of mirrors) {
      const mirrorPath = joinPath(mirror.dir, relativePath);

      // Check if mirror file exists
      if (!fs.existsSync(mirrorPath)) {
        logger.debug(`(heal-service)> Mirror file not found: ${mirrorPath}`);
        continue;
      }

      try {
        // Verify mirror integrity (READ operation - can try next mirror on error)
        const mirrorStats = fs.statSync(mirrorPath);
        if (mirrorStats.size !== expectedSize) {
          logger.logNegative(`(heal-service)> Mirror size mismatch: ${mirrorPath}`);
          continue;
        }

        const mirrorHash = await cryptoService.hashFile(mirrorPath, hashAlgorithm, (bytesRead, total) => {
          const percentage = Math.floor((bytesRead / total) * 100);
          displayService.updateFileProgress(percentage, 100, `[Verify Mirror] ${relativePath}`);
        });
        if (mirrorHash !== expectedHash) {
          logger.logNegative(`(heal-service)> Mirror hash mismatch: ${mirrorPath}`);
          continue;
        }

        // Mirror is valid, copy to target
        if (!dryRun) {
          // Ensure target directory exists (WRITE operation - fail immediately on error)
          const targetDirPath = path.dirname(targetPath);

          // Check for potentially problematic characters in path (e.g., colons on FAT32/exFAT)
          if (targetDirPath.includes(":")) {
            // Colon detected - may fail on FAT32/exFAT filesystems
            logger.debug(`(heal-service)> Warning: Path contains colon, may fail on FAT32/exFAT: ${targetDirPath}`);
          }

          try {
            await fsPromises.mkdir(targetDirPath, { recursive: true });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            // Include file path in error for context
            let errorMsg = getFileSystemErrorMessage(
              err,
              `Failed to create target directory for file ${relativePath}: ${targetDirPath}`
            );

            // If path contains colon and we got ENOENT, suggest filesystem limitation
            if (err.code === "ENOENT" && (targetDirPath.includes(":") || relativePath.includes(":"))) {
              errorMsg += " (Note: Colons in filenames are not supported on FAT32/exFAT filesystems)";
            }

            return { verified: false, healed: false, reason: errorMsg };
          }

          // Copy file with progress (WRITE operation - fail immediately on error)
          try {
            await fileService.copyLargeFile(mirrorPath, targetPath, (bytesRead, totalBytes) => {
              const percentage = Math.floor((bytesRead / totalBytes) * 100);
              displayService.updateFileProgress(percentage, 100, `[Heal] ${relativePath}`);
            });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            const errorMsg = getFileSystemErrorMessage(err, `Failed to copy file from ${mirrorPath} to ${targetPath}`);
            return { verified: false, healed: false, reason: errorMsg };
          }

          // Verify copy if validation is enabled (READ operation on target - fail immediately as it's post-write)
          if (validatePostCopy) {
            try {
              const copiedHash = await cryptoService.hashFile(targetPath, hashAlgorithm, (bytesRead, total) => {
                const percentage = Math.floor((bytesRead / total) * 100);
                displayService.updateFileProgress(percentage, 100, `[Validate] ${relativePath}`);
              });
              if (copiedHash !== expectedHash) {
                return { verified: false, healed: false, reason: "Copy verification failed" };
              }
            } catch (error) {
              const err = error as NodeJS.ErrnoException;
              const errorMsg = getFileSystemErrorMessage(err, `Failed to verify copied file: ${targetPath}`);
              return { verified: false, healed: false, reason: errorMsg };
            }
          }
        }

        logger.debug(`(heal-service)> Successfully healed from mirror: ${mirror.dir}`);
        return { verified: false, healed: true };
      } catch (error) {
        // READ error from mirror - log and try next mirror
        const err = error as NodeJS.ErrnoException;
        const errorMsg = getFileSystemErrorMessage(err, `Error reading from mirror: ${mirrorPath}`);
        logger.logNegative(`(heal-service)> Error reading from ${mirrorPath}: ${errorMsg}`);
        continue;
      }
    }

    // All mirrors exhausted
    return { verified: false, healed: false, reason: "No valid mirror found" };
  }
}

export const healService = new HealService();

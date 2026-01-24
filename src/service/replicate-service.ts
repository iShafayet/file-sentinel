import { logger } from "../lib/logger.js";
import { ReplicateConfig } from "../model/config.js";
import { ExecutionResult } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { fileService } from "./file-service.js";
import { progressService } from "./progress-service.js";
import { errorService } from "./error-service.js";
import { RecycleUtility } from "../utility/recycle-utility.js";
import { isInSubdirectory, joinPath } from "../utility/path-utils.js";
import { getFileSystemErrorMessage } from "../utility/error-utils.js";
import { isFileWritable } from "../utility/file-utils.js";
import { shouldSkipFileByRecency } from "../utility/misc-utils.js";
import constants from "../constant/common-constants.js";
import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";

/**
 * Service for replicating directory to destination
 */
class ReplicateService {
  /**
   * Executes the replicate command
   */
  async execute(config: ReplicateConfig): Promise<ExecutionResult> {
    // Enable buffering and start display (creates ExecutionResult)
    logger.enableBufferingIfTty();
    progressService.start(config);

    logger.log("=".repeat(80));
    logger.log("Starting Replicate Operation");
    logger.log("=".repeat(80));
    logger.log(`Source Directory: ${config.sourceDir}`);
    logger.log(`Source Digest: ${config.sourceDigestFile}`);
    logger.log(`Destination Directory: ${config.destDir}`);
    logger.log(`Destination Digest: ${config.destDigestFile}`);
    logger.log(`Subdirectory: ${config.subdirectory || "(entire directory)"}`);
    logger.log(`Mirrors: ${config.mirrors.length}`);
    logger.log(`Permanent Delete: ${config.permaDelete}`);
    logger.log(`Dry Run: ${config.dryRun}`);

    const sourceDb = new DatabaseService();
    const destDb = new DatabaseService();
    const recycleUtility = new RecycleUtility(config.destDir);

    let sourceOpId: number | null = null;
    let destOpId: number | null = null;

    try {
      // Open source database (must exist)
      if (!fs.existsSync(config.sourceDigestFile)) {
        throw new Error(`Source digest file does not exist: ${config.sourceDigestFile}`);
      }

      // Check write permissions for source (needed for operation log)
      if (!isFileWritable(config.sourceDigestFile)) {
        throw new Error(
          `Source digest file is read-only or cannot be written: ${config.sourceDigestFile}. ` +
            `Replicate operation requires write access to log operations. ` +
            `Please check file permissions (use chmod to make it writable if needed).`,
        );
      }

      sourceDb.open(config.sourceDigestFile);
      sourceOpId = sourceDb.startOperation("replicate-source");
      logger.log("(replicate-service)> Source database opened");

      // Ensure destination directory exists
      if (!config.dryRun) {
        await fsPromises.mkdir(config.destDir, { recursive: true });
        logger.log("(replicate-service)> Destination directory ready");
      }

      // Open or create destination database
      if (!config.dryRun) {
        // Check write permissions for destination (needed for writing files and operation log)
        if (!isFileWritable(config.destDigestFile)) {
          throw new Error(
            `Destination digest file is read-only or cannot be written: ${config.destDigestFile}. ` +
              `Replicate operation requires write access to update the destination digest. ` +
              `Please check file permissions (use chmod to make it writable if needed).`,
          );
        }

        destDb.open(config.destDigestFile);
        destOpId = destDb.startOperation("replicate-destination");
        logger.log("(replicate-service)> Destination database opened");
      }

      // Get source files
      const sourceFiles = config.subdirectory
        ? sourceDb.getFilesInSubdirectory(config.subdirectory)
        : sourceDb.getAllFiles();

      logger.log(`(replicate-service)> Found ${sourceFiles.length} files in source digest`);

      // Get destination files
      const destFileMap = new Map<string, { hash: string; size: number }>();
      if (!config.dryRun && destDb.isOpen()) {
        const destFiles = config.subdirectory
          ? destDb.getFilesInSubdirectory(config.subdirectory)
          : destDb.getAllFiles();

        for (const file of destFiles) {
          destFileMap.set(file.relative_path, { hash: file.hash_sha256, size: file.size });
        }
        logger.log(`(replicate-service)> Found ${destFileMap.size} files in destination digest`);
      }

      // Replicate each source file
      logger.log("(replicate-service)> Replicating files...");

      let filesProcessedInBatch = 0;
      const batchCommitSize = constants.DB_BATCH_COMMIT_SIZE;
      let transactionActive = false;

      for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i];
        const relativePath = sourceFile.relative_path;

        // Check recency threshold (check destination file if it exists)
        if (!config.dryRun && destDb.isOpen()) {
          const destFile = destDb.getFile(relativePath);
          if (
            destFile &&
            shouldSkipFileByRecency(destFile.last_attempted_at, config.recencyThreshold, relativePath, logger)
          ) {
            continue;
          }
        }

        // Start transaction if needed
        if (!config.dryRun && destDb.isOpen() && !transactionActive) {
          destDb.beginTransaction();
          transactionActive = true;
        }

        // Update progress display
        progressService.updateTaskProgress(i, sourceFiles.length, "Replicating files");
        progressService.updateFileProgress(0, 100, relativePath);
        progressService.updateStats();

        if (config.verbose && i % 100 === 0) {
          logger.log(`(replicate-service)> Progress: ${i}/${sourceFiles.length} files processed`);
        }

        try {
          const replicateResult = await this.replicateFile(
            relativePath,
            sourceFile.hash_sha256,
            sourceFile.size,
            config,
            destFileMap,
            recycleUtility,
          );

          if (replicateResult.success) {
            // Only increment filesCopied if file was actually copied
            if (replicateResult.copied) {
              progressService.incrementFilesCopied();
              progressService.addBytesProcessed(sourceFile.size);
              progressService.updateFileProgress(100, 100, relativePath);

              // Update destination digest
              if (!config.dryRun && destDb.isOpen()) {
                destDb.upsertFile({
                  relative_path: relativePath,
                  size: sourceFile.size,
                  created_at: sourceFile.created_at,
                  modified_at: sourceFile.modified_at,
                  hash_sha256: sourceFile.hash_sha256,
                  last_attempted_at: Date.now(),
                  last_attempt_result: "success",
                });
              }

              logger.debug(`(replicate-service)> Copied: ${relativePath}`);
            } else {
              // File was skipped (already exists and matches)
              progressService.updateFileProgress(100, 100, relativePath);
              logger.debug(`(replicate-service)> Skipped: ${relativePath} (already exists)`);
            }
          } else {
            progressService.incrementFilesRecoveryFailed();
            const errorMsg = `Failed: ${replicateResult.reason}`;
            progressService.addError(`Failed to replicate ${relativePath}: ${replicateResult.reason}`);
            logger.logNegative(`(replicate-service)> Failed: ${relativePath} - ${replicateResult.reason}`);
            if (!config.dryRun && destDb.isOpen()) {
              destDb.updateFileAttempt(relativePath, errorMsg);
            }

            if (config.panicOnError) {
              throw new Error(`Replication failed: ${relativePath}`);
            }
          }

          progressService.incrementTotalFilesProcessed();
          filesProcessedInBatch++;

          // Commit batch if we've processed enough files
          if (!config.dryRun && destDb.isOpen() && transactionActive && filesProcessedInBatch >= batchCommitSize) {
            destDb.commitTransaction();
            transactionActive = false;
            filesProcessedInBatch = 0;
          }
        } catch (error) {
          logger.logNegative(`(replicate-service)> Error replicating file: ${relativePath}`);
          progressService.addError(`Error replicating ${relativePath}: ${(error as Error).message}`);
          errorService.handleError(error);

          if (config.panicOnError) {
            // Commit current batch before throwing
            if (!config.dryRun && destDb.isOpen() && transactionActive) {
              try {
                destDb.commitTransaction();
                transactionActive = false;
                filesProcessedInBatch = 0;
              } catch (commitError) {
                logger.logNegative(`(replicate-service)> Error committing batch: ${(commitError as Error).message}`);
              }
            }
            throw error;
          }
        }
      }

      // Commit any remaining files in the current batch
      if (!config.dryRun && destDb.isOpen() && transactionActive) {
        destDb.commitTransaction();
        transactionActive = false;
      }

      // Handle deletions (files in dest but not in source)
      if (!config.dryRun && destDb.isOpen()) {
        destDb.beginTransaction();
        transactionActive = true;
        const sourceFileSet = new Set(sourceFiles.map((f) => f.relative_path));

        for (const [relativePath] of destFileMap) {
          if (!sourceFileSet.has(relativePath)) {
            const destFilePath = joinPath(config.destDir, relativePath);

            try {
              if (fs.existsSync(destFilePath)) {
                if (config.permaDelete) {
                  await recycleUtility.permanentDelete(destFilePath);
                  logger.log(`(replicate-service)> Permanently deleted: ${relativePath}`);
                } else {
                  await recycleUtility.moveToRecycle(destFilePath);
                  logger.log(`(replicate-service)> Moved to recycle: ${relativePath}`);
                }
              }

              destDb.deleteFile(relativePath);
              progressService.incrementFilesDeleted();
            } catch (error) {
              logger.logNegative(`(replicate-service)> Error deleting: ${relativePath}`);
              progressService.addError(`Error deleting ${relativePath}: ${(error as Error).message}`);
            }
          }
        }
        destDb.commitTransaction();
        transactionActive = false;
      }

      // Update destination summary
      const result = progressService.getExecutionResult();
      if (!config.dryRun && destDb.isOpen()) {
        destDb.beginTransaction();
        transactionActive = true;
        const now = Date.now();
        const existingSummary = destDb.getSummary();

        if (result) {
          destDb.upsertSummary({
            total_files: sourceFiles.length,
            total_size: result.totalBytesProcessed,
            created_at: existingSummary?.created_at || now,
            modified_at: now,
          });
        }
        destDb.commitTransaction();
        transactionActive = false;
      }

      const success = result && result.filesRecoveryFailed === 0;
      progressService.completeExecution(success || false);

      // Complete operation logs
      if (sourceOpId !== null && result) {
        sourceDb.completeOperation(sourceOpId, result.success, result.errorCount);
      }
      if (!config.dryRun && destDb.isOpen() && destOpId !== null && result) {
        destDb.completeOperation(destOpId, result.success, result.errorCount);
      }

      // Complete progress display
      progressService.updateTaskProgress(sourceFiles.length, sourceFiles.length, "Complete");
      progressService.updateStats();
      progressService.stop();

      // Report results
      progressService.logExecutionResult(config.verbose);
    } catch (error) {
      logger.logNegative("(replicate-service)> Replicate operation failed");

      // Check for SQLITE_READONLY errors and provide clearer message
      let errorMessage = (error as Error).message;
      if ((error as any).code === "SQLITE_READONLY" || errorMessage.includes("readonly database")) {
        // Determine which database failed based on error context
        const sourcePath = config.sourceDigestFile;
        const destPath = config.destDigestFile;
        if (errorMessage.includes("source") || errorMessage.includes(sourcePath)) {
          errorMessage =
            `Source digest file is read-only: ${sourcePath}. ` +
            `Cannot write to the database. Please check file permissions (use chmod to make it writable if needed).`;
        } else if (errorMessage.includes("destination") || errorMessage.includes(destPath)) {
          errorMessage =
            `Destination digest file is read-only: ${destPath}. ` +
            `Cannot write to the database. Please check file permissions (use chmod to make it writable if needed).`;
        } else {
          errorMessage =
            `Digest file is read-only. ` +
            `Cannot write to the database. Please check file permissions (use chmod to make it writable if needed).`;
        }
      }

      progressService.addError(`Replicate failed: ${errorMessage}`);
      progressService.completeExecution(false);
      errorService.handleError(error);

      // Stop display on error
      progressService.stop();

      const result = progressService.getExecutionResult();
      if (sourceDb.isOpen() && sourceOpId !== null && result) {
        sourceDb.completeOperation(sourceOpId, false, result.errorCount);
      }
      if (destDb.isOpen() && destOpId !== null && result) {
        destDb.completeOperation(destOpId, false, result.errorCount);
      }
    } finally {
      if (sourceDb.isOpen()) {
        sourceDb.close();
      }
      if (destDb.isOpen()) {
        destDb.close();
      }
    }

    const result = progressService.getExecutionResult();
    if (!result) {
      throw new Error("Execution result not available");
    }
    return result;
  }

  /**
   * Replicates a single file
   */
  private async replicateFile(
    relativePath: string,
    expectedHash: string,
    expectedSize: number,
    config: ReplicateConfig,
    destFileMap: Map<string, { hash: string; size: number }>,
    recycleUtility: RecycleUtility,
  ): Promise<{ success: boolean; copied?: boolean; reason?: string }> {
    const destPath = joinPath(config.destDir, relativePath);

    // Check if destination already has correct file
    const destInfo = destFileMap.get(relativePath);
    if (destInfo && destInfo.hash === expectedHash && destInfo.size === expectedSize) {
      // Verify the file on disk
      if (fs.existsSync(destPath)) {
        const destStats = fs.statSync(destPath);
        if (destStats.size === expectedSize) {
          if (config.trustDestDigest) {
            // Trust the digest, skip on-disk verification
            return { success: true, copied: false };
          }

          const destHash = await cryptoService.hashFile(destPath, config.hashAlgorithm, (bytesRead, total) => {
            const percentage = Math.floor((bytesRead / total) * 100);
            progressService.updateFileProgress(percentage, 100, `[Check] ${relativePath}`);
          });
          if (destHash === expectedHash) {
            // File already correct, skip
            return { success: true, copied: false };
          }
        }
      }
    }

    // Try to copy from source or mirrors
    const sources = [{ dir: config.sourceDir, digestFile: config.sourceDigestFile }, ...config.mirrors];

    for (const source of sources) {
      const sourcePath = joinPath(source.dir, relativePath);

      // Check if source file exists
      if (!fs.existsSync(sourcePath)) {
        logger.debug(`(replicate-service)> Source file not found: ${sourcePath}`);
        continue;
      }

      // Verify source integrity (READ operation - can try next source on error)
      try {
        const sourceHash = await cryptoService.hashFile(sourcePath, config.hashAlgorithm, (bytesRead, total) => {
          const percentage = Math.floor((bytesRead / total) * 100);
          progressService.updateFileProgress(percentage, 100, `[Verify] ${relativePath}`);
        });
        const sourceStats = fs.statSync(sourcePath);

        if (sourceHash !== expectedHash || sourceStats.size !== expectedSize) {
          logger.logNegative(`(replicate-service)> Source integrity check failed: ${sourcePath}`);
          continue;
        }

        // Source is valid, copy to destination
        if (!config.dryRun) {
          // Ensure destination directory exists (WRITE operation - fail immediately on error)
          const destDir = path.dirname(destPath);

          // Check for potentially problematic characters in path (e.g., colons on FAT32/exFAT)
          if (destDir.includes(":")) {
            // Colon detected - may fail on FAT32/exFAT filesystems
            logger.debug(`(replicate-service)> Warning: Path contains colon, may fail on FAT32/exFAT: ${destDir}`);
          }

          try {
            await fsPromises.mkdir(destDir, { recursive: true });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            // Check if error might be due to invalid characters in filename
            let errorMsg = getFileSystemErrorMessage(
              err,
              `Failed to create destination directory for file ${relativePath}: ${destDir}`,
            );

            // If path contains colon and we got ENOENT, suggest filesystem limitation
            if (err.code === "ENOENT" && (destDir.includes(":") || relativePath.includes(":"))) {
              errorMsg += " (Note: Colons in filenames are not supported on FAT32/exFAT filesystems)";
            }

            return { success: false, reason: errorMsg };
          }

          // Copy file with progress (WRITE operation - fail immediately on error)
          try {
            await fileService.copyLargeFile(sourcePath, destPath, (bytesRead, totalBytes) => {
              const percentage = Math.floor((bytesRead / totalBytes) * 100);
              progressService.updateFileProgress(percentage, 100, `[Copy] ${relativePath}`);
            });
          } catch (error) {
            const err = error as NodeJS.ErrnoException;
            const errorMsg = getFileSystemErrorMessage(err, `Failed to copy file from ${sourcePath} to ${destPath}`);
            return { success: false, reason: errorMsg };
          }

          // Verify copy if validation is enabled (READ operation on dest - fail immediately as it's post-write)
          if (config.validatePostCopy) {
            try {
              const copiedHash = await cryptoService.hashFile(destPath, config.hashAlgorithm, (bytesRead, total) => {
                const percentage = Math.floor((bytesRead / total) * 100);
                progressService.updateFileProgress(percentage, 100, `[Validate] ${relativePath}`);
              });
              if (copiedHash !== expectedHash) {
                return { success: false, reason: "Copy verification failed" };
              }
            } catch (error) {
              const err = error as NodeJS.ErrnoException;
              const errorMsg = getFileSystemErrorMessage(err, `Failed to verify copied file: ${destPath}`);
              return { success: false, reason: errorMsg };
            }
          }
        }

        return { success: true, copied: true };
      } catch (error) {
        // READ error from source - log and try next source
        const err = error as NodeJS.ErrnoException;
        const errorMsg = getFileSystemErrorMessage(err, `Error reading from source: ${sourcePath}`);
        logger.logNegative(`(replicate-service)> Error reading from ${sourcePath}: ${errorMsg}`);
        continue;
      }
    }

    // All sources exhausted
    return { success: false, reason: "No valid source found" };
  }
}

export const replicateService = new ReplicateService();

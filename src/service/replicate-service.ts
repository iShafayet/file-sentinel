import { logger } from "../lib/logger.js";
import { ReplicateConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { displayService } from "./display-service.js";
import { errorService } from "./error-service.js";
import { RecycleUtility } from "../utility/recycle-utility.js";
import { isInSubdirectory, joinPath } from "../utility/path-utils.js";
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
    const result = createExecutionResult("replicate");
    result.filesCopied = 0;
    result.filesDeleted = 0;
    result.filesRecovered = 0;
    result.filesRecoveryFailed = 0;

    // Enable buffering and start display
    logger.enableBuffering();
    displayService.start("replicate", config.sourceDir);

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

      // Start transaction for destination
      if (!config.dryRun && destDb.isOpen()) {
        destDb.beginTransaction();
      }

      try {
        // Replicate each source file
        logger.log("(replicate-service)> Replicating files...");

        for (let i = 0; i < sourceFiles.length; i++) {
          const sourceFile = sourceFiles[i];
          const relativePath = sourceFile.relative_path;

          // Update progress display
          displayService.updateTaskProgress(i, sourceFiles.length, "Replicating files");
          displayService.updateFileProgress(0, 100, relativePath);
          displayService.updateStats(result);

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
              recycleUtility
            );

            if (replicateResult.success) {
              result.filesCopied!++;
              result.totalBytesProcessed += sourceFile.size;
              displayService.updateFileProgress(100, 100, relativePath);

              // Update destination digest
              if (!config.dryRun && destDb.isOpen()) {
                destDb.upsertFile({
                  relative_path: relativePath,
                  size: sourceFile.size,
                  created_at: sourceFile.created_at,
                  modified_at: sourceFile.modified_at,
                  hash_sha256: sourceFile.hash_sha256,
                });
              }

              logger.debug(`(replicate-service)> Copied: ${relativePath}`);
            } else {
              result.filesRecoveryFailed!++;
              addError(result, `Failed to replicate ${relativePath}: ${replicateResult.reason}`);
              logger.logNegative(`(replicate-service)> Failed: ${relativePath} - ${replicateResult.reason}`);

              if (config.panicOnError) {
                throw new Error(`Replication failed: ${relativePath}`);
              }
            }

            result.totalFilesProcessed++;
          } catch (error) {
            logger.logNegative(`(replicate-service)> Error replicating file: ${relativePath}`);
            addError(result, `Error replicating ${relativePath}: ${(error as Error).message}`);
            errorService.handleError(error);

            if (config.panicOnError) {
              throw error;
            }
          }
        }

        // Handle deletions (files in dest but not in source)
        if (!config.dryRun && destDb.isOpen()) {
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
                result.filesDeleted!++;
              } catch (error) {
                logger.logNegative(`(replicate-service)> Error deleting: ${relativePath}`);
                addError(result, `Error deleting ${relativePath}: ${(error as Error).message}`);
              }
            }
          }
        }

        // Update destination summary
        if (!config.dryRun && destDb.isOpen()) {
          const now = Date.now();
          const existingSummary = destDb.getSummary();

          destDb.upsertSummary({
            total_files: sourceFiles.length,
            total_size: result.totalBytesProcessed,
            created_at: existingSummary?.created_at || now,
            modified_at: now,
          });
        }

        if (!config.dryRun && destDb.isOpen()) {
          destDb.commitTransaction();
        }

        completeExecution(result, result.filesRecoveryFailed === 0);
      } catch (error) {
        if (!config.dryRun && destDb.isOpen()) {
          destDb.rollbackTransaction();
        }
        throw error;
      }

      // Complete operation logs
      if (sourceOpId !== null) {
        sourceDb.completeOperation(sourceOpId, result.success, result.errorCount);
      }
      if (!config.dryRun && destDb.isOpen() && destOpId !== null) {
        destDb.completeOperation(destOpId, result.success, result.errorCount);
      }

      // Complete progress display
      displayService.updateTaskProgress(sourceFiles.length, sourceFiles.length, "Complete");
      displayService.updateStats(result);
      displayService.stop();

      // Report results
      displayService.logExecutionResult(result, config.verbose);
    } catch (error) {
      logger.logNegative("(replicate-service)> Replicate operation failed");
      addError(result, `Replicate failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

      // Stop display on error
      displayService.stop();

      if (sourceDb.isOpen() && sourceOpId !== null) {
        sourceDb.completeOperation(sourceOpId, false, result.errorCount);
      }
      if (destDb.isOpen() && destOpId !== null) {
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
    recycleUtility: RecycleUtility
  ): Promise<{ success: boolean; reason?: string }> {
    const destPath = joinPath(config.destDir, relativePath);

    // Check if destination already has correct file
    const destInfo = destFileMap.get(relativePath);
    if (destInfo && destInfo.hash === expectedHash && destInfo.size === expectedSize) {
      // Verify the file on disk
      if (fs.existsSync(destPath)) {
        const destStats = fs.statSync(destPath);
        if (destStats.size === expectedSize) {
          const destHash = await cryptoService.hashFile(destPath, config.hashAlgorithm, (bytesRead, total) => {
            const percentage = Math.floor((bytesRead / total) * 100);
            displayService.updateFileProgress(percentage, 100, `[Check] ${relativePath}`);
          });
          if (destHash === expectedHash) {
            // File already correct, skip
            return { success: true };
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
        continue;
      }

      // Verify source integrity
      try {
        const sourceHash = await cryptoService.hashFile(sourcePath, config.hashAlgorithm, (bytesRead, total) => {
          const percentage = Math.floor((bytesRead / total) * 100);
          displayService.updateFileProgress(percentage, 100, `[Verify] ${relativePath}`);
        });
        const sourceStats = fs.statSync(sourcePath);

        if (sourceHash !== expectedHash || sourceStats.size !== expectedSize) {
          logger.logNegative(`(replicate-service)> Source integrity check failed: ${sourcePath}`);
          continue;
        }

        // Source is valid, copy to destination
        if (!config.dryRun) {
          // Ensure destination directory exists
          const destDir = path.dirname(destPath);
          await fsPromises.mkdir(destDir, { recursive: true });

          // Copy file
          await fsPromises.copyFile(sourcePath, destPath);

          // Verify copy
          const copiedHash = await cryptoService.hashFile(destPath, config.hashAlgorithm, (bytesRead, total) => {
            const percentage = Math.floor((bytesRead / total) * 100);
            displayService.updateFileProgress(percentage, 100, `[Validate] ${relativePath}`);
          });
          if (copiedHash !== expectedHash) {
            return { success: false, reason: "Copy verification failed" };
          }
        }

        return { success: true };
      } catch (error) {
        logger.logNegative(`(replicate-service)> Error copying from ${sourcePath}: ${(error as Error).message}`);
        continue;
      }
    }

    return { success: false, reason: "No valid source found" };
  }
}

export const replicateService = new ReplicateService();

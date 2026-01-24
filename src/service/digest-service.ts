import { logger } from "../lib/logger.js";
import { DigestConfig } from "../model/config.js";
import { ExecutionResult } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { progressService } from "./progress-service.js";
import { errorService } from "./error-service.js";
import { isFileWritable } from "../utility/file-utils.js";
import { shouldSkipFileByRecency } from "../utility/misc-utils.js";
import constants from "../constant/common-constants.js";
import path from "path";
import fs from "fs";

/**
 * Service for creating and updating digests
 */
class DigestService {
  /**
   * Executes the digest command
   */
  async execute(config: DigestConfig): Promise<ExecutionResult> {
    // Enable buffering and start display (creates ExecutionResult)
    logger.enableBufferingIfTty();
    progressService.start(config);

    logger.log("=".repeat(80));
    logger.log("Starting Digest Operation");
    logger.log("=".repeat(80));
    logger.log(`Input Directory: ${config.inputDir}`);
    logger.log(`Digest File: ${config.digestFile}`);
    logger.log(`Subdirectory: ${config.subdirectory || "(entire directory)"}`);
    logger.log(`Hash Algorithm: ${config.hashAlgorithm}`);
    logger.log(`Dry Run: ${config.dryRun}`);

    const db = new DatabaseService();
    let operationId: number | null = null;

    try {
      // Open or create database
      if (config.dryRun) {
        logger.log("(digest-service)> Dry run mode - database will not be modified");
      } else {
        // Check write permissions before attempting to open
        if (!isFileWritable(config.digestFile)) {
          throw new Error(
            `Digest file is read-only or cannot be written: ${config.digestFile}. ` +
              `Please check file permissions (use chmod to make it writable if needed).`,
          );
        }

        db.open(config.digestFile);
        operationId = db.startOperation("digest");
        logger.log("(digest-service)> Database opened successfully");
      }

      // Discover files with progress (filtered by subdirectory if specified)
      logger.log("(digest-service)> Discovering files...");
      progressService.startDiscovery();
      const discoveredFiles = await discoveryService.discoverFiles(
        config.inputDir,
        config.subdirectory,
        (fileCount, currentDir) => {
          progressService.updateDiscoveryProgress(fileCount, currentDir);
        },
        config.compatibilityRiskStrategy,
      );
      progressService.stopDiscovery();
      logger.log(`(digest-service)> Discovered ${discoveredFiles.length} files`);

      // Get existing files from database (filtered by subdirectory if specified)
      const existingFileMap = new Map<
        string,
        { hash: string; size: number; mtime: number; last_attempted_at: number }
      >();

      if (!config.dryRun && db.isOpen()) {
        const existingFiles = config.subdirectory ? db.getFilesInSubdirectory(config.subdirectory) : db.getAllFiles();
        for (const file of existingFiles) {
          existingFileMap.set(file.relative_path, {
            hash: file.hash_sha256,
            size: file.size,
            mtime: file.modified_at,
            last_attempted_at: file.last_attempted_at,
          });
        }
        logger.log(
          `(digest-service)> Found ${existingFileMap.size} existing entries in digest${
            config.subdirectory ? ` (subdirectory: ${config.subdirectory})` : ""
          }`,
        );
      }

      // Process each discovered file
      logger.log("(digest-service)> Processing files...");

      let filesProcessedInBatch = 0;
      const batchCommitSize = constants.DB_BATCH_COMMIT_SIZE;

      for (let i = 0; i < discoveredFiles.length; i++) {
        const relativePath = discoveredFiles[i];

        // Check recency threshold
        const existingFile = existingFileMap.get(relativePath);
        if (
          existingFile &&
          shouldSkipFileByRecency(existingFile.last_attempted_at, config.recencyThreshold, relativePath, logger)
        ) {
          continue;
        }

        if (!config.dryRun && db.isOpen() && filesProcessedInBatch === 0) {
          db.beginTransaction();
        }

        // Update progress display
        progressService.updateTaskProgress(i, discoveredFiles.length, "Processing files");
        progressService.updateFileProgress(0, 100, relativePath);
        progressService.updateStats();

        if (config.verbose && i % 100 === 0) {
          logger.log(`(digest-service)> Progress: ${i}/${discoveredFiles.length} files processed`);
        }

        try {
          const status = await this.processFile(
            relativePath,
            config.inputDir,
            config.hashAlgorithm,
            db,
            existingFileMap,
            config.dryRun,
          );

          switch (status) {
            case "added":
              progressService.incrementFilesAdded();
              logger.debug(`(digest-service)> Added: ${relativePath}`);
              break;
            case "updated":
              progressService.incrementFilesUpdated();
              logger.debug(`(digest-service)> Updated: ${relativePath}`);
              break;
            case "unchanged":
              progressService.incrementFilesUnchanged();
              logger.debug(`(digest-service)> Unchanged: ${relativePath}`);
              break;
          }

          progressService.incrementTotalFilesProcessed();
          filesProcessedInBatch++;

          // Update file completion
          progressService.updateFileProgress(100, 100, relativePath);

          // Commit batch if we've processed enough files
          if (!config.dryRun && db.isOpen() && filesProcessedInBatch >= batchCommitSize) {
            db.commitTransaction();
            filesProcessedInBatch = 0;
          }
        } catch (error) {
          logger.logNegative(`(digest-service)> Error processing file: ${relativePath}`);
          progressService.addError(`Failed to process ${relativePath}: ${(error as Error).message}`);
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

      // Remove entries for files that no longer exist
      if (!config.dryRun && db.isOpen()) {
        db.beginTransaction();
        const discoveredSet = new Set(discoveredFiles);
        for (const [relativePath] of existingFileMap) {
          if (!discoveredSet.has(relativePath)) {
            db.deleteFile(relativePath);
            progressService.incrementFilesDeleted();
            if (config.verbose) {
              logger.log(`(digest-service)> Deleted entry: ${relativePath}`);
            }
          }
        }
        db.commitTransaction();
      }

      // Update summary
      if (!config.dryRun && db.isOpen()) {
        db.beginTransaction();
        const now = Date.now();
        const existingSummary = db.getSummary();
        const result = progressService.getExecutionResult();

        if (result) {
          db.upsertSummary({
            total_files: discoveredFiles.length,
            total_size: result.totalBytesProcessed,
            created_at: existingSummary?.created_at || now,
            modified_at: now,
          });
        }
        db.commitTransaction();
      }

      progressService.completeExecution(true);

      // Complete operation log
      const result = progressService.getExecutionResult();
      if (!config.dryRun && db.isOpen() && operationId !== null && result) {
        db.completeOperation(operationId, result.success, result.errorCount);
      }

      // Complete progress display
      progressService.updateTaskProgress(discoveredFiles.length, discoveredFiles.length, "Complete");
      progressService.updateStats();
      progressService.stop();

      // Report results
      progressService.logExecutionResult(config.verbose);
    } catch (error) {
      logger.logNegative("(digest-service)> Digest operation failed");

      // Check for SQLITE_READONLY errors and provide clearer message
      let errorMessage = (error as Error).message;
      if ((error as any).code === "SQLITE_READONLY" || errorMessage.includes("readonly database")) {
        errorMessage =
          `Digest file is read-only: ${config.digestFile}. ` +
          `Cannot write to the database. Please check file permissions (use chmod to make it writable if needed).`;
      }

      progressService.addError(`Digest failed: ${errorMessage}`);
      progressService.completeExecution(false);
      errorService.handleError(error);

      const result = progressService.getExecutionResult();
      if (!config.dryRun && db.isOpen() && operationId !== null && result) {
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
   * Processes a single file
   */
  private async processFile(
    relativePath: string,
    rootDir: string,
    hashAlgorithm: "sha256",
    db: DatabaseService,
    existingFileMap: Map<string, { hash: string; size: number; mtime: number; last_attempted_at: number }>,
    dryRun: boolean,
  ): Promise<"added" | "updated" | "unchanged"> {
    const fullPath = path.join(rootDir, relativePath);
    const stats = fs.statSync(fullPath);
    const size = stats.size;
    const mtime = Math.floor(stats.mtimeMs);
    const ctime = Math.floor(stats.birthtimeMs || stats.ctimeMs);

    const existing = existingFileMap.get(relativePath);

    // If file is new
    if (!existing) {
      const hash = await cryptoService.hashFile(fullPath, hashAlgorithm, (bytesRead, total) => {
        const percentage = Math.floor((bytesRead / total) * 100);
        progressService.updateFileProgress(percentage, 100, relativePath);
      });

      progressService.addBytesProcessed(size);

      if (!dryRun && db.isOpen()) {
        db.upsertFile({
          relative_path: relativePath,
          size,
          created_at: ctime,
          modified_at: mtime,
          hash_sha256: hash,
          last_attempted_at: Date.now(),
          last_attempt_result: "success",
        });
      }

      return "added";
    }

    // If file exists, check if it changed
    if (existing.size !== size || existing.mtime !== mtime) {
      // Size or mtime changed, rehash
      const hash = await cryptoService.hashFile(fullPath, hashAlgorithm, (bytesRead, total) => {
        const percentage = Math.floor((bytesRead / total) * 100);
        progressService.updateFileProgress(percentage, 100, relativePath);
      });

      progressService.addBytesProcessed(size);

      if (hash !== existing.hash) {
        // Hash changed, update
        if (!dryRun && db.isOpen()) {
          db.upsertFile({
            relative_path: relativePath,
            size,
            created_at: ctime,
            modified_at: mtime,
            hash_sha256: hash,
            last_attempted_at: Date.now(),
            last_attempt_result: "success",
          });
        }
        return "updated";
      }

      // Hash same but metadata changed, update metadata only
      if (!dryRun && db.isOpen()) {
        db.upsertFile({
          relative_path: relativePath,
          size,
          created_at: ctime,
          modified_at: mtime,
          hash_sha256: hash,
          last_attempted_at: Date.now(),
          last_attempt_result: "success",
        });
      }
      return "updated";
    }

    // File unchanged - still count bytes for total
    progressService.addBytesProcessed(size);
    return "unchanged";
  }
}

export const digestService = new DigestService();

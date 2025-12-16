import { logger } from "../lib/logger.js";
import { DigestConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { discoveryService } from "./discovery-service.js";
import { cryptoService } from "./crypto-service.js";
import { uxService } from "./ux-service.js";
import { errorService } from "./error-service.js";
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
    const result = createExecutionResult("digest");
    result.filesAdded = 0;
    result.filesUpdated = 0;
    result.filesUnchanged = 0;
    result.filesDeleted = 0;

    logger.logPositive("=".repeat(80));
    logger.logPositive("Starting Digest Operation");
    logger.logPositive("=".repeat(80));
    logger.log(`Input Directory: ${config.inputDir}`);
    logger.log(`Digest File: ${config.digestFile}`);
    logger.log(`Hash Algorithm: ${config.hashAlgorithm}`);
    logger.log(`Dry Run: ${config.dryRun}`);

    const db = new DatabaseService();
    let operationId: number | null = null;

    try {
      // Open or create database
      if (config.dryRun) {
        logger.log("(digest-service)> Dry run mode - database will not be modified");
      } else {
        db.open(config.digestFile);
        operationId = db.startOperation("digest");
        logger.log("(digest-service)> Database opened successfully");
      }

      // Discover all files
      logger.log("(digest-service)> Discovering files...");
      const discoveredFiles = discoveryService.discoverFiles(config.inputDir, null, result);
      logger.logPositive(`(digest-service)> Discovered ${discoveredFiles.length} files`);

      // Get existing files from database
      const existingFileMap = new Map<string, { hash: string; size: number; mtime: number }>();

      if (!config.dryRun && db.isOpen()) {
        const existingFiles = db.getAllFiles();
        for (const file of existingFiles) {
          existingFileMap.set(file.relative_path, {
            hash: file.hash_sha256,
            size: file.size,
            mtime: file.modified_at,
          });
        }
        logger.log(`(digest-service)> Found ${existingFileMap.size} existing entries in digest`);
      }

      // Process each discovered file
      logger.log("(digest-service)> Processing files...");

      if (!config.dryRun && db.isOpen()) {
        db.beginTransaction();
      }

      try {
        for (let i = 0; i < discoveredFiles.length; i++) {
          const relativePath = discoveredFiles[i];

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
              config.dryRun
            );

            switch (status) {
              case "added":
                result.filesAdded!++;
                if (config.verbose) {
                  logger.logPositive(`(digest-service)> Added: ${relativePath}`);
                }
                break;
              case "updated":
                result.filesUpdated!++;
                if (config.verbose) {
                  logger.log(`(digest-service)> Updated: ${relativePath}`);
                }
                break;
              case "unchanged":
                result.filesUnchanged!++;
                if (config.verbose) {
                  logger.debug(`(digest-service)> Unchanged: ${relativePath}`);
                }
                break;
            }

            result.totalFilesProcessed++;
          } catch (error) {
            logger.logNegative(`(digest-service)> Error processing file: ${relativePath}`);
            addError(result, `Failed to process ${relativePath}: ${(error as Error).message}`);
            errorService.handleError(error);

            if (config.panicOnError) {
              throw error;
            }
          }
        }

        // Remove entries for files that no longer exist
        if (!config.dryRun && db.isOpen()) {
          const discoveredSet = new Set(discoveredFiles);
          for (const [relativePath] of existingFileMap) {
            if (!discoveredSet.has(relativePath)) {
              db.deleteFile(relativePath);
              result.filesDeleted!++;
              if (config.verbose) {
                logger.log(`(digest-service)> Deleted entry: ${relativePath}`);
              }
            }
          }
        }

        // Update summary
        if (!config.dryRun && db.isOpen()) {
          const now = Date.now();
          const existingSummary = db.getSummary();

          db.upsertSummary({
            total_files: discoveredFiles.length,
            total_size: result.totalBytesProcessed,
            created_at: existingSummary?.created_at || now,
            modified_at: now,
          });
        }

        if (!config.dryRun && db.isOpen()) {
          db.commitTransaction();
        }

        completeExecution(result, true);
      } catch (error) {
        if (!config.dryRun && db.isOpen()) {
          db.rollbackTransaction();
        }
        throw error;
      }

      // Complete operation log
      if (!config.dryRun && db.isOpen() && operationId !== null) {
        db.completeOperation(operationId, result.success, result.errorCount);
      }

      // Report results
      uxService.logExecutionResult(result, config.verbose);
    } catch (error) {
      logger.logNegative("(digest-service)> Digest operation failed");
      addError(result, `Digest failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

      if (!config.dryRun && db.isOpen() && operationId !== null) {
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
   * Processes a single file
   */
  private async processFile(
    relativePath: string,
    rootDir: string,
    hashAlgorithm: "sha256",
    db: DatabaseService,
    existingFileMap: Map<string, { hash: string; size: number; mtime: number }>,
    dryRun: boolean
  ): Promise<"added" | "updated" | "unchanged"> {
    const fullPath = path.join(rootDir, relativePath);
    const stats = fs.statSync(fullPath);
    const size = stats.size;
    const mtime = Math.floor(stats.mtimeMs);
    const ctime = Math.floor(stats.birthtimeMs || stats.ctimeMs);

    const existing = existingFileMap.get(relativePath);

    // If file is new
    if (!existing) {
      const hash = await cryptoService.hashFile(fullPath, hashAlgorithm);

      if (!dryRun && db.isOpen()) {
        db.upsertFile({
          relative_path: relativePath,
          size,
          created_at: ctime,
          modified_at: mtime,
          hash_sha256: hash,
        });
      }

      return "added";
    }

    // If file exists, check if it changed
    if (existing.size !== size || existing.mtime !== mtime) {
      // Size or mtime changed, rehash
      const hash = await cryptoService.hashFile(fullPath, hashAlgorithm);

      if (hash !== existing.hash) {
        // Hash changed, update
        if (!dryRun && db.isOpen()) {
          db.upsertFile({
            relative_path: relativePath,
            size,
            created_at: ctime,
            modified_at: mtime,
            hash_sha256: hash,
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
        });
      }
      return "updated";
    }

    // File unchanged
    return "unchanged";
  }
}

export const digestService = new DigestService();

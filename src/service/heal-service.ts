import { logger } from "../lib/logger.js";
import { HealConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { cryptoService } from "./crypto-service.js";
import { uxService } from "./ux-service.js";
import { errorService } from "./error-service.js";
import { joinPath } from "../utility/path-utils.js";
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

    logger.logPositive("=".repeat(80));
    logger.logPositive("Starting Heal Operation");
    logger.logPositive("=".repeat(80));
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
            config.dryRun
          );

          if (healResult.healed) {
            result.filesRecovered!++;
            result.totalBytesProcessed += digestFile.size;
            if (config.verbose) {
              logger.logPositive(`(heal-service)> Healed: ${relativePath}`);
            }
          } else if (healResult.verified) {
            result.filesVerified!++;
            if (config.verbose) {
              logger.debug(`(heal-service)> Verified: ${relativePath}`);
            }
          } else {
            result.filesRecoveryFailed!++;
            addError(result, `Failed to heal ${relativePath}: ${healResult.reason}`);
            logger.logNegative(`(heal-service)> Failed: ${relativePath} - ${healResult.reason}`);

            if (config.panicOnError) {
              throw new Error(`Heal failed: ${relativePath}`);
            }
          }

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

      // Report results
      uxService.logExecutionResult(result, config.verbose);
    } catch (error) {
      logger.logNegative("(heal-service)> Heal operation failed");
      addError(result, `Heal failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

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
    dryRun: boolean
  ): Promise<{ verified: boolean; healed: boolean; reason?: string }> {
    const targetPath = joinPath(targetDir, relativePath);

    // Check if file exists and is valid
    if (fs.existsSync(targetPath)) {
      try {
        const stats = fs.statSync(targetPath);

        // Check size
        if (stats.size === expectedSize) {
          // Check hash
          const actualHash = await cryptoService.hashFile(targetPath, hashAlgorithm);
          if (actualHash === expectedHash) {
            // File is valid, no healing needed
            return { verified: true, healed: false };
          }
        }

        logger.log(`(heal-service)> File needs healing: ${relativePath}`);
      } catch (error) {
        logger.logNegative(`(heal-service)> Error checking file: ${relativePath}`);
      }
    } else {
      logger.log(`(heal-service)> File missing: ${relativePath}`);
    }

    // File is missing or corrupted, try to recover from mirrors
    for (const mirror of mirrors) {
      const mirrorPath = joinPath(mirror.dir, relativePath);

      // Check if mirror file exists
      if (!fs.existsSync(mirrorPath)) {
        continue;
      }

      try {
        // Verify mirror integrity
        const mirrorStats = fs.statSync(mirrorPath);
        if (mirrorStats.size !== expectedSize) {
          logger.logNegative(`(heal-service)> Mirror size mismatch: ${mirrorPath}`);
          continue;
        }

        const mirrorHash = await cryptoService.hashFile(mirrorPath, hashAlgorithm);
        if (mirrorHash !== expectedHash) {
          logger.logNegative(`(heal-service)> Mirror hash mismatch: ${mirrorPath}`);
          continue;
        }

        // Mirror is valid, copy to target
        if (!dryRun) {
          // Ensure target directory exists
          const targetDirPath = path.dirname(targetPath);
          await fsPromises.mkdir(targetDirPath, { recursive: true });

          // Copy file
          await fsPromises.copyFile(mirrorPath, targetPath);

          // Verify copy
          const copiedHash = await cryptoService.hashFile(targetPath, hashAlgorithm);
          if (copiedHash !== expectedHash) {
            logger.logNegative(`(heal-service)> Copy verification failed: ${relativePath}`);
            continue;
          }
        }

        logger.logPositive(`(heal-service)> Successfully healed from mirror: ${mirror.dir}`);
        return { verified: false, healed: true };
      } catch (error) {
        logger.logNegative(`(heal-service)> Error copying from mirror ${mirrorPath}: ${(error as Error).message}`);
        continue;
      }
    }

    return { verified: false, healed: false, reason: "No valid mirror found" };
  }
}

export const healService = new HealService();

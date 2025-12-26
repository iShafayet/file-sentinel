import { logger } from "../lib/logger.js";
import { CompareConfig } from "../model/config.js";
import { ExecutionResult, createExecutionResult, completeExecution, addError } from "../model/execution-results.js";
import { DatabaseService } from "./database-service.js";
import { displayService } from "./display-service.js";
import { errorService } from "./error-service.js";
import { FileRow } from "../model/database-schema.js";
import { normalizeRelativePath } from "../utility/path-utils.js";
import fs from "fs";

/**
 * Service for comparing two digests
 */
class CompareService {
  /**
   * Executes the compare command
   */
  async execute(config: CompareConfig): Promise<ExecutionResult> {
    const result = createExecutionResult("compare");
    result.filesNew = 0;
    result.filesChanged = 0;
    result.filesDeleted = 0;

    // Enable buffering and start display
    logger.enableBuffering();
    displayService.start(config);

    logger.log("=".repeat(80));
    logger.log("Starting Compare Operation");
    logger.log("=".repeat(80));
    logger.log(`Local Digest File: ${config.localDigestFile} (source)`);
    logger.log(`Remote Digest File: ${config.remoteDigestFile} (destination)`);
    logger.log(`Dry Run: ${config.dryRun}`);

    const localDb = new DatabaseService();
    const remoteDb = new DatabaseService();

    try {
      // Validate digest files exist
      if (!fs.existsSync(config.localDigestFile)) {
        throw new Error(`Local digest file does not exist: ${config.localDigestFile}`);
      }
      if (!fs.existsSync(config.remoteDigestFile)) {
        throw new Error(`Remote digest file does not exist: ${config.remoteDigestFile}`);
      }

      // Open both databases
      localDb.open(config.localDigestFile);
      logger.log("(compare-service)> Local database opened successfully");

      remoteDb.open(config.remoteDigestFile);
      logger.log("(compare-service)> Remote database opened successfully");

      // Get all files from both databases
      const localFiles = localDb.getAllFiles();
      const remoteFiles = remoteDb.getAllFiles();

      logger.log(`(compare-service)> Found ${localFiles.length} files in local digest`);
      logger.log(`(compare-service)> Found ${remoteFiles.length} files in remote digest`);

      // Warn if one digest is empty
      if (localFiles.length === 0 && remoteFiles.length === 0) {
        logger.logNegative("(compare-service)> WARNING: Both digests are empty!");
      } else if (localFiles.length === 0) {
        logger.logNegative("(compare-service)> WARNING: Local digest is empty - all files in remote would be deleted");
      } else if (remoteFiles.length === 0) {
        logger.logNegative("(compare-service)> WARNING: Remote digest is empty - all files in local would be copied");
      }

      // Create maps for efficient lookup, normalizing paths to ensure consistent comparison
      // Paths might be stored differently (e.g., Windows vs Linux path separators)
      const localMap = new Map<string, FileRow>();
      for (const file of localFiles) {
        const normalizedPath = normalizeRelativePath(file.relative_path);
        localMap.set(normalizedPath, { ...file, relative_path: normalizedPath });
      }

      const remoteMap = new Map<string, FileRow>();
      for (const file of remoteFiles) {
        const normalizedPath = normalizeRelativePath(file.relative_path);
        remoteMap.set(normalizedPath, { ...file, relative_path: normalizedPath });
      }

      // Debug logging in verbose mode
      if (config.verbose && localFiles.length > 0 && remoteFiles.length > 0) {
        const sampleLocal = localFiles[0].relative_path;
        const sampleRemote = remoteFiles[0].relative_path;
        logger.log(`(compare-service)> local path (original): "${sampleLocal}"`);
        logger.log(`(compare-service)> local path (normalized): "${normalizeRelativePath(sampleLocal)}"`);
        logger.log(`(compare-service)> remote path (original): "${sampleRemote}"`);
        logger.log(`(compare-service)> remote path (normalized): "${normalizeRelativePath(sampleRemote)}"`);
      } else if (config.verbose && localFiles.length > 0) {
        const sampleLocal = localFiles[0].relative_path;
        logger.log(`(compare-service)> local path (original): "${sampleLocal}"`);
        logger.log(`(compare-service)> local path (normalized): "${normalizeRelativePath(sampleLocal)}"`);
      } else if (config.verbose && remoteFiles.length > 0) {
        const sampleRemote = remoteFiles[0].relative_path;
        logger.log(`(compare-service)> remote path (original): "${sampleRemote}"`);
        logger.log(`(compare-service)> remote path (normalized): "${normalizeRelativePath(sampleRemote)}"`);
      }

      // Perform comparison (predicts what replicate would do: local -> remote)
      logger.log("(compare-service)> Comparing digests...");
      this.compareReplicate(localMap, remoteMap, result, config);

      // Complete execution
      completeExecution(result, true);

      // Complete progress display
      displayService.updateTaskProgress(1, 1, "Complete");
      displayService.updateStats(result);
      displayService.stop();

      // Report results
      this.logComparisonResults(result, config);
    } catch (error) {
      logger.logNegative("(compare-service)> Compare operation failed");
      addError(result, `Compare failed: ${(error as Error).message}`);
      completeExecution(result, false);
      errorService.handleError(error);

      // Stop display on error
      displayService.stop();
    } finally {
      if (localDb.isOpen()) {
        localDb.close();
      }
      if (remoteDb.isOpen()) {
        remoteDb.close();
      }
    }

    return result;
  }

  /**
   * Compares digests to predict what a replicate operation would do (local -> remote)
   */
  private compareReplicate(
    localMap: Map<string, FileRow>,
    remoteMap: Map<string, FileRow>,
    result: ExecutionResult,
    config: CompareConfig
  ): void {
    const newFiles: string[] = [];
    const changedFiles: string[] = [];
    const deletedFiles: string[] = [];

    // Find new files (in local but not in remote)
    for (const [path, localFile] of localMap) {
      if (!remoteMap.has(path)) {
        newFiles.push(path);
        result.filesNew!++;
        if (config.verbose) {
          logger.log(`(compare-service)> New: ${path}`);
        }
      } else {
        // Check if file changed (different hash)
        const remoteFile = remoteMap.get(path)!;
        if (localFile.hash_sha256 !== remoteFile.hash_sha256) {
          changedFiles.push(path);
          result.filesChanged!++;
          if (config.verbose) {
            logger.log(
              `(compare-service)> Changed: ${path} (local: ${localFile.hash_sha256.substring(
                0,
                8
              )}..., remote: ${remoteFile.hash_sha256.substring(0, 8)}...)`
            );
          }
        }
      }
    }

    // Find deleted files (in remote but not in local)
    for (const [path] of remoteMap) {
      if (!localMap.has(path)) {
        deletedFiles.push(path);
        result.filesDeleted!++;
        if (config.verbose) {
          logger.log(`(compare-service)> Deleted: ${path}`);
        }
      }
    }

    result.totalFilesProcessed = localMap.size;

    // Log summary
    logger.log("");
    logger.log("COMPARISON RESULTS (Predicting Replicate: Local -> Remote)");
    logger.log("=".repeat(80));
    logger.log(`New Files (would be copied to remote): ${newFiles.length}`);
    logger.log(`Changed Files (would be updated in remote): ${changedFiles.length}`);
    logger.log(`Deleted Files (would be removed from remote): ${deletedFiles.length}`);
    logger.log("");

    if (newFiles.length > 0) {
      logger.log("New Files:");
      newFiles.forEach((path) => logger.log(`  + ${path}`));
      logger.log("");
    }

    if (changedFiles.length > 0) {
      logger.log("Changed Files:");
      changedFiles.forEach((path) => logger.log(`  ~ ${path}`));
      logger.log("");
    }

    if (deletedFiles.length > 0) {
      logger.log("Deleted Files:");
      deletedFiles.forEach((path) => logger.log(`  - ${path}`));
      logger.log("");
    }
  }

  /**
   * Logs the comparison results in a formatted way
   */
  private logComparisonResults(result: ExecutionResult, config: CompareConfig): void {
    displayService.logExecutionResult(result, config.verbose);
  }
}

export const compareService = new CompareService();

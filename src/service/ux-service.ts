import { ExecutionResult } from "../model/execution-results.js";
import { Command } from "../model/config.js";
import constants from "../constant/common-constants.js";
import { logger } from "../lib/logger.js";

let lastProgressLogTime = 0;

/**
 * UX service for progress reporting and result display
 */
class UxService {
  /**
   * Formats running time as HH:MM:SS
   */
  private getFormattedRunningTime(startedEpoch: number, completedEpoch?: number): string {
    const endTime = completedEpoch || Date.now();
    const runningTime = endTime - startedEpoch;
    const hours = Math.floor(runningTime / (1000 * 60 * 60));
    const minutes = Math.floor((runningTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((runningTime % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  /**
   * Formats bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Logs periodic progress updates during operation
   */
  public logProgress(executionResult: ExecutionResult): void {
    const now = Date.now();
    if (now - lastProgressLogTime < constants.UX_PROGRESS_LOG_INTERVAL_MS) {
      return;
    }
    lastProgressLogTime = now;

    const command = executionResult.command;
    const errorCount = executionResult.errorCount;
    const runningTimeString = this.getFormattedRunningTime(executionResult.startedEpoch);

    let message = "";

    switch (command) {
      case "digest":
        const digestProcessed = (executionResult.filesAdded || 0) + (executionResult.filesUpdated || 0) + (executionResult.filesUnchanged || 0);
        message = `[DIGEST] Processed: ${digestProcessed} files, Errors: ${errorCount}, Time: ${runningTimeString}`;
        break;

      case "verify":
        const verifyProcessed = (executionResult.filesVerified || 0) + (executionResult.filesFailed || 0);
        message = `[VERIFY] Verified: ${executionResult.filesVerified || 0}, Failed: ${executionResult.filesFailed || 0}, Errors: ${errorCount}, Time: ${runningTimeString}`;
        break;

      case "replicate":
        message = `[REPLICATE] Copied: ${executionResult.filesCopied || 0}, Deleted: ${executionResult.filesDeleted || 0}, Failed: ${executionResult.filesRecoveryFailed || 0}, Errors: ${errorCount}, Time: ${runningTimeString}`;
        break;

      case "heal":
        message = `[HEAL] Healed: ${executionResult.filesRecovered || 0}, Verified: ${executionResult.filesVerified || 0}, Failed: ${executionResult.filesRecoveryFailed || 0}, Errors: ${errorCount}, Time: ${runningTimeString}`;
        break;
    }

    logger.log(message);
  }

  /**
   * Logs final execution result
   */
  public logExecutionResult(executionResult: ExecutionResult, verbose: boolean): void {
    const runningTime = this.getFormattedRunningTime(executionResult.startedEpoch, executionResult.completedEpoch);
    const bytesProcessed = this.formatBytes(executionResult.totalBytesProcessed);

    logger.logPositive("=".repeat(80));
    logger.logPositive(`${executionResult.command.toUpperCase()} Operation ${executionResult.success ? "COMPLETED" : "FAILED"}`);
    logger.logPositive("=".repeat(80));

    // Common stats
    logger.log(`Total Files Processed: ${executionResult.totalFilesProcessed}`);
    logger.log(`Total Bytes Processed: ${bytesProcessed}`);
    logger.log(`Execution Time: ${runningTime}`);
    logger.log(`Errors: ${executionResult.errorCount}`);

    // Command-specific stats
    switch (executionResult.command) {
      case "digest":
        logger.log(`Files Added: ${executionResult.filesAdded || 0}`);
        logger.log(`Files Updated: ${executionResult.filesUpdated || 0}`);
        logger.log(`Files Unchanged: ${executionResult.filesUnchanged || 0}`);
        logger.log(`Files Deleted: ${executionResult.filesDeleted || 0}`);
        break;

      case "verify":
        logger.log(`Files Verified: ${executionResult.filesVerified || 0}`);
        logger.log(`Files Failed: ${executionResult.filesFailed || 0}`);
        logger.log(`Files Missing: ${executionResult.filesMissing || 0}`);
        logger.log(`Files Extra: ${executionResult.filesExtra || 0}`);
        break;

      case "replicate":
        logger.log(`Files Copied: ${executionResult.filesCopied || 0}`);
        logger.log(`Files Deleted: ${executionResult.filesDeleted || 0}`);
        logger.log(`Files Recovery Failed: ${executionResult.filesRecoveryFailed || 0}`);
        break;

      case "heal":
        logger.log(`Files Healed: ${executionResult.filesRecovered || 0}`);
        logger.log(`Files Verified: ${executionResult.filesVerified || 0}`);
        logger.log(`Files Recovery Failed: ${executionResult.filesRecoveryFailed || 0}`);
        break;
    }

    // Show errors if any
    if (executionResult.errors.length > 0 && verbose) {
      logger.logNegative("\nErrors encountered:");
      executionResult.errors.forEach((error, index) => {
        logger.logNegative(`  ${index + 1}. ${error}`);
      });
    } else if (executionResult.errors.length > 0) {
      logger.logNegative(`\n${executionResult.errors.length} errors encountered. Run with --verbose to see details.`);
    }

    logger.logPositive("=".repeat(80));

    if (executionResult.success) {
      logger.logPositive("✓ Operation completed successfully");
    } else {
      logger.logNegative("✗ Operation completed with errors");
    }

    logger.logPositive("=".repeat(80));
  }
}

export const uxService = new UxService();

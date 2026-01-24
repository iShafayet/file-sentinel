import { Config, Command } from "../model/config.js";
import { ExecutionResult } from "../model/execution-results.js";
import { displayService } from "./display-service.js";
import { logger } from "../lib/logger.js";
import { isTTY } from "../utility/terminal-utils.js";
import { truncatePathIfNotVerbose } from "../utility/path-utils.js";

/**
 * Progress service - High-level interface for progress tracking
 * This service acts as an intermediary between business logic services
 * and the display service, keeping display logic separated.
 * It also maintains the ExecutionResult state.
 */
class ProgressService {
  private executionResult: ExecutionResult | null = null;
  private lastNonTtyTaskLog: number = 0;
  private lastNonTtyFileLog: number = 0;
  private config: Config | null = null;

  /**
   * Starts progress tracking for an operation
   * Creates and initializes the ExecutionResult
   */
  public start(config: Config): void {
    this.config = config;
    this.executionResult = {
      command: config.command,
      success: false,
      startedEpoch: Date.now(),
      completedEpoch: 0,
      totalFilesProcessed: 0,
      totalBytesProcessed: 0,
      errorCount: 0,
      errors: [],
    };

    // Initialize command-specific fields
    switch (config.command) {
      case "digest":
        this.executionResult.filesAdded = 0;
        this.executionResult.filesUpdated = 0;
        this.executionResult.filesUnchanged = 0;
        this.executionResult.filesDeleted = 0;
        break;
      case "verify":
        this.executionResult.filesVerified = 0;
        this.executionResult.filesFailed = 0;
        this.executionResult.filesMissing = 0;
        this.executionResult.filesExtra = 0;
        break;
      case "replicate":
        this.executionResult.filesCopied = 0;
        this.executionResult.filesDeleted = 0;
        this.executionResult.filesRecoveryFailed = 0;
        break;
      case "heal":
        this.executionResult.filesVerified = 0;
        this.executionResult.filesRecovered = 0;
        this.executionResult.filesRecoveryFailed = 0;
        break;
      case "compare":
        this.executionResult.filesToBeCreated = 0;
        this.executionResult.filesToBeUpdated = 0;
        this.executionResult.filesToBeDeleted = 0;
        break;
    }

    // Handle non-TTY logging
    if (!isTTY() || config.noTty) {
      let directory = "";
      if (
        config.command === "digest" ||
        config.command === "verify" ||
        config.command === "heal" ||
        config.command === "compare"
      ) {
        directory = (config as any).inputDir || "";
      } else if (config.command === "replicate") {
        directory = (config as any).sourceDir || "";
      }
      logger.log(`Starting ${config.command} command on ${directory}`);
    }

    displayService.start(config);

    // Initialize stats display with the execution result
    this.updateStats();
  }

  /**
   * Stops progress tracking and displays final stats
   */
  public stop(): void {
    displayService.stop();
  }

  /**
   * Updates overall task progress
   * @param current - Current number of items processed
   * @param total - Total number of items to process
   * @param label - Optional label describing the current task
   */
  public updateTaskProgress(current: number, total: number, label?: string): void {
    // Handle non-TTY logging
    if (!isTTY()) {
      const now = Date.now();
      if (!this.lastNonTtyTaskLog || now - this.lastNonTtyTaskLog > 5000) {
        logger.log(`(progress-service)> Task progress: ${current}/${total} ${label || ""}`);
        this.lastNonTtyTaskLog = now;
      }
    }
    displayService.updateTaskProgress(current, total, label);
  }

  /**
   * Updates current file progress
   * @param current - Current progress (0-100 or bytes processed)
   * @param total - Total progress (100 or total bytes)
   * @param fileName - Optional file name being processed
   */
  public updateFileProgress(current: number, total: number, fileName?: string): void {
    // Handle non-TTY logging
    if (!isTTY()) {
      const now = Date.now();
      if (!this.lastNonTtyFileLog || now - this.lastNonTtyFileLog > 5000) {
        logger.log(`(progress-service)> File progress: ${current}/${total} ${fileName || ""}`);
        this.lastNonTtyFileLog = now;
      }
    }
    displayService.updateFileProgress(current, total, fileName);
  }

  /**
   * Updates statistics display with current execution result
   */
  public updateStats(): void {
    if (this.executionResult) {
      displayService.updateStats(this.executionResult);
    }
  }

  /**
   * Gets the current execution result
   */
  public getExecutionResult(): ExecutionResult | null {
    return this.executionResult;
  }

  /**
   * Adds bytes to the total bytes processed
   */
  public addBytesProcessed(bytes: number): void {
    if (this.executionResult) {
      this.executionResult.totalBytesProcessed += bytes;
      this.updateStats();
    }
  }

  /**
   * Increments total files processed
   */
  public incrementTotalFilesProcessed(): void {
    if (this.executionResult) {
      this.executionResult.totalFilesProcessed++;
      this.updateStats();
    }
  }

  /**
   * Adds an error to the execution result
   */
  public addError(error: string): void {
    if (this.executionResult) {
      this.executionResult.errors.push(error);
      this.executionResult.errorCount++;
      this.updateStats();
    }
  }

  /**
   * Marks execution as complete
   */
  public completeExecution(success: boolean): void {
    if (this.executionResult) {
      this.executionResult.completedEpoch = Date.now();
      this.executionResult.success = success;
      this.updateStats();
    }
  }

  // Digest-specific methods
  public incrementFilesAdded(): void {
    if (this.executionResult) {
      this.executionResult.filesAdded = (this.executionResult.filesAdded || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesUpdated(): void {
    if (this.executionResult) {
      this.executionResult.filesUpdated = (this.executionResult.filesUpdated || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesUnchanged(): void {
    if (this.executionResult) {
      this.executionResult.filesUnchanged = (this.executionResult.filesUnchanged || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesDeleted(): void {
    if (this.executionResult) {
      this.executionResult.filesDeleted = (this.executionResult.filesDeleted || 0) + 1;
      this.updateStats();
    }
  }

  // Verify-specific methods
  public incrementFilesVerified(): void {
    if (this.executionResult) {
      this.executionResult.filesVerified = (this.executionResult.filesVerified || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesFailed(): void {
    if (this.executionResult) {
      this.executionResult.filesFailed = (this.executionResult.filesFailed || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesMissing(): void {
    if (this.executionResult) {
      this.executionResult.filesMissing = (this.executionResult.filesMissing || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesExtra(): void {
    if (this.executionResult) {
      this.executionResult.filesExtra = (this.executionResult.filesExtra || 0) + 1;
      this.updateStats();
    }
  }

  // Replicate-specific methods
  public incrementFilesCopied(): void {
    if (this.executionResult) {
      this.executionResult.filesCopied = (this.executionResult.filesCopied || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesRecoveryFailed(): void {
    if (this.executionResult) {
      this.executionResult.filesRecoveryFailed = (this.executionResult.filesRecoveryFailed || 0) + 1;
      this.updateStats();
    }
  }

  // Heal-specific methods
  public incrementFilesRecovered(): void {
    if (this.executionResult) {
      this.executionResult.filesRecovered = (this.executionResult.filesRecovered || 0) + 1;
      this.updateStats();
    }
  }

  // Compare-specific methods
  public incrementFilesToBeCreated(): void {
    if (this.executionResult) {
      this.executionResult.filesToBeCreated = (this.executionResult.filesToBeCreated || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesToBeUpdated(): void {
    if (this.executionResult) {
      this.executionResult.filesToBeUpdated = (this.executionResult.filesToBeUpdated || 0) + 1;
      this.updateStats();
    }
  }

  public incrementFilesToBeDeleted(): void {
    if (this.executionResult) {
      this.executionResult.filesToBeDeleted = (this.executionResult.filesToBeDeleted || 0) + 1;
      this.updateStats();
    }
  }

  /**
   * Starts file discovery mode
   */
  public startDiscovery(): void {
    if (!isTTY()) {
      logger.log("Starting file discovery...");
    }
    displayService.startDiscovery();
  }

  /**
   * Updates discovery progress
   * @param fileCount - Number of files discovered so far
   * @param currentDir - Current directory being scanned
   */
  public updateDiscoveryProgress(fileCount: number, currentDir: string): void {
    // Handle non-TTY logging
    if (!isTTY()) {
      const truncatedDir = truncatePathIfNotVerbose(currentDir, 50, this.config?.verbose ?? false);
      logger.log(`Scanning: ${truncatedDir} | Found: ${fileCount.toLocaleString()}`);
    }
    displayService.updateDiscoveryProgress(fileCount, currentDir);
  }

  /**
   * Stops file discovery mode
   */
  public stopDiscovery(): void {
    displayService.stopDiscovery();
  }

  /**
   * Logs final execution result
   * @param verbose - Whether to show verbose details
   */
  public logExecutionResult(verbose: boolean): void {
    if (!this.executionResult) return;

    const CONSOLE_WIDTH = 80;
    const runningTime = this.getFormattedRunningTime(
      this.executionResult.startedEpoch,
      this.executionResult.completedEpoch,
    );
    const bytesProcessed = this.formatBytes(this.executionResult.totalBytesProcessed);

    logger.log("=".repeat(CONSOLE_WIDTH));
    logger.log(
      `${this.executionResult.command.toUpperCase()} Operation ${this.executionResult.success ? "COMPLETED" : "FAILED"}`,
    );
    logger.log("=".repeat(CONSOLE_WIDTH));

    // Common stats
    logger.log(`Total Files Processed: ${this.executionResult.totalFilesProcessed}`);
    logger.log(`Total Bytes Processed: ${bytesProcessed}`);
    logger.log(`Execution Time: ${runningTime}`);
    logger.log(`Errors: ${this.executionResult.errorCount}`);

    // Command-specific stats
    switch (this.executionResult.command) {
      case "digest":
        logger.log(`Files Added: ${this.executionResult.filesAdded || 0}`);
        logger.log(`Files Updated: ${this.executionResult.filesUpdated || 0}`);
        logger.log(`Files Unchanged: ${this.executionResult.filesUnchanged || 0}`);
        logger.log(`Files Deleted: ${this.executionResult.filesDeleted || 0}`);
        break;

      case "verify":
        logger.log(`Files Verified: ${this.executionResult.filesVerified || 0}`);
        logger.log(`Files Failed: ${this.executionResult.filesFailed || 0}`);
        logger.log(`Files Missing: ${this.executionResult.filesMissing || 0}`);
        logger.log(`Files Extra: ${this.executionResult.filesExtra || 0}`);
        break;

      case "replicate":
        logger.log(`Files Copied: ${this.executionResult.filesCopied || 0}`);
        logger.log(`Files Deleted: ${this.executionResult.filesDeleted || 0}`);
        logger.log(`Files Recovery Failed: ${this.executionResult.filesRecoveryFailed || 0}`);
        break;

      case "heal":
        logger.log(`Files Healed: ${this.executionResult.filesRecovered || 0}`);
        logger.log(`Files Verified: ${this.executionResult.filesVerified || 0}`);
        logger.log(`Files Recovery Failed: ${this.executionResult.filesRecoveryFailed || 0}`);
        break;

      case "compare":
        logger.log(`Files To Be Created: ${this.executionResult.filesToBeCreated || 0}`);
        logger.log(`Files To Be Updated: ${this.executionResult.filesToBeUpdated || 0}`);
        logger.log(`Files To Be Deleted: ${this.executionResult.filesToBeDeleted || 0}`);
        break;
    }

    // Show errors if any
    if (this.executionResult.errors.length > 0 && verbose) {
      logger.logNegative("\nErrors encountered:");
      this.executionResult.errors.forEach((error, index) => {
        logger.logNegative(`  ${index + 1}. ${error}`);
      });
    } else if (this.executionResult.errors.length > 0) {
      logger.logNegative(
        `\n${this.executionResult.errors.length} errors encountered. Run with --verbose to see details.`,
      );
    }

    logger.log("=".repeat(CONSOLE_WIDTH));

    if (this.executionResult.success) {
      logger.log("Operation completed successfully");
    } else {
      logger.logNegative("Operation completed with errors");
    }

    logger.log("=".repeat(CONSOLE_WIDTH));
  }

  /**
   * Formats running time as HH:MM:SS
   */
  private getFormattedRunningTime(startedEpoch: number, completedEpoch?: number): string {
    const endTime = completedEpoch || Date.now();
    const totalSeconds = Math.floor((endTime - startedEpoch) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  /**
   * Formats bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Stops display and shows buffered logs
   * @param waitForKeyPress - Whether to wait for user keypress before showing logs
   */
  public async stopDisplayIfActiveAndShowLogsIfBuffered({
    waitForKeyPress,
  }: {
    waitForKeyPress: boolean;
  }): Promise<void> {
    if (isTTY()) {
      return await displayService.stopDisplayAndShowLogs({ waitForKeyPress });
    }

    // It's unlikely to have buffered logs in non-TTY mode, but to future-proof, we flush them anyway.
    logger.flushBufferedLogs();
  }
}

export const progressService = new ProgressService();

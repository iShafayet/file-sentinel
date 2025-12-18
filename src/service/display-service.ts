import cliProgress from "cli-progress";
import { ExecutionResult } from "../model/execution-results.js";
import { Command } from "../model/config.js";
import { logger } from "../lib/logger.js";
import * as readline from "readline";
import { isTTY, isStdinTTY } from "../utility/terminal-utils.js";

/**
 * Display service for managing in-place UI updates and progress display
 */
class DisplayService {
  private multibar: cliProgress.MultiBar | null = null;
  private taskBar: cliProgress.SingleBar | null = null;
  private fileBar: cliProgress.SingleBar | null = null;
  private statsLines: string[] = [];
  private isActive = false;
  private title = "";
  private command = "";
  private directory = "";
  private discoveryInterval: NodeJS.Timeout | null = null;
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private spinnerIndex = 0;
  private discoveryMode = false;
  private discoveryBar: cliProgress.SingleBar | null = null;

  /**
   * Initializes the display with title, command, and directory info
   */
  public start(command: Command, directory: string): void {
    this.isActive = true;
    this.command = command.toUpperCase();
    this.directory = directory;
    this.title = "FILE SENTINEL";

    // Only show UI elements if in TTY mode
    if (!isTTY()) {
      // Non-TTY mode: just log the basic info
      logger.log(`Starting ${this.command} command on ${this.directory}`);
      return;
    }

    // Clear screen and show header
    console.clear();
    this.printHeader();

    // Create multibar for progress tracking
    this.multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format: (options: any, params: any, payload: any) => {
          // Custom format for discovery mode
          if (payload.spinner !== undefined) {
            return `${payload.spinner} Discovering files | Scanning: ${payload.directory} | Found: ${payload.count}`;
          }
          // Normal progress bar format
          const percentage = Math.round(params.progress * 100);
          const bar = options.barCompleteString.substr(0, Math.round(params.progress * options.barsize));
          const incomplete = options.barIncompleteString.substr(0, options.barsize - bar.length);
          return `${bar}${incomplete} | ${percentage}% | ${payload.label}: ${params.value}/${params.total}`;
        },
        barCompleteChar: "\u2588",
        barIncompleteChar: "\u2591",
        stopOnComplete: true,
      },
      cliProgress.Presets.shades_classic
    );

    // Create task progress bar
    this.taskBar = this.multibar.create(100, 0, { label: "Overall Progress" });

    // Create file progress bar
    this.fileBar = this.multibar.create(100, 0, { label: "Current File" });

    // Initialize stats
    this.statsLines = [];
  }

  /**
   * Prints the header section
   */
  private printHeader(): void {
    console.log("═".repeat(80));
    console.log(`  ${this.title}`);
    console.log("═".repeat(80));
    console.log(`  Command: ${this.command}`);
    console.log(`  Directory: ${this.directory}`);
    console.log("─".repeat(80));
  }

  /**
   * Updates task progress
   */
  public updateTaskProgress(current: number, total: number, label?: string): void {
    if (!this.taskBar || !this.isActive) return;

    const percentage = total > 0 ? Math.floor((current / total) * 100) : 0;
    this.taskBar.update(percentage, {
      label: label || "Overall Progress",
      value: current,
      total: total,
    });
  }

  /**
   * Updates current file progress
   */
  public updateFileProgress(current: number, total: number, fileName?: string): void {
    if (!this.fileBar || !this.isActive) return;

    const percentage = total > 0 ? Math.floor((current / total) * 100) : 0;
    const displayName = fileName ? this.truncateFileName(fileName, 40) : "Processing...";
    this.fileBar.update(percentage, {
      label: displayName,
      value: current,
      total: total,
    });
  }

  /**
   * Updates statistics display
   */
  public updateStats(executionResult: ExecutionResult): void {
    if (!this.isActive) return;

    const stats: string[] = [];
    const runningTime = this.getFormattedRunningTime(executionResult.startedEpoch, executionResult.completedEpoch);
    const errorCount = executionResult.errorCount;

    // Add stats based on command type
    switch (executionResult.command) {
      case "digest":
        const digestProcessed =
          (executionResult.filesAdded || 0) +
          (executionResult.filesUpdated || 0) +
          (executionResult.filesUnchanged || 0);
        stats.push(`Files Processed: ${digestProcessed}`);
        stats.push(`  Added: ${executionResult.filesAdded || 0}`);
        stats.push(`  Updated: ${executionResult.filesUpdated || 0}`);
        stats.push(`  Unchanged: ${executionResult.filesUnchanged || 0}`);
        stats.push(`  Deleted: ${executionResult.filesDeleted || 0}`);
        break;

      case "verify":
        stats.push(`Files Verified: ${executionResult.filesVerified || 0}`);
        stats.push(`Files Failed: ${executionResult.filesFailed || 0}`);
        stats.push(`Files Missing: ${executionResult.filesMissing || 0}`);
        stats.push(`Files Extra: ${executionResult.filesExtra || 0}`);
        break;

      case "replicate":
        stats.push(`Files Copied: ${executionResult.filesCopied || 0}`);
        stats.push(`Files Deleted: ${executionResult.filesDeleted || 0}`);
        stats.push(`Files Failed: ${executionResult.filesRecoveryFailed || 0}`);
        break;

      case "heal":
        stats.push(`Files Healed: ${executionResult.filesRecovered || 0}`);
        stats.push(`Files Verified: ${executionResult.filesVerified || 0}`);
        stats.push(`Files Failed: ${executionResult.filesRecoveryFailed || 0}`);
        break;
    }

    stats.push(`Errors: ${errorCount}`);
    stats.push(`Running Time: ${runningTime}`);
    stats.push(`Data Processed: ${this.formatBytes(executionResult.totalBytesProcessed)}`);

    this.statsLines = stats;
    this.refreshStats();
  }

  /**
   * Refreshes the stats display area
   */
  private refreshStats(): void {
    if (!this.isActive) return;

    // Note: cli-progress automatically manages the display area
    // Stats will be shown after stopping the multibar
  }

  /**
   * Starts discovery mode - shows spinner with progress bar
   */
  public startDiscovery(): void {
    if (!this.isActive || !this.multibar) return;

    this.discoveryMode = true;

    // Create a discovery bar with custom format
    this.discoveryBar = this.multibar.create(1, 0, {
      spinner: this.spinnerFrames[0],
      directory: "Initializing...",
      count: "0",
    });

    // Start spinner animation
    this.spinnerIndex = 0;
    this.discoveryInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      // Update spinner frame
      if (this.discoveryBar) {
        this.discoveryBar.update(0, {
          spinner: this.spinnerFrames[this.spinnerIndex],
        });
      }
    }, 80); // Update every 80ms for smooth animation
  }

  /**
   * Updates discovery progress with spinner, current directory, and file count
   */
  public updateDiscoveryProgress(fileCount: number, currentDir: string): void {
    if (!this.isActive || !this.discoveryMode || !this.discoveryBar) return;

    const truncatedDir = this.truncateFileName(currentDir, 45);

    // Update discovery bar with current info
    this.discoveryBar.update(0, {
      spinner: this.spinnerFrames[this.spinnerIndex],
      directory: truncatedDir,
      count: fileCount.toLocaleString(),
    });
  }

  /**
   * Stops discovery mode and prepares for normal progress display
   */
  public stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    // Remove discovery bar
    if (this.discoveryBar && this.multibar) {
      this.multibar.remove(this.discoveryBar);
      this.discoveryBar = null;
    }

    this.discoveryMode = false;
  }

  /**
   * Stops the display and shows final stats
   */
  public stop(): void {
    if (!this.isActive) return;

    // Stop discovery spinner if running
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    // Stop all progress bars
    if (this.multibar) {
      this.multibar.stop();
    }

    // Display final stats (only in TTY mode)
    if (isTTY()) {
      console.log("─".repeat(80));
      console.log("SUMMARY:");
      this.statsLines.forEach((line) => console.log(`  ${line}`));
      console.log("═".repeat(80));
    }

    this.isActive = false;
  }

  /**
   * Waits for user to press any key and then displays buffered logs
   */
  public async waitForKeyPressAndShowLogs(): Promise<void> {
    const bufferedLogCount = logger.getBufferedLogCount();

    if (bufferedLogCount === 0) {
      return;
    }

    // Skip keypress wait if not in TTY mode (e.g., in tests, CI, or piped output)
    // Check if we're in TTY mode - if not, auto-flush
    if (!isTTY()) {
      // In non-interactive mode, just show the logs automatically
      console.log("\n");
      logger.flushBufferedLogs();
      return;
    }

    console.log("\n");
    console.log(`${bufferedLogCount} log entries captured during operation.`);
    console.log("Press any key to view detailed logs, or Ctrl+C to exit...");

    return new Promise((resolve) => {
      // Set raw mode to capture single keypress
      readline.emitKeypressEvents(process.stdin);
      if (isStdinTTY()) {
        process.stdin.setRawMode(true);
      }

      const onKeyPress = () => {
        // Restore normal mode
        if (isStdinTTY()) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener("keypress", onKeyPress);
        process.stdin.pause();

        // Flush and display logs
        logger.flushBufferedLogs();
        resolve();
      };

      process.stdin.on("keypress", onKeyPress);
      process.stdin.resume();
    });
  }

  /**
   * Checks if display is active
   */
  public isDisplayActive(): boolean {
    return this.isActive;
  }

  /**
   * Logs final execution result
   */
  public logExecutionResult(executionResult: ExecutionResult, verbose: boolean): void {
    const runningTime = this.getFormattedRunningTime(executionResult.startedEpoch, executionResult.completedEpoch);
    const bytesProcessed = this.formatBytes(executionResult.totalBytesProcessed);

    logger.log("=".repeat(80));
    logger.log(
      `${executionResult.command.toUpperCase()} Operation ${executionResult.success ? "COMPLETED" : "FAILED"}`
    );
    logger.log("=".repeat(80));

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

    logger.log("=".repeat(80));

    if (executionResult.success) {
      logger.log("Operation completed successfully");
    } else {
      logger.logNegative("Operation completed with errors");
    }

    logger.log("=".repeat(80));
  }

  /**
   * Formats running time as HH:MM:SS
   */
  private getFormattedRunningTime(startedEpoch: number, completedEpoch?: number): string {
    const endTime = completedEpoch || Date.now();
    const runningTime = endTime - startedEpoch;
    const hours = Math.floor(runningTime / (1000 * 60 * 60));
    const minutes = Math.floor((runningTime % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((runningTime % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
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
   * Truncates file name to fit display
   */
  private truncateFileName(fileName: string, maxLength: number): string {
    if (fileName.length <= maxLength) return fileName;
    const ellipsis = "...";
    const partLength = Math.floor((maxLength - ellipsis.length) / 2);
    return fileName.substring(0, partLength) + ellipsis + fileName.substring(fileName.length - partLength);
  }
}

export const displayService = new DisplayService();

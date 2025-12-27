import { ExecutionResult } from "../model/execution-results.js";
import { Config } from "../model/config.js";
import { isTTY, isStdinTTY } from "../utility/terminal-utils.js";
import { logger } from "../lib/logger.js";
import { getVersion } from "../utility/misc-utils.js";
import * as path from "path";
// @ts-ignore - neo-blessed doesn't have types
import blessed from "neo-blessed";

const CONSOLE_WIDTH = 80;
const MAX_FILE_NAME_LENGTH = 50;

// Data rate tracking
interface DataRateTracker {
  bytesProcessed: number;
  startTime: number;
  lastUpdateTime: number;
  lastBytesProcessed: number;
  currentRate: number; // bytes per second
}

/**
 * Display service for managing professional TUI with split-pane layout
 */
class DisplayService {
  private screen: blessed.Widgets.Screen | null = null;
  private logBox: blessed.Widgets.Log | null = null;
  private statsLeftBox: blessed.Widgets.Box | null = null;
  private statsRightBox: blessed.Widgets.Box | null = null;
  private isActive = false;
  private title = "";
  private command = "";
  private directory = "";
  private config: Config | null = null;
  private discoveryMode = false;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private spinnerIndex = 0;

  // Progress tracking
  private totalFiles = 0;
  private processedFiles = 0;
  private currentFileName = "";
  private executionResult: ExecutionResult | null = null;

  // Data rate tracking
  private dataRateTracker: DataRateTracker = {
    bytesProcessed: 0,
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
    lastBytesProcessed: 0,
    currentRate: 0,
  };

  // Update interval for stats refresh
  private statsUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the display with title, command, and directory info
   */
  public start(config: Config): void {
    this.isActive = true;
    this.config = config;
    this.command = config.command.toUpperCase();

    // Determine directory based on command type
    switch (config.command) {
      case "digest":
      case "verify":
      case "heal":
        this.directory = config.inputDir;
        break;
      case "replicate":
        this.directory = config.sourceDir;
        break;
    }

    this.title = "FILE SENTINEL";

    // Only show UI elements if in TTY mode
    if (!isTTY() || config.noTty) {
      // Non-TTY mode: logging is handled by ProgressService
      return;
    }

    this.initializeBlessedUI();

    // Register logger callback to stream logs to display
    logger.setLogStreamCallback((level: string, message: string) => {
      this.addLogToLogPane(level, message);
    });
  }

  /**
   * Initialize the blessed UI with horizontal split-pane layout
   */
  private initializeBlessedUI(): void {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: "File Sentinel",
    });

    // Handle exit
    this.screen.key(["escape", "q", "C-c"], () => {
      this.cleanup();
      return process.exit(0);
    });

    // Create title bar with background color
    const version = getVersion();
    const titleBar = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: 1,
      content: ` File Sentinel v${version} `,
      tags: true,
      style: {
        fg: "white",
        bg: "blue",
        bold: true,
      },
    });

    // Create stats area on top (horizontal split: two columns)
    // Left column for stats
    const statsLeftBox = blessed.box({
      top: 1,
      left: 0,
      width: "50%",
      height: "40%",
      label: " {bold}Metrics{/bold} ",
      content: "",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "green",
        },
      },
    });

    // Right column for stats
    const statsRightBox = blessed.box({
      top: 1,
      left: "50%",
      width: "50%",
      height: "40%",
      label: " {bold}Status{/bold} ",
      content: "",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "green",
        },
      },
    });

    // Create logs area on bottom
    const logBox = blessed.log({
      top: "41%",
      left: 0,
      width: "100%",
      height: "100%-41%",
      label: " {bold}Logs{/bold} ",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "blue",
        },
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: {
          bg: "black",
        },
        style: {
          bg: "blue",
        },
      },
    });

    this.logBox = logBox;
    this.statsLeftBox = statsLeftBox;
    this.statsRightBox = statsRightBox;

    // Append to screen
    this.screen.append(titleBar);
    this.screen.append(statsLeftBox);
    this.screen.append(statsRightBox);
    this.screen.append(logBox);

    // Initialize data rate tracker
    this.dataRateTracker = {
      bytesProcessed: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      lastBytesProcessed: 0,
      currentRate: 0,
    };

    // Start stats update interval (update every 500ms for smooth rate display)
    this.statsUpdateInterval = setInterval(() => {
      this.updateStatsDisplay();
    }, 500);

    // Initial render
    this.screen.render();

    // Log initial message
    this.addLogToLogPane("System", `Starting ${this.command} operation...`);
  }

  /**
   * Add a log entry to the log pane
   */
  private addLogToLogPane(level: string, message: string): void {
    if (!this.logBox || !this.screen) return;

    try {
      const timestamp = new Date().toLocaleTimeString();
      const logLine = `[${timestamp}] ${level}: ${message}`;
      this.logBox.log(logLine);
      this.screen.render();
    } catch (error) {
      // Silently fail if UI is not available
    }
  }

  /**
   * Update the stats display in two columns
   */
  private updateStatsDisplay(): void {
    if (!this.statsLeftBox || !this.statsRightBox) return;

    const leftStats: string[] = [];
    const rightStats: string[] = [];

    // If no execution result yet, show basic info
    if (!this.executionResult) {
      leftStats.push(`{bold}Progress{/bold}`);
      leftStats.push(`  Files: ${this.processedFiles}/${this.totalFiles}`);
      leftStats.push(`  Remaining: ${Math.max(0, this.totalFiles - this.processedFiles)}`);
      leftStats.push("");
      leftStats.push(`{bold}Data Rate{/bold}`);
      leftStats.push(`  0.00 MiB/s`);

      rightStats.push(`{bold}Status{/bold}`);
      rightStats.push(`  Initializing...`);

      if (this.currentFileName) {
        rightStats.push("");
        rightStats.push(`{bold}Current File{/bold}`);
        const truncated = this.truncateFileName(this.currentFileName, MAX_FILE_NAME_LENGTH);
        rightStats.push(`  {dim}${truncated}{/dim}`);
      }

      this.statsLeftBox.setContent(leftStats.join("\n"));
      this.statsRightBox.setContent(rightStats.join("\n"));
      this.screen?.render();
      return;
    }

    // Calculate data rate
    const now = Date.now();
    const timeElapsed = (now - this.dataRateTracker.lastUpdateTime) / 1000; // seconds
    if (timeElapsed > 0.1) {
      // Update rate every 100ms minimum
      const bytesDelta = this.dataRateTracker.bytesProcessed - this.dataRateTracker.lastBytesProcessed;
      this.dataRateTracker.currentRate = bytesDelta / timeElapsed;
      this.dataRateTracker.lastUpdateTime = now;
      this.dataRateTracker.lastBytesProcessed = this.dataRateTracker.bytesProcessed;
    }

    const dataRateMiB = this.dataRateTracker.currentRate / (1024 * 1024);
    const dataRateStr = dataRateMiB > 0 ? dataRateMiB.toFixed(2) : "0.00";

    // Warning icon for errors
    const warningIcon = this.executionResult.errorCount > 0 ? "⚠ " : "";
    const hasErrors = this.executionResult.errorCount > 0;

    // Left column: Progress and Data metrics
    leftStats.push(`{bold}Progress{/bold}`);
    leftStats.push(`  Files: ${this.processedFiles}/${this.totalFiles}`);
    leftStats.push(`  Remaining: ${Math.max(0, this.totalFiles - this.processedFiles)}`);
    leftStats.push("");
    leftStats.push(`{bold}Data Rate{/bold}`);
    leftStats.push(`  ${dataRateStr} MiB/s`);
    leftStats.push("");
    leftStats.push(`{bold}Data Processed{/bold}`);
    leftStats.push(`  ${this.formatBytes(this.executionResult.totalBytesProcessed)}`);

    // Right column: Status and Command-specific stats
    rightStats.push(`{bold}Status{/bold}`);
    if (hasErrors) {
      rightStats.push(`  ${warningIcon}{red-fg}Errors: ${this.executionResult.errorCount}{/red-fg}`);
    } else {
      rightStats.push(`  Errors: ${this.executionResult.errorCount}`);
    }
    rightStats.push("");
    rightStats.push(`{bold}Running Time{/bold}`);
    const runningTime = this.getFormattedRunningTime(
      this.executionResult.startedEpoch,
      this.executionResult.completedEpoch || Date.now()
    );
    rightStats.push(`  ${runningTime}`);
    rightStats.push("");

    // Command-specific stats
    switch (this.executionResult.command) {
      case "digest":
        rightStats.push(`{bold}Digest Stats{/bold}`);
        rightStats.push(`  Added: ${this.executionResult.filesAdded || 0}`);
        rightStats.push(`  Updated: ${this.executionResult.filesUpdated || 0}`);
        rightStats.push(`  Unchanged: ${this.executionResult.filesUnchanged || 0}`);
        rightStats.push(`  Deleted: ${this.executionResult.filesDeleted || 0}`);
        break;
      case "verify":
        rightStats.push(`{bold}Verify Stats{/bold}`);
        rightStats.push(`  Verified: ${this.executionResult.filesVerified || 0}`);
        rightStats.push(`  Failed: ${this.executionResult.filesFailed || 0}`);
        rightStats.push(`  Missing: ${this.executionResult.filesMissing || 0}`);
        rightStats.push(`  Extra: ${this.executionResult.filesExtra || 0}`);
        break;
      case "replicate":
        rightStats.push(`{bold}Replicate Stats{/bold}`);
        rightStats.push(`  Copied: ${this.executionResult.filesCopied || 0}`);
        rightStats.push(`  Deleted: ${this.executionResult.filesDeleted || 0}`);
        rightStats.push(`  Failed: ${this.executionResult.filesRecoveryFailed || 0}`);
        break;
      case "heal":
        rightStats.push(`{bold}Heal Stats{/bold}`);
        rightStats.push(`  Healed: ${this.executionResult.filesRecovered || 0}`);
        rightStats.push(`  Verified: ${this.executionResult.filesVerified || 0}`);
        rightStats.push(`  Failed: ${this.executionResult.filesRecoveryFailed || 0}`);
        break;
      case "compare":
        rightStats.push(`{bold}Compare Stats{/bold}`);
        rightStats.push(`  To be Created: ${this.executionResult.filesToBeCreated || 0}`);
        rightStats.push(`  To be Updated: ${this.executionResult.filesToBeUpdated || 0}`);
        rightStats.push(`  To be Deleted: ${this.executionResult.filesToBeDeleted || 0}`);
        break;
    }

    if (this.currentFileName) {
      rightStats.push("");
      rightStats.push(`{bold}Current File{/bold}`);
      const truncated = this.truncateFileName(this.currentFileName, MAX_FILE_NAME_LENGTH);
      rightStats.push(`  {dim}${truncated}{/dim}`);
    }

    this.statsLeftBox.setContent(leftStats.join("\n"));
    this.statsRightBox.setContent(rightStats.join("\n"));
    this.screen?.render();
  }

  /**
   * Updates task progress
   */
  public updateTaskProgress(current: number, total: number, label?: string): void {
    if (!this.isActive) return;

    // Non-TTY logging is handled by ProgressService
    if (!isTTY()) {
      return;
    }

    this.totalFiles = total;
    this.processedFiles = current;

    if (label) {
      this.addLogToLogPane("Progress", label);
    }
  }

  /**
   * Updates current file progress
   */
  public updateFileProgress(current: number, total: number, fileName?: string): void {
    if (!this.isActive) return;

    // Non-TTY logging is handled by ProgressService
    if (!isTTY()) {
      return;
    }

    if (fileName) {
      this.currentFileName = fileName;
      // Update data rate tracker with file progress
      if (this.executionResult) {
        this.dataRateTracker.bytesProcessed = this.executionResult.totalBytesProcessed;
      }
    }
  }

  /**
   * Updates statistics display
   */
  public updateStats(executionResult: ExecutionResult): void {
    if (!this.isActive) return;

    this.executionResult = executionResult;
    this.dataRateTracker.bytesProcessed = executionResult.totalBytesProcessed;

    // Update display immediately
    this.updateStatsDisplay();

    // Log errors as they occur
    if (executionResult.errorCount > 0) {
      const recentErrors = executionResult.errors.slice(-5); // Last 5 errors
      recentErrors.forEach((error) => {
        this.addLogToLogPane("Error", error);
      });
    }
  }

  /**
   * Starts discovery mode - shows spinner (not in logs for TTY mode)
   */
  public startDiscovery(): void {
    if (!this.isActive || !this.screen) return;

    this.discoveryMode = true;
    // Non-TTY logging is handled by ProgressService

    // Start spinner animation
    this.spinnerIndex = 0;
    this.discoveryInterval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      // Update stats display to show discovery progress
      if (this.statsLeftBox) {
        this.updateStatsDisplay();
      }
    }, 80);
  }

  /**
   * Updates discovery progress (not logged in TTY mode)
   */
  public updateDiscoveryProgress(fileCount: number, currentDir: string): void {
    if (!this.isActive || !this.discoveryMode) return;

    // Non-TTY logging is handled by ProgressService
    // In TTY mode, just update stats display
  }

  /**
   * Stops discovery mode
   */
  public stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    this.discoveryMode = false;
    this.addLogToLogPane("Discovery", "File discovery complete.");
  }

  /**
   * Stops the display and shows final stats
   */
  public stop(): void {
    if (!this.isActive) return;

    // Stop intervals
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }

    // Final stats update
    if (this.executionResult) {
      this.updateStatsDisplay();
    }

    this.addLogToLogPane("System", "Operation completed.");

    // In non-TTY mode, show summary
    if (!isTTY() && this.executionResult) {
      console.log("─".repeat(CONSOLE_WIDTH));
      console.log("SUMMARY:");
      const stats = this.getStatsLines(this.executionResult);
      stats.forEach((line) => console.log(`  ${line}`));
      console.log("═".repeat(CONSOLE_WIDTH));
    }

    this.isActive = false;
  }

  /**
   * Cleanup blessed UI
   */
  private cleanup(): void {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    if (this.screen) {
      this.screen.destroy();
      this.screen = null;
    }

    // Unregister logger callback
    logger.setLogStreamCallback(null);
  }

  /**
   * Waits for user to press any key and then displays buffered logs
   */
  public async stopDisplayAndShowLogs({ waitForKeyPress }: { waitForKeyPress: boolean }): Promise<void> {
    this.stop();
    this.cleanup();

    const bufferedLogCount = logger.getBufferedLogCount();

    if (bufferedLogCount === 0) {
      return;
    }

    // Skip keypress wait if not in TTY mode
    if (!isTTY() || !waitForKeyPress) {
      console.log("\n");
      logger.flushBufferedLogs();
      return;
    }

    console.log("\n");
    console.log(`${bufferedLogCount} log entries captured during operation.`);
    console.log("Press any key to view detailed logs, or Ctrl+C to exit...");

    return new Promise((resolve) => {
      const readline = require("readline");
      readline.emitKeypressEvents(process.stdin);
      if (isStdinTTY()) {
        process.stdin.setRawMode(true);
      }

      const onKeyPress = () => {
        if (isStdinTTY()) {
          process.stdin.setRawMode(false);
        }
        process.stdin.removeListener("keypress", onKeyPress);
        process.stdin.pause();

        console.clear();
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
   * Logs final execution result (deprecated - logging is now handled by ProgressService)
   * This method is kept for backward compatibility but does nothing
   */
  public logExecutionResult(executionResult: ExecutionResult, verbose: boolean): void {
    // Logging is now handled by ProgressService.logExecutionResult()
    // This method is kept to maintain the interface but does nothing
  }

  /**
   * Get stats lines for summary
   */
  private getStatsLines(executionResult: ExecutionResult): string[] {
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

      case "compare":
        stats.push(`Files To Be Created: ${executionResult.filesToBeCreated || 0}`);
        stats.push(`Files To Be Updated: ${executionResult.filesToBeUpdated || 0}`);
        stats.push(`Files To Be Deleted: ${executionResult.filesToBeDeleted || 0}`);
        break;
    }

    stats.push(`Errors: ${errorCount}`);
    stats.push(`Running Time: ${runningTime}`);
    stats.push(`Data Processed: ${this.formatBytes(executionResult.totalBytesProcessed)}`);

    return stats;
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

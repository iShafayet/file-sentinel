import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import { promises as fsPromises } from "fs";
import constants from "../constant/common-constants.js";
import { errorService } from "./error-service.js";
import { progressService } from "./progress-service.js";
import { getRelativePath, isIgnoredPath } from "../utility/path-utils.js";
import { isPathRisky, getSafePath, formatRiskyPathError } from "../utility/path-sanitization-utility.js";
import { CompatibilityRiskStrategy } from "../model/config.js";
import { CompatibilityRiskError } from "../model/errors.js";

/**
 * Service for discovering files in a directory
 * Updated for v2: Ignores .fs-recycle, symlinks, and special files
 */
class DiscoveryService {
  private discoveryCount = 0;

  /**
   * Discovers all regular files in a directory, excluding:
   * - .fs-recycle directory
   * - Symbolic links
   * - Special files (sockets, devices, FIFOs)
   *
   * @param rootDir - The root directory to scan
   * @param subdirectory - Optional subdirectory to limit the scan
   * @param progressCallback - Optional callback for progress updates (fileCount, currentDir)
   * @param compatibilityRiskStrategy - Optional strategy for handling risky filenames (only used for digest)
   * @returns Array of relative paths from rootDir
   */
  public async discoverFiles(
    rootDir: string,
    subdirectory?: string | null,
    progressCallback?: (fileCount: number, currentDir: string) => void,
    compatibilityRiskStrategy?: CompatibilityRiskStrategy
  ): Promise<string[]> {
    const fileList: string[] = [];
    const startDir = subdirectory ? path.join(rootDir, subdirectory) : rootDir;

    // Check if start directory exists
    if (!fs.existsSync(startDir)) {
      logger.logNegative(`(discovery-service)> Directory does not exist: ${startDir}`);
      return fileList;
    }

    await this.discoverFilesRecursive(startDir, rootDir, fileList, progressCallback, compatibilityRiskStrategy);

    logger.debug(
      `(discovery-service)> Discovered ${fileList.length} files in ${rootDir}${subdirectory ? "/" + subdirectory : ""}`
    );

    return fileList;
  }

  /**
   * Recursive helper to discover files
   */
  private async discoverFilesRecursive(
    currentDir: string,
    rootDir: string,
    fileList: string[],
    progressCallback?: (fileCount: number, currentDir: string) => void,
    compatibilityRiskStrategy?: CompatibilityRiskStrategy
  ): Promise<void> {
    let childList: string[];

    try {
      childList = fs.readdirSync(currentDir);
    } catch (error) {
      logger.logNegative(`(discovery-service)> Error reading directory: ${currentDir}`);
      errorService.handleError(error);
      progressService.addError(`Failed to read directory: ${currentDir}`);
      return;
    }

    for (const child of childList) {
      this.discoveryCount++;
      if (this.discoveryCount % 100 === 0) {
        // Sleep for 0ms to avoid overwhelming the system
        await new Promise((resolve) => setTimeout(resolve, 0));
        logger.debug(`(discovery-service)> Discovered ${this.discoveryCount} files. Current directory: ${currentDir}`);
      }

      // region: Handle risky names immediately (for both directories and files)
      let tentativeChildPath = path.join(currentDir, child);
      let tentativeChildRelativePath = getRelativePath(tentativeChildPath, rootDir);
      if (compatibilityRiskStrategy && isPathRisky(tentativeChildRelativePath)) {
        const result = await this.handleRiskyName(
          tentativeChildPath,
          tentativeChildRelativePath,
          rootDir,
          compatibilityRiskStrategy
        );
        if (result === null) {
          // File/directory was skipped
          continue;
        }
        // Update paths if renamed
        tentativeChildPath = result.path;
        tentativeChildRelativePath = result.relativePath;
      }
      // endregion: Handle risky names immediately (for both directories and files)

      try {
        const childPath = tentativeChildPath;
        const childRelativePath = tentativeChildRelativePath;

        // Get stats without following symlinks (use actual path after potential rename)
        const childStat = fs.lstatSync(childPath);

        // Skip symbolic links
        if (childStat.isSymbolicLink()) {
          logger.debug(`(discovery-service)> Skipping symlink: ${childPath}`);
          continue;
        }

        // Skip special files (sockets, devices, FIFOs)
        if (!childStat.isFile() && !childStat.isDirectory()) {
          logger.debug(`(discovery-service)> Skipping special file: ${childPath}`);
          continue;
        }

        // Skip if in ignored paths (like .fs-recycle)
        if (isIgnoredPath(childRelativePath)) {
          logger.debug(`(discovery-service)> Skipping ignored path: ${childRelativePath}`);
          continue;
        }

        if (childStat.isDirectory()) {
          // Report progress when entering a new directory
          if (progressCallback) {
            progressCallback(fileList.length, childPath);
          }
          // Recurse into directory (use actual path after potential rename)
          await this.discoverFilesRecursive(childPath, rootDir, fileList, progressCallback, compatibilityRiskStrategy);
        } else if (childStat.isFile()) {
          // Add file to list
          fileList.push(childRelativePath);

          // Report progress every 50 files to avoid too many updates
          if (progressCallback && fileList.length % 50 === 0) {
            progressCallback(fileList.length, currentDir);
          }
        }
      } catch (error) {
        logger.logNegative(`(discovery-service)> Error processing: ${child}`);
        errorService.handleError(error);
        if (error instanceof CompatibilityRiskError) {
          await errorService.terminateOnError(error);
          process.exit(2); // Just to make compiler happy
        }
        progressService.addError(`Failed to process: ${child}`);
      }
    }
  }

  /**
   * Checks if a file exists and is a regular file (not symlink or special file)
   */
  public isRegularFile(filePath: string): boolean {
    try {
      const stat = fs.lstatSync(filePath);
      return stat.isFile() && !stat.isSymbolicLink();
    } catch {
      return false;
    }
  }

  /**
   * Gets file stats safely
   */
  public getFileStats(filePath: string): fs.Stats | null {
    try {
      return fs.statSync(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Handles a risky name (file or directory) based on the strategy
   * @returns Object with updated paths (or null if should be skipped)
   */
  private async handleRiskyName(
    childPath: string,
    childRelativePath: string,
    rootDir: string,
    strategy: CompatibilityRiskStrategy
  ): Promise<{ path: string; relativePath: string } | null> {
    const safePath = getSafePath(childRelativePath);
    const safeFullPath = path.join(rootDir, safePath);

    switch (strategy) {
      case "abort":
        // Fail immediately with helpful message
        const errorMessage = formatRiskyPathError(childRelativePath, safePath);
        logger.logNegative(`(discovery-service)> ${errorMessage}`);
        throw new CompatibilityRiskError(
          childRelativePath,
          `Problematic name detected: ${childRelativePath}. Use --compatibility-risk-strategy to handle this.`
        );

      case "skip":
        // Log warning and skip the file/directory
        logger.logNegative(`(discovery-service)> Skipping risky name: ${childRelativePath}`);
        progressService.addError(`Skipped risky name: ${childRelativePath}`);
        return null; // Don't process

      case "accept-risk":
        // Log info and proceed with original path
        logger.log(`(discovery-service)> Accepting risky name: ${childRelativePath}`);
        return { path: childPath, relativePath: childRelativePath }; // Use original path

      case "mitigate-or-abort":
      case "mitigate-or-skip":
      case "mitigate-or-accept-risk":
        // Try to rename the file/directory on disk
        const safeDir = path.dirname(safeFullPath);

        try {
          // Ensure parent directory exists
          await fsPromises.mkdir(safeDir, { recursive: true });

          // Rename the file/directory
          await fsPromises.rename(childPath, safeFullPath);
          logger.log(`(discovery-service)> Renamed risky name: ${childRelativePath} -> ${safePath}`);
          return { path: safeFullPath, relativePath: safePath }; // Use new safe path
        } catch (error) {
          // Mitigation failed - handle based on fallback strategy
          logger.logNegative(`(discovery-service)> Failed to rename ${childRelativePath}: ${(error as Error).message}`);

          if (strategy === "mitigate-or-abort") {
            // Fallback to abort
            const errorMessage = formatRiskyPathError(childRelativePath, safePath);
            logger.logNegative(`(discovery-service)> ${errorMessage}`);
            throw new CompatibilityRiskError(
              childRelativePath,
              `Failed to mitigate risky name: ${childRelativePath}. Mitigation failed and strategy is mitigate-or-abort.`
            );
          } else if (strategy === "mitigate-or-skip") {
            // Fallback to skip
            logger.logNegative(
              `(discovery-service)> Skipping risky name after mitigation failure: ${childRelativePath}`
            );
            progressService.addError(`Skipped risky name after mitigation failure: ${childRelativePath}`);
            return null; // Don't process
          } else {
            // strategy === "mitigate-or-accept-risk"
            // Fallback to accept-risk
            logger.log(`(discovery-service)> Accepting risky name after mitigation failure: ${childRelativePath}`);
            return { path: childPath, relativePath: childRelativePath }; // Use original path
          }
        }
    }
  }
}

export const discoveryService = new DiscoveryService();

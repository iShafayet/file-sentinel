import { logger } from "../lib/logger.js";
import fs from "fs";
import path from "path";
import constants from "../constant/common-constants.js";
import { errorService } from "./error-service.js";
import { ExecutionResult } from "../model/execution-results.js";
import { getRelativePath, isIgnoredPath } from "../utility/path-utils.js";

/**
 * Service for discovering files in a directory
 * Updated for v2: Ignores .fs-recycle, symlinks, and special files
 */
class DiscoveryService {
  /**
   * Discovers all regular files in a directory, excluding:
   * - .fs-recycle directory
   * - Symbolic links
   * - Special files (sockets, devices, FIFOs)
   *
   * @param rootDir - The root directory to scan
   * @param subdirectory - Optional subdirectory to limit the scan
   * @param executionResult - Optional execution result to track errors
   * @returns Array of relative paths from rootDir
   */
  public discoverFiles(rootDir: string, subdirectory?: string | null, executionResult?: ExecutionResult): string[] {
    const fileList: string[] = [];
    const startDir = subdirectory ? path.join(rootDir, subdirectory) : rootDir;

    // Check if start directory exists
    if (!fs.existsSync(startDir)) {
      logger.logNegative(`(discovery-service)> Directory does not exist: ${startDir}`);
      return fileList;
    }

    this.discoverFilesRecursive(startDir, rootDir, fileList, executionResult);

    logger.debug(
      `(discovery-service)> Discovered ${fileList.length} files in ${rootDir}${subdirectory ? "/" + subdirectory : ""}`
    );

    return fileList;
  }

  /**
   * Recursive helper to discover files
   */
  private discoverFilesRecursive(
    currentDir: string,
    rootDir: string,
    fileList: string[],
    executionResult?: ExecutionResult
  ): void {
    let childList: string[];

    try {
      childList = fs.readdirSync(currentDir);
    } catch (error) {
      logger.logNegative(`(discovery-service)> Error reading directory: ${currentDir}`);
      errorService.handleError(error);
      if (executionResult) {
        executionResult.errorCount++;
        executionResult.errors.push(`Failed to read directory: ${currentDir}`);
      }
      return;
    }

    for (const child of childList) {
      try {
        const childPath = path.join(currentDir, child);

        // Get stats without following symlinks
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

        // Get relative path
        const relativePath = getRelativePath(childPath, rootDir);

        // Skip if in ignored paths (like .fs-recycle)
        if (isIgnoredPath(relativePath)) {
          logger.debug(`(discovery-service)> Skipping ignored path: ${relativePath}`);
          continue;
        }

        if (childStat.isDirectory()) {
          // Recurse into directory
          this.discoverFilesRecursive(childPath, rootDir, fileList, executionResult);
        } else if (childStat.isFile()) {
          // Add file to list
          fileList.push(relativePath);
        }
      } catch (error) {
        logger.logNegative(`(discovery-service)> Error processing: ${child}`);
        errorService.handleError(error);
        if (executionResult) {
          executionResult.errorCount++;
          executionResult.errors.push(`Failed to process: ${child}`);
        }
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
}

export const discoveryService = new DiscoveryService();

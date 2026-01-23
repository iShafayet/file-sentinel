import path from "path";
import constants from "../constant/common-constants.js";

/**
 * Parses the input option format "directory::digest-file"
 * Uses "::" as separator to avoid conflicts with Windows drive letters (e.g., C:\)
 * @param input - Input string in format "/path/to/dir::/path/to/digest.db" or "C:\path::C:\digest.db"
 * @returns Object with dir and digestFile paths
 */
export function parseInputOption(input: string): { dir: string; digestFile: string } {
  if (!input || typeof input !== "string") {
    throw new Error("Input option must be a non-empty string");
  }

  // Use "::" as separator to avoid conflicts with Windows drive letters
  const separatorIndex = input.indexOf("::");

  if (separatorIndex === -1) {
    throw new Error(
      `Invalid input format: "${input}". Expected format: "/path/to/dir::/path/to/digest.db" (use :: as separator)`
    );
  }

  const dir = input.substring(0, separatorIndex);
  const digestFile = input.substring(separatorIndex + 2);

  if (!dir || !digestFile) {
    throw new Error(
      `Invalid input format: "${input}". Both directory and digest file paths must be non-empty`
    );
  }

  // Resolve to absolute paths
  const absoluteDir = path.resolve(dir);
  const absoluteDigestFile = path.resolve(digestFile);

  return {
    dir: absoluteDir,
    digestFile: absoluteDigestFile,
  };
}

/**
 * Normalizes a relative path by removing leading/trailing slashes and resolving dots
 * @param relativePath - The relative path to normalize
 * @returns Normalized relative path
 */
export function normalizeRelativePath(relativePath: string): string {
  // Remove leading/trailing slashes
  let normalized = relativePath.replace(/^\/+|\/+$/g, "");

  // Normalize path separators and resolve dots
  normalized = path.normalize(normalized);

  // Remove leading ./ if present
  if (normalized.startsWith("./")) {
    normalized = normalized.substring(2);
  }

  return normalized;
}

/**
 * Computes the relative path from rootDir to fullPath
 * @param fullPath - The full absolute path
 * @param rootDir - The root directory
 * @returns Relative path from rootDir to fullPath
 */
export function getRelativePath(fullPath: string, rootDir: string): string {
  const relativePath = path.relative(rootDir, fullPath);
  return normalizeRelativePath(relativePath);
}

/**
 * Checks if a path is a subdirectory of another path
 * @param child - The potential child path
 * @param parent - The potential parent path
 * @returns True if child is a subdirectory of parent
 */
export function isSubdirectoryOf(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Checks if a relative path should be ignored
 * Currently checks for:
 * - .fs-recycle directory
 * @param relativePath - The relative path to check
 * @returns True if the path should be ignored
 */
export function isIgnoredPath(relativePath: string): boolean {
  const normalized = normalizeRelativePath(relativePath);
  const parts = normalized.split(path.sep);

  // Check if any part of the path is the recycle directory
  return parts.includes(constants.RECYCLE_DIR_NAME);
}

/**
 * Checks if a path is within a specific subdirectory
 * @param relativePath - The relative path to check
 * @param subdirectory - The subdirectory to check against (can be null)
 * @returns True if the path is within the subdirectory (or subdirectory is null)
 */
export function isInSubdirectory(relativePath: string, subdirectory: string | null): boolean {
  if (!subdirectory) {
    return true; // No filter, all paths are included
  }

  const normalizedPath = normalizeRelativePath(relativePath);
  const normalizedSubdir = normalizeRelativePath(subdirectory);

  // Check if the path starts with the subdirectory
  return normalizedPath === normalizedSubdir || normalizedPath.startsWith(normalizedSubdir + path.sep);
}

/**
 * Joins paths safely, ensuring the result is normalized
 * @param basePath - The base path
 * @param relativePath - The relative path to join
 * @returns Joined and normalized path
 */
export function joinPath(basePath: string, relativePath: string): string {
  return path.join(basePath, relativePath);
}

/**
 * Truncates a path to fit display if not in verbose mode
 * @param pathValue - The path to truncate
 * @param maxLength - Maximum length for the truncated path
 * @param verbose - Whether verbose mode is enabled (if true, returns full path)
 * @returns Truncated path with ellipsis in the middle, or full path if verbose
 */
export function truncatePathIfNotVerbose(pathValue: string, maxLength: number, verbose: boolean): string {
  if (verbose || pathValue.length <= maxLength) {
    return pathValue;
  }
  const ellipsis = "...";
  const partLength = Math.floor((maxLength - ellipsis.length) / 2);
  return pathValue.substring(0, partLength) + ellipsis + pathValue.substring(pathValue.length - partLength);
}


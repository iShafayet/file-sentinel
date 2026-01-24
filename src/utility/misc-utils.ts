import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DeveloperError } from "./coded-error.js";
import { logger } from "../lib/logger.js";
import { forceNonTTYMode } from "./terminal-utils.js";
import { Config } from "../model/config.js";

function extract(object: any, keyList: string[]) {
  if (typeof object !== "object" || object === null) {
    throw new DeveloperError("GENERIC_OBJECT_NOT_OBJECT", "Expected object to be an object");
  }
  let newObject: any = {};
  for (let key of keyList) {
    if (!object.hasOwnProperty(key)) {
      throw new DeveloperError("GENERIC_OBJECT_KEY_MISSING", `Expected object to have key "${key}"`);
    }
    newObject[key] = object[key];
  }
  return newObject;
}

function strip(object: any, keyList: string[]): void {
  if ("object" !== typeof object) {
    return;
  }
  if (Array.isArray(object)) {
    object.forEach((_object) => strip(_object, keyList));
    return;
  }
  for (let key of keyList) {
    if (object.hasOwnProperty(key)) {
      delete object[key];
    }
  }
  return;
}

/**
 * Gets the version from package.json
 */
function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, "../../../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

/**
 * Gets the build date from build-info.json (generated during build)
 * Returns null if build-info.json doesn't exist (e.g., in development)
 */
function getBuildDate(): string | null {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const buildInfoPath = join(__dirname, "../build-info.json");
    const buildInfo = JSON.parse(readFileSync(buildInfoPath, "utf-8"));
    return buildInfo.buildDate || null;
  } catch (error) {
    // Build info file doesn't exist (e.g., in development mode)
    return null;
  }
}

function applyTtyAndVerbosityGlobally(config: Config): void {
  // Set logger verbosity
  logger.setVerbosity(config.verbose);
  logger.debug("(misc-utils)> Verbosity set to:", config.verbose);

  // Force non-TTY mode if requested
  if (config.noTty) {
    logger.debug("(misc-utils)> Forcing non-TTY mode");
    forceNonTTYMode();
  }
}

/**
 * Checks if a file should be skipped based on recency threshold
 * @param lastAttemptedAt - Timestamp of last attempt (0 if never attempted)
 * @param recencyThreshold - Threshold in seconds (0 means no threshold)
 * @param relativePath - File path for logging
 * @param logger - Logger instance for logging skip messages
 * @returns true if file should be skipped, false otherwise
 */
export function shouldSkipFileByRecency(
  lastAttemptedAt: number,
  recencyThreshold: number,
  relativePath: string,
  logger: { log: (message: string) => void }
): boolean {
  if (recencyThreshold <= 0) {
    return false; // No threshold, process all files
  }

  if (lastAttemptedAt === 0) {
    return false; // Never attempted, process it
  }

  const now = Date.now();
  const timeSinceLastAttempt = Math.floor((now - lastAttemptedAt) / 1000); // Convert to seconds

  if (timeSinceLastAttempt < recencyThreshold) {
    const minutesAgo = Math.floor(timeSinceLastAttempt / 60);
    const secondsAgo = timeSinceLastAttempt % 60;
    const timeStr =
      minutesAgo > 0
        ? `${minutesAgo} minute${minutesAgo > 1 ? "s" : ""} ${secondsAgo} second${secondsAgo !== 1 ? "s" : ""}`
        : `${secondsAgo} second${secondsAgo !== 1 ? "s" : ""}`;
    logger.log(
      `(misc-utils)> Skipping ${relativePath} - processed ${timeStr} ago (within ${recencyThreshold} second threshold)`
    );
    return true;
  }

  return false;
}

export { extract, strip, getVersion, getBuildDate, applyTtyAndVerbosityGlobally };

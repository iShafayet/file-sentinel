/**
 * Terminal utilities for TTY detection and terminal-related operations
 * NOTE: This is a shared state for the entire application.
 */

let forcedNonTTY = true;

/**
 * Force non-TTY mode for testing or CI environments
 */
export function forceNonTTYMode(): void {
  forcedNonTTY = true;
}

/**
 * Check if the current environment is a TTY (interactive terminal)
 * Returns true only if both stdin and stdout are TTYs and not forced to non-TTY mode
 */
export function isTTY(): boolean {
  if (forcedNonTTY) {
    return false;
  }
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

/**
 * Check if stdin is a TTY
 */
export function isStdinTTY(): boolean {
  if (forcedNonTTY) {
    return false;
  }
  return process.stdin.isTTY === true;
}

/**
 * Check if stdout is a TTY
 */
export function isStdoutTTY(): boolean {
  if (forcedNonTTY) {
    return false;
  }
  return process.stdout.isTTY === true;
}

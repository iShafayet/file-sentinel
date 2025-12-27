import path from "path";

/**
 * Maximum compatibility forbidden characters (union of all major filesystems)
 * Includes: /, <, >, :, ", \, |, ?, *, \0
 */
const FORBIDDEN_CHARS = ["/", "<", ">", ":", '"', "\\", "|", "?", "*", "\0"];

/**
 * Default replacement character for forbidden characters
 */
const REPLACEMENT = "!";

/**
 * Checks if a path contains risky characters that may cause issues
 * on various filesystems (FAT32, exFAT, NTFS, macOS, Windows)
 * Checks each path component separately (path separators are not risky)
 * @param relativePath - The relative path to check
 * @returns True if the path contains risky characters
 */
export function isPathRisky(relativePath: string): boolean {
  // Split path into components and check each separately
  // Path separators themselves are not risky
  const parts = relativePath.split(path.sep);
  for (const part of parts) {
    for (const char of FORBIDDEN_CHARS) {
      if (part.includes(char)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Sanitizes a path by replacing risky characters with safe alternatives
 * Uses maximum compatibility approach (works on all major filesystems)
 * @param relativePath - The relative path to sanitize
 * @returns Sanitized path safe for all major filesystems
 */
export function getSafePath(relativePath: string): string {
  const parts = relativePath.split(path.sep);
  const sanitizedParts = parts.map((part) => {
    let sanitized = part;

    // Replace forbidden characters
    for (const char of FORBIDDEN_CHARS) {
      if (char === "\0") {
        // Null byte - remove it
        sanitized = sanitized.replace(/\0/g, "");
      } else {
        sanitized = sanitized.replace(new RegExp(escapeRegex(char), "g"), REPLACEMENT);
      }
    }

    // Windows-specific: Remove trailing dots and spaces
    sanitized = sanitized.replace(/[.\s]+$/, "");

    // Ensure not empty
    if (!sanitized) {
      sanitized = REPLACEMENT;
    }

    return sanitized;
  });

  return sanitizedParts.join(path.sep);
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Formats a helpful error message for risky paths
 */
export function formatRiskyPathError(relativePath: string, safePath?: string): string {
  let message = `\n`;
  message += `═══════════════════════════════════════════════════════════════════════════════\n`;
  message += `PROBLEMATIC FILENAME DETECTED\n`;
  message += `═══════════════════════════════════════════════════════════════════════════════\n\n`;
  message += `File: ${relativePath}\n\n`;
  message += `This filename contains characters that are not supported on some filesystems\n`;
  message += `(FAT32, exFAT, NTFS, macOS, Windows). Replicating or healing to these\n`;
  message += `filesystems will fail.\n\n`;

  if (safePath) {
    message += `Safe alternative: ${safePath}\n\n`;
  }

  message += `Options:\n`;
  message += `  1. Rename the file(s) to remove problematic characters\n`;
  message += `  2. Use --compatibility-risk-strategy=skip to skip these files\n`;
  message += `  3. Use --compatibility-risk-strategy=accept-risk to proceed (will potentially fail on replicate/heal)\n`;
  message += `  4. Use --compatibility-risk-strategy=mitigate-or-abort to auto-rename files (abort if rename fails)\n`;
  message += `  5. Use --compatibility-risk-strategy=mitigate-or-skip to auto-rename files (skip if rename fails)\n`;
  message += `  6. Use --compatibility-risk-strategy=mitigate-or-accept-risk to auto-rename files (accept risk if rename fails)\n\n`;
  message += `═══════════════════════════════════════════════════════════════════════════════\n`;

  return message;
}

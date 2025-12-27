import { CodedError, DeveloperError } from "./coded-error.js";

/**
 * Extracts a meaningful error message from Node.js file system errors
 */
export const getFileSystemErrorMessage = (
  error: NodeJS.ErrnoException | null | undefined,
  defaultMessage: string
): string => {
  if (!error) {
    return defaultMessage;
  }

  // Check for specific error codes
  if (error.code) {
    const errorPath = error.path;

    switch (error.code) {
      case "ENOENT":
        // Prefer defaultMessage if it has context (contains file path or operation description)
        // Otherwise use error.path if available
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          // Default message has context, format it cleanly
          if (defaultMessage.startsWith("File or directory not found:")) {
            return defaultMessage;
          }
          // If defaultMessage already describes the operation, use it as-is
          // Otherwise prefix with "File or directory not found:"
          if (defaultMessage.startsWith("Failed to") || defaultMessage.startsWith("Error")) {
            return defaultMessage;
          }
          return `File or directory not found: ${defaultMessage}`;
        }
        return `File or directory not found: ${errorPath || defaultMessage}`;
      case "EACCES":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Permission denied: ${defaultMessage}`;
        }
        return `Permission denied: ${errorPath || defaultMessage}`;
      case "ENAMETOOLONG":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Path too long: ${defaultMessage}`;
        }
        return `Path too long: ${errorPath || defaultMessage}`;
      case "EIO":
        return `I/O error: ${error.message || defaultMessage}`;
      case "ENOSPC":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `No space left on device: ${defaultMessage}`;
        }
        return `No space left on device: ${errorPath || defaultMessage}`;
      case "EROFS":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Read-only file system: ${defaultMessage}`;
        }
        return `Read-only file system: ${errorPath || defaultMessage}`;
      case "EBUSY":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Resource busy or locked: ${defaultMessage}`;
        }
        return `Resource busy or locked: ${errorPath || defaultMessage}`;
      case "EMFILE":
        return `Too many open files: ${error.message || defaultMessage}`;
      case "ENOTDIR":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Not a directory: ${defaultMessage}`;
        }
        return `Not a directory: ${errorPath || defaultMessage}`;
      case "EISDIR":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Is a directory: ${defaultMessage}`;
        }
        return `Is a directory: ${errorPath || defaultMessage}`;
      case "EEXIST":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `File already exists: ${defaultMessage}`;
        }
        return `File already exists: ${errorPath || defaultMessage}`;
      case "ENOTEMPTY":
        if (defaultMessage && (defaultMessage.includes("for file") || defaultMessage.includes(":"))) {
          return `Directory not empty: ${defaultMessage}`;
        }
        return `Directory not empty: ${errorPath || defaultMessage}`;
      default:
        return `${error.code}: ${error.message || defaultMessage}`;
    }
  }

  // Fall back to error message if available
  if (error.message) {
    return error.message;
  }

  return defaultMessage;
};

export const serializeError = (errorObject: Error): string => {
  const parts: string[] = [];

  // Error name and message
  if (errorObject.name && errorObject.message) {
    parts.push(`${errorObject.name}: ${errorObject.message}`);
  } else if (errorObject.message) {
    parts.push(errorObject.message);
  } else if (errorObject.name) {
    parts.push(errorObject.name);
  } else {
    parts.push(String(errorObject));
  }

  // Stack trace (if available and different from message)
  if (errorObject.stack) {
    const stackLines = errorObject.stack.split("\n");
    // Skip the first line if it's just the name:message (already included)
    const firstLine = stackLines[0] || "";
    const nameMessagePattern =
      errorObject.name && errorObject.message ? `${errorObject.name}: ${errorObject.message}` : null;

    if (nameMessagePattern && firstLine.includes(nameMessagePattern)) {
      // Include stack trace starting from line 2
      parts.push(stackLines.slice(1).join("\n"));
    } else {
      // Include full stack trace
      parts.push(errorObject.stack);
    }
  }

  return parts.join("\n");
};

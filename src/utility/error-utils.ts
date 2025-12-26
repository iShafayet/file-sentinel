import { CodedError, DeveloperError } from "./coded-error.js";

type SerializedError = {
  code: string;
  message: string;
  details: any;
};

export const stringifyErrorObject = (errorObject: Error): [SerializedError, string] => {
  let details = {};

  if (!(errorObject instanceof Error)) {
    throw new DeveloperError("DEVELOPER_ERROR", "expected errorObject to be an instanceof Error");
  }

  let code = "GENERIC_SERVER_ERROR";
  let message =
    "We have encountered an unexpected server error. " + "It has been logged and administrators will be notified.";

  if (errorObject instanceof CodedError) {
    code = (errorObject as CodedError).code;
    message = errorObject.message;
  }

  if ("isJoi" in errorObject) {
    code = "VALIDATION_ERROR";
    details = (errorObject as any).details;
    message = errorObject.message;
  }

  let name = errorObject.name;

  return [{ code, message, details }, name];
};

export const detectHttpStatusCode = (serializedError: SerializedError, errorName: string | null) => {
  if (["VALIDATION_ERROR", "API_KEY_NOT_FOUND"].includes(serializedError.code)) {
    return 400;
  }

  if (["API_KEY_EXPIRED"].includes(serializedError.code)) {
    return 401;
  }

  if (["ACCESS_DENIED", "USER_BANNED"].includes(serializedError.code)) {
    return 403;
  }

  if (["AUTHORIZATION_HEADER_MISSING", "AUTHORIZATION_HEADER_MALFORMATTED"].includes(serializedError.code)) {
    return 412;
  }

  if (["DEVELOPER_ERROR", "API_KEY_CREATION_FAILED"].includes(serializedError.code)) {
    return 500;
  }

  if (errorName === "UserError") {
    return 400;
  }

  return 500;
};

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

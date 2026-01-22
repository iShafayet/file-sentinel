import fs from "fs";
import pathlib from "path";
import { fileURLToPath, pathToFileURL } from "url";

// NOTE: The relative pathing will have to be adjusted if this file is moved elsewhere.
const appRootDirPath = pathlib.join(
  pathlib.dirname(fileURLToPath(import.meta.url)),
  "../../dist/"
);

const ensureDir = (dirpath: string) => {
  fs.mkdirSync(dirpath, { recursive: true });
};

const resolvePath = (...paths: string[]) => {
  return pathlib.join(...paths);
};

const toFileUrl = (path: string) => {
  return pathToFileURL(path).toString();
};

const getAbsolutePath = (path: string) => {
  return pathlib.resolve(path)
};

/**
 * Checks if a file is writable (or can be created if it doesn't exist)
 * @param filePath - Path to the file to check
 * @returns true if writable, false otherwise
 */
const isFileWritable = (filePath: string): boolean => {
  try {
    // If file doesn't exist, check if parent directory is writable
    if (!fs.existsSync(filePath)) {
      const parentDir = pathlib.dirname(filePath);
      if (!fs.existsSync(parentDir)) {
        return false;
      }
      // Check write permission on parent directory
      fs.accessSync(parentDir, fs.constants.W_OK);
      return true;
    }

    // File exists - check write permission
    fs.accessSync(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

export { ensureDir, resolvePath, getAbsolutePath, appRootDirPath, toFileUrl, isFileWritable };

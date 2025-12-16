import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import constants from "../constant/common-constants.js";

/**
 * Utility for managing file recycling (soft deletion)
 */
export class RecycleUtility {
  private baseDir: string;
  private recycleDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.recycleDir = path.join(baseDir, constants.RECYCLE_DIR_NAME);
  }

  /**
   * Gets the recycle directory path
   */
  getRecycleDir(): string {
    return this.recycleDir;
  }

  /**
   * Checks if a path is within the recycle directory
   */
  isRecycleDir(targetPath: string): boolean {
    const normalized = path.resolve(targetPath);
    const normalizedRecycle = path.resolve(this.recycleDir);

    return normalized === normalizedRecycle || normalized.startsWith(normalizedRecycle + path.sep);
  }

  /**
   * Ensures the recycle directory exists
   */
  async ensureRecycleDir(): Promise<void> {
    try {
      await fsPromises.mkdir(this.recycleDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create recycle directory: ${(error as Error).message}`);
    }
  }

  /**
   * Moves a file to the recycle bin
   * @param filePath - Absolute path to the file to recycle
   */
  async moveToRecycle(filePath: string): Promise<void> {
    // Ensure recycle directory exists
    await this.ensureRecycleDir();

    // Get relative path from base directory
    const relativePath = path.relative(this.baseDir, filePath);

    if (relativePath.startsWith("..")) {
      throw new Error(`File ${filePath} is not within base directory ${this.baseDir}`);
    }

    // Check if the file is already in recycle directory
    if (this.isRecycleDir(filePath)) {
      throw new Error(`File ${filePath} is already in recycle directory`);
    }

    // Create a timestamped target path in recycle bin
    const timestamp = Date.now();
    const targetDir = path.join(this.recycleDir, path.dirname(relativePath));
    const filename = path.basename(relativePath);
    const targetPath = path.join(targetDir, `${timestamp}_${filename}`);

    // Ensure target directory exists
    await fsPromises.mkdir(targetDir, { recursive: true });

    // Check if source file exists
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
    } catch {
      throw new Error(`File ${filePath} does not exist`);
    }

    // Move the file
    try {
      await fsPromises.rename(filePath, targetPath);
    } catch (error) {
      // If rename fails (e.g., across filesystems), try copy and delete
      try {
        await fsPromises.copyFile(filePath, targetPath);
        await fsPromises.unlink(filePath);
      } catch (copyError) {
        throw new Error(`Failed to move file to recycle: ${(copyError as Error).message}`);
      }
    }
  }

  /**
   * Permanently deletes a file
   * @param filePath - Absolute path to the file to delete
   */
  async permanentDelete(filePath: string): Promise<void> {
    // Check if file exists
    try {
      await fsPromises.access(filePath, fs.constants.F_OK);
    } catch {
      throw new Error(`File ${filePath} does not exist`);
    }

    // Check if the file is within the recycle directory (prevent accidental deletion)
    if (this.isRecycleDir(filePath)) {
      throw new Error(`Cannot permanently delete files from recycle directory. File: ${filePath}`);
    }

    // Delete the file
    try {
      await fsPromises.unlink(filePath);
    } catch (error) {
      throw new Error(`Failed to permanently delete file: ${(error as Error).message}`);
    }
  }
}

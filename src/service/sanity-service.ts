import { Config } from "../model/config.js";
import { fileService } from "./file-service.js";
import fs from "fs";

/**
 * Service for validating configuration and paths
 */
class SanityService {
  /**
   * Verifies that all paths in config exist and are accessible
   */
  verifyPathsInConfig(config: Config): void {
    if (!config) {
      throw new Error("Config is null");
    }

    switch (config.command) {
      case "digest":
        this.verifyDirectory(config.inputDir, "Input directory");
        this.verifyDigestFileDirectory(config.digestFile, "Digest file");
        break;

      case "verify":
        this.verifyDirectory(config.inputDir, "Input directory");
        this.verifyFileExists(config.digestFile, "Digest file");
        if (config.subdirectory) {
          const subdirPath = `${config.inputDir}/${config.subdirectory}`;
          this.verifyDirectory(subdirPath, "Subdirectory");
        }
        break;

      case "replicate":
        this.verifyDirectory(config.sourceDir, "Source directory");
        this.verifyFileExists(config.sourceDigestFile, "Source digest file");
        // Destination directory will be created if it doesn't exist
        this.verifyDigestFileDirectory(config.destDigestFile, "Destination digest file");

        // Verify mirrors
        for (let i = 0; i < config.mirrors.length; i++) {
          const mirror = config.mirrors[i];
          this.verifyDirectory(mirror.dir, `Mirror ${i + 1} directory`);
          this.verifyFileExists(mirror.digestFile, `Mirror ${i + 1} digest file`);
        }

        if (config.subdirectory) {
          const subdirPath = `${config.sourceDir}/${config.subdirectory}`;
          this.verifyDirectory(subdirPath, "Source subdirectory");
        }
        break;

      case "heal":
        this.verifyDirectory(config.inputDir, "Input directory");
        this.verifyFileExists(config.digestFile, "Digest file");

        // Verify at least one mirror
        if (!config.mirrors || config.mirrors.length === 0) {
          throw new Error("At least one mirror must be provided for heal command");
        }

        // Verify mirrors
        for (let i = 0; i < config.mirrors.length; i++) {
          const mirror = config.mirrors[i];
          this.verifyDirectory(mirror.dir, `Mirror ${i + 1} directory`);
          this.verifyFileExists(mirror.digestFile, `Mirror ${i + 1} digest file`);
        }

        if (config.subdirectory) {
          const subdirPath = `${config.inputDir}/${config.subdirectory}`;
          this.verifyDirectory(subdirPath, "Subdirectory");
        }
        break;
    }
  }

  /**
   * Verifies that a directory exists
   */
  private verifyDirectory(path: string, label: string): void {
    if (!fileService.verifyDirectoryExists(path)) {
      throw new Error(`${label} does not exist: ${path}`);
    }
  }

  /**
   * Verifies that a file exists
   */
  private verifyFileExists(path: string, label: string): void {
    if (!fs.existsSync(path)) {
      throw new Error(`${label} does not exist: ${path}`);
    }
  }

  /**
   * Verifies that the directory containing a digest file exists
   * (the digest file itself may not exist yet)
   */
  private verifyDigestFileDirectory(digestFilePath: string, label: string): void {
    const dirPath = digestFilePath.substring(0, digestFilePath.lastIndexOf("/"));
    if (dirPath && !fileService.verifyDirectoryExists(dirPath)) {
      throw new Error(`Directory for ${label} does not exist: ${dirPath}`);
    }
  }
}

export const sanityService = new SanityService();

import { Config, VerificationMode } from "../model/config.js";
import { logger } from "../lib/logger.js";
import { discoveryService } from "./discovery-service.js";
import { fileMetaDataSchema } from "../model/file-meta-data.js";
import { getMetaFilePath } from "../utility/meta-data-utils.js";
import { FileMetaData } from "../model/file-meta-data.js";
import fs from "fs";
import { cryptoService } from "./crypto-service.js";

class IntegrityService {

  private async verifyFile(filePath: string, rootDir: string, metaDataRootDir: string, verificationMode: VerificationMode, counter: { verified: number; outdated: number; failed: number; }): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.log(`(tagging-service)> Potentially updating file: ${relativeFilePath}`);
    const metaDataPath = getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.log(`(integrity-service)> ERROR: File ${relativeFilePath} has invalid meta data. Verification failed.`);
      counter.failed++;
      return;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be re-tagged.`);
      counter.outdated++;
      return;
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}). It will be re-tagged.`);
        counter.outdated++;
        return;
      } else {
        logger.log(`(integrity-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        counter.verified++;
        return;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
      if (existingMeta.hash.sha256 !== hash) {
        logger.log(`(integrity-service)> File ${relativeFilePath} has been modified (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}). It will be re-tagged.`);
        counter.outdated++;
        return;
      } else {
        logger.log(`(integrity-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        counter.verified++;
        return;
      }
    }

    throw new Error("Code should not reach here");
  }

  public async verifyIntegrity(config: Config): Promise<void> {
    logger.log("(integrity-service)> Verifying integrity");

    const untaggedFileList: string[] = [];
    const previouslyTaggedFileList: string[] = [];
    discoveryService.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, untaggedFileList, previouslyTaggedFileList);

    if (untaggedFileList.length > 0) {
      logger.log(`(integrity-service)> Found ${untaggedFileList.length} untagged files. These will not be able to be verified. It is recommended to tag those.`);
    }

    if (previouslyTaggedFileList.length > 0) {
      logger.log(`(integrity-service)> Found ${previouslyTaggedFileList.length} previously tagged files. These will be verified.`);
    } else {
      logger.log(`(integrity-service)> No previously tagged files found. Nothing to verify.`);
      return;
    }

    const counter = {
      verified: 0,
      outdated: 0,
      failed: 0,
    };
    for (const filePath of previouslyTaggedFileList) {
      await this.verifyFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.verification.mode, counter);
    }

    logger.log(
      "(integrity-service)> Verification complete.\n" +
      `    • ${counter.verified} files verified\n` +
      `    • ${counter.outdated} files outdated\n` +
      `    • ${counter.failed} files failed`
    );
  }
}

export const integrityService = new IntegrityService();
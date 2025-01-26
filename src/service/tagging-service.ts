import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { Config, VerificationMode } from "../model/config.js";
import constants from "../constant/common-constants.js";
import { FileMetaData, fileMetaDataSchema } from "../model/file-meta-data.js";
import { cryptoService } from "./crypto-service.js";

class TaggingService {

  private getMetaFilePath(childFilePath: string, rootDir: string, metaDataRootDir: string): string {
    const relativePath = childFilePath.replace(rootDir, "");
    const fileName = path.basename(relativePath);
    const dirPath = path.dirname(relativePath);
    const metaFileName = constants.META_FILE_PREFIX + fileName + constants.META_FILE_SUFFIX;
    return path.join(metaDataRootDir, dirPath, metaFileName);
  }

  private populateFilesToTag(dir: string, rootDir: string, metaDataRootDir: string, fileToTagList: string[], fileToPotentialUpdateList: string[]): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      const childPath = path.join(dir, child);
      const childStat = fs.statSync(childPath);
      if (childStat.isDirectory()) {
        this.populateFilesToTag(childPath, rootDir, metaDataRootDir, fileToTagList, fileToPotentialUpdateList);
        continue;
      }
      if (child.startsWith(constants.META_FILE_PREFIX)) {
        continue;
      }
      if (childStat.isFile()) {
        const metaDataPath = this.getMetaFilePath(childPath, rootDir, metaDataRootDir);
        if (!fs.existsSync(metaDataPath)) {
          logger.log(`(tagging-service)> File ${childPath} is new`);
          fileToTagList.push(childPath);
        } else {
          logger.log(`(tagging-service)> File ${childPath} has existing meta data`);
          fileToPotentialUpdateList.push(childPath);
        }
      }
    }
  }

  private async tagFile(filePath: string, rootDir: string, metaDataRootDir: string): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.log(`(tagging-service)> Tagging file: ${relativeFilePath}`);
    const metaDataPath = this.getMetaFilePath(filePath, rootDir, metaDataRootDir);
    const fileStat = fs.statSync(filePath);
    const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
    const metaData: FileMetaData = {
      file: {
        name: relativeFilePath,
        size: fileStat.size,
        createdAt: fileStat.birthtime.getTime(),
        modifiedAt: fileStat.mtime.getTime()
      },
      hash: {
        sha256: hash
      },
      verification: {
        lastVerifiedAt: Date.now(),
        lastVerifiedBy: constants.CLIENT_IDENTFIER
      },
      metaData: {
        approximateModifiedAt: Date.now()
      }
    };
    const metaDataString = JSON.stringify(metaData, null, 2);
    const metaDataDir = path.dirname(metaDataPath);
    fs.mkdirSync(metaDataDir, { recursive: true });
    fs.writeFileSync(metaDataPath, metaDataString);
  }

  private async updateFileTagIfNeeded(filePath: string, rootDir: string, metaDataRootDir: string, verificationMode: VerificationMode): Promise<void> {
    const relativeFilePath = filePath.replace(rootDir, "");
    logger.log(`(tagging-service)> Potentially updating file: ${relativeFilePath}`);
    const metaDataPath = this.getMetaFilePath(filePath, rootDir, metaDataRootDir);

    const existingMeta: FileMetaData = JSON.parse(fs.readFileSync(metaDataPath, "utf-8"));
    const { error } = fileMetaDataSchema.validate(existingMeta);
    if (error) {
      logger.log(`(tagging-service)> File ${relativeFilePath} has invalid meta data. It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir);
      return;
    }

    const fileStat = fs.statSync(filePath);

    if (existingMeta.file.modifiedAt !== fileStat.mtime.getTime()) {
      logger.log(`(tagging-service)> File ${relativeFilePath} has been modified (modifiedAt from meta: ${existingMeta.file.modifiedAt}, modifiedAt from file: ${fileStat.mtime.getTime()}). It will be re-tagged.`);
      await this.tagFile(filePath, rootDir, metaDataRootDir);
      return;
    }

    if (verificationMode === "size") {
      if (existingMeta.file.size !== fileStat.size) {
        logger.log(`(tagging-service)> File ${relativeFilePath} has been modified (size from meta: ${existingMeta.file.size}, size from file: ${fileStat.size}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir);
        return;
      } else {
        logger.log(`(tagging-service)> File ${relativeFilePath} is unchanged (size check passed)`);
        return;
      }
    }

    if (verificationMode === "size-and-hash") {
      const hash = await cryptoService.generateSha256HashFromFile(filePath, fileStat.size);
      if (existingMeta.hash.sha256 !== hash) {
        logger.log(`(tagging-service)> File ${relativeFilePath} has been modified (hash from meta: ${existingMeta.hash.sha256}, hash from file: ${hash}). It will be re-tagged.`);
        await this.tagFile(filePath, rootDir, metaDataRootDir);
        return;
      } else {
        logger.log(`(tagging-service)> File ${relativeFilePath} is unchanged (hash check passed)`);
        return;
      }
    }

    throw new Error("Code should not reach here");
  }

  async tagNewAndUpdateExisting(config: Config): Promise<void> {
    logger.log("(tagging-service)> Tagging new files and updating existing files");

    const fileToTagList: string[] = [];
    const fileToPotentialUpdateList: string[] = [];
    this.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, fileToPotentialUpdateList);

    for (const filePath of fileToTagList) {
      await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir);
    }

    for (const filePath of fileToPotentialUpdateList) {
      await this.updateFileTagIfNeeded(filePath, config.target.dir, config.target.metaDataDir || config.target.dir, config.verification.mode);
    }

    logger.log(`(tagging-service)> Tagged ${fileToTagList.length} files`);
  }

  async tagNewOnly(config: Config): Promise<void> {
    logger.log("(core-service)> Tagging new files");

    const fileToTagList: string[] = [];
    this.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList, []);

    for (const filePath of fileToTagList) {
      await this.tagFile(filePath, config.target.dir, config.target.metaDataDir || config.target.dir);
    }

    logger.log(`(tagging-service)> Tagged ${fileToTagList.length} files`);
  }

  private untagFiles(dir: string, counter: { count: number; }): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      const childPath = path.join(dir, child);
      const childStat = fs.statSync(childPath);
      if (childStat.isDirectory()) {
        this.untagFiles(childPath, counter);
        continue;
      }
      if (childStat.isFile() && child.startsWith(constants.META_FILE_PREFIX)) {
        logger.log(`(tagging-service)> Untagging file: ${childPath}`);
        fs.unlinkSync(childPath);
        counter.count++;
      }
    }
  }

  untag(config: Config): void {
    logger.log("(tagging-service)> Untagging files");

    const counter = { count: 0 };
    this.untagFiles(config.target.metaDataDir || config.target.dir, counter);

    logger.log(`(tagging-service)> Untagged ${counter.count} files`);
  }

}

export const taggingService = new TaggingService();
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { Config } from "../model/config.js";
import constants from "../constant/common-constants.js";
import { FileMetaData } from "../model/file-meta-data.js";
import { cryptoService } from "./crypto-service.js";

class TaggingService {

  private getMetaFilePath(childFilePath: string, rootDir: string, metaDataRootDir: string): string {
    const relativePath = childFilePath.replace(rootDir, "");
    const fileName = path.basename(relativePath);
    const dirPath = path.dirname(relativePath);
    const metaFileName = constants.META_FILE_PREFIX + fileName + constants.META_FILE_SUFFIX;
    return path.join(metaDataRootDir, dirPath, metaFileName);
  }

  private populateFilesToTag(dir: string, rootDir: string, metaDataRootDir: string, fileToTagList: string[]): void {
    const childList = fs.readdirSync(dir);
    for (const child of childList) {
      const childPath = path.join(dir, child);
      const childStat = fs.statSync(childPath);
      if (childStat.isDirectory()) {
        this.populateFilesToTag(childPath, rootDir, metaDataRootDir, fileToTagList);
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

  async tagNewOnly(config: Config): Promise<void> {
    logger.log("(core-service)> Tagging new files");

    const fileToTagList: string[] = [];
    this.populateFilesToTag(config.target.dir, config.target.dir, config.target.metaDataDir || config.target.dir, fileToTagList);

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
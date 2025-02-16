import path from "path";
import { Config } from "../model/config.js";

export function normalizePathsInConfig(config: Config) {
  config.target.dir = path.normalize(config.target.dir);
  if (config.target.metaDataDir) {
    config.target.metaDataDir = path.normalize(config.target.metaDataDir);
  }
  if (config.recovery?.mirrorDir) {
    config.recovery.mirrorDir = path.normalize(config.recovery.mirrorDir);
  }
  if (config.recovery?.mirrorMetaDataDir) {
    config.recovery.mirrorMetaDataDir = path.normalize(config.recovery.mirrorMetaDataDir);
  }

  if (config.target.dir.startsWith('\\')) {
    // it's a network path, so we need to convert it to a local path
    config.target.dir = "\\" + config.target.dir;
  }

  if (config.target.metaDataDir && config.target.metaDataDir.startsWith('\\')) {
    // it's a network path, so we need to convert it to a local path
    config.target.metaDataDir = "\\" + config.target.metaDataDir;
  }

  if (config.recovery?.mirrorDir && config.recovery.mirrorDir.startsWith('\\')) {
    // it's a network path, so we need to convert it to a local path
    config.recovery.mirrorDir = "\\" + config.recovery.mirrorDir;
  }

  if (config.recovery?.mirrorMetaDataDir && config.recovery.mirrorMetaDataDir.startsWith('\\')) {
    // it's a network path, so we need to convert it to a local path
    config.recovery.mirrorMetaDataDir = "\\" + config.recovery.mirrorMetaDataDir;
  }
}


import path from "path";
import constants from "../constant/common-constants.js";

export const getRecoveryFilePath = (childFilePath: string, rootDir: string, recoveryRootDir: string): string => {
  const relativePath = childFilePath.replace(rootDir, "");
  const fileName = path.basename(relativePath);
  const dirPath = path.dirname(relativePath);
  return path.join(recoveryRootDir, dirPath, fileName);
};

export const getMetaFilePath = (childFilePath: string, rootDir: string, metaDataRootDir: string): string => {
  const relativePath = childFilePath.replace(rootDir, "");
  const fileName = path.basename(relativePath);
  const dirPath = path.dirname(relativePath);
  const metaFileName = constants.META_FILE_PREFIX + fileName + constants.META_FILE_SUFFIX;
  return path.join(metaDataRootDir, dirPath, metaFileName);
};


export const getDataFilePath = (metaDataFilePath: string, rootDir: string, metaDataRootDir: string): string => {
  const relativePath = metaDataFilePath.replace(metaDataRootDir, "");
  let fileName = path.basename(relativePath);
  fileName = fileName.replace(constants.META_FILE_PREFIX, "");
  if (fileName.endsWith(constants.META_FILE_SUFFIX)) {
    fileName = fileName.substring(0, fileName.length - constants.META_FILE_SUFFIX.length);
  }
  const dirPath = path.dirname(relativePath);
  return path.join(rootDir, dirPath, fileName);
};
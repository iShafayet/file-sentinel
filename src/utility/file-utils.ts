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

export { ensureDir, resolvePath, getAbsolutePath, appRootDirPath, toFileUrl };

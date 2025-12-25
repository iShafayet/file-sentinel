import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { DeveloperError } from "./coded-error.js";

function extract(object: any, keyList: string[]) {
  if (typeof object !== "object" || object === null) {
    throw new DeveloperError(
      "GENERIC_OBJECT_NOT_OBJECT",
      "Expected object to be an object"
    );
  }
  let newObject: any = {};
  for (let key of keyList) {
    if (!object.hasOwnProperty(key)) {
      throw new DeveloperError(
        "GENERIC_OBJECT_KEY_MISSING",
        `Expected object to have key "${key}"`
      );
    }
    newObject[key] = object[key];
  }
  return newObject;
}

function strip(object: any, keyList: string[]): void {
  if ("object" !== typeof object) {
    return;
  }
  if (Array.isArray(object)) {
    object.forEach((_object) => strip(_object, keyList));
    return;
  }
  for (let key of keyList) {
    if (object.hasOwnProperty(key)) {
      delete object[key];
    }
  }
  return;
}

/**
 * Gets the version from package.json
 */
function getVersion(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, "../../../package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  return packageJson.version;
}

export { extract, strip, getVersion };

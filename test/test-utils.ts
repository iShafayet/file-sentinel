import { writeFileSync } from "fs";

import { mkdirSync } from "fs";
import { dirname, normalize } from "path";
import { join } from "path";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadTestConfig() {

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  if (!fs.existsSync(join(__dirname, ".env.test"))) {
    throw new Error("Test environment file not found. Expected at: " + join(__dirname, ".env.test"));
  }

  dotenv.config({ path: join(__dirname, ".env.test") });
  if (process.env.USE_EXTERNAL_TEST_DATA_DIR === "true") {
    console.log("Using external test data dir:", process.env.EXTERNAL_TEST_DATA_DIR);
    global.testDataDir = normalize(process.env.EXTERNAL_TEST_DATA_DIR || "");
  } else {
    console.log("Using internal test data dir:", join(__dirname, "file-sentinel-test-data"));
    global.testDataDir = join(__dirname, "file-sentinel-test-data");
  }

  const oneGB = 1024 * 1024 * 1024;
  global.largeFileSizeInBytes = parseInt(process.env.LARGE_FILE_SIZE_BYTES || (oneGB * 10).toString());
}

export function createTestFiles(testSubDir: string) {
  const testFiles: TestFile[] = sourceFiles;
  for (const file of testFiles) {
    const filePath = join(global.testDataDir, testSubDir, file.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, Buffer.from(new Uint8Array(file.sizeInBytes)));
  }
}

export function createSingleTestFile(testSubDir: string, fileName: string, sizeInBytes: number) {
  const filePath = join(global.testDataDir, testSubDir, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  const chunkSize = 100 * 1024 * 1024;
  const chunks = Math.ceil(sizeInBytes / chunkSize);
  for (let i = 0; i < chunks; i++) {
    console.log("Writing chunk", i, "of", chunks);
    const size = Math.min(chunkSize, Math.max(Math.floor(sizeInBytes - i * chunkSize), 0));
    const chunk = Buffer.from(new Uint8Array(size));
    writeFileSync(filePath, chunk, { flag: 'a' });
  }
}





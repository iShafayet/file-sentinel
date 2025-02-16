import { fileURLToPath } from "url";
import { dirname, join, normalize } from "path";
import { cpSync, mkdirSync, writeFileSync } from "fs";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";
import fs from "fs";
import dotenv from "dotenv";

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

function createTestFiles(testSubDir: string) {
  const testFiles: TestFile[] = sourceFiles;
  for (const file of testFiles) {
    const filePath = join(global.testDataDir, testSubDir, file.path);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, Buffer.from(new Uint8Array(file.sizeInBytes)));
  }
}

const setup = async () => {
  console.log("TESTSUITE SETUP");

  if (fs.existsSync(global.testDataDir)) {
    console.log("Removing existing test data directory:", global.testDataDir);
    fs.rmSync(global.testDataDir, { recursive: true, force: true });
  }

  mkdirSync(global.testDataDir, { recursive: true });
  mkdirSync(join(global.testDataDir, "set1"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set1-mirror1"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set1-metadata"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set1-mirror1-metadata"), { recursive: true });

  createTestFiles("set1");
  cpSync(join(global.testDataDir, "set1"), join(global.testDataDir, "set1-mirror1"), { recursive: true, preserveTimestamps: true });

  console.log("TESTSUITE SETUP DONE");
};

export default setup;

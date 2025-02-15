import { fileURLToPath } from "url";
import { dirname, join, normalize } from "path";
import { cpSync, mkdirSync, writeFileSync } from "fs";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// global.testDataDir = join(__dirname, "file-sentinel-test-data");
global.testDataDir = normalize(join("E:\\", "file-sentinel-test-data"));

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

  mkdirSync(global.testDataDir, { recursive: true });
  mkdirSync(join(global.testDataDir, "set1"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set1-mirror1"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set1-metadata"), { recursive: true });

  createTestFiles("set1");
  cpSync(join(global.testDataDir, "set1"), join(global.testDataDir, "set1-mirror1"), { recursive: true });

  console.log("TESTSUITE SETUP DONE");
};

export default setup;

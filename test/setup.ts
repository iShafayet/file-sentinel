import fs, { mkdirSync } from "fs";
import { loadTestConfig } from "./test-utils.js";
import { join } from "path";

loadTestConfig();

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

  mkdirSync(join(global.testDataDir, "set2"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set2-mirror1"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set2-metadata"), { recursive: true });
  mkdirSync(join(global.testDataDir, "set2-mirror1-metadata"), { recursive: true });

  console.log("TESTSUITE SETUP DONE");
};

export default setup;

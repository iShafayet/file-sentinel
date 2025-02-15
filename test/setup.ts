import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { mkdirSync } from "fs";

declare global {
  var testDataDir: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.testDataDir = join(__dirname, "file-sentinel-test-data");

const setup = async () => {
  console.log("TESTSUITE SETUP");

  mkdirSync(global.testDataDir, { recursive: true });

  // const configPath = join(__dirname, "config", "config.test.json");
  // let config = lookupAndLoadConfigAsync("", configPath);
  // let fileSentinel = new FileSentinelProgram();
  // await fileSentinel.start(config);
  // global.fileSentinel = fileSentinel;
  console.log("TESTSUITE SETUP DONE");
};

export default setup;

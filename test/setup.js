import { lookupAndLoadConfigAsync } from "../dist/utility/startup-utils.js";
import { FileSentinelProgram } from "../dist/index.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const setup = async () => {
  console.log("TESTSUITE SETUP");
  const configPath = join(__dirname, "config", "config.test.json");
  let config = lookupAndLoadConfigAsync("", configPath);
  let server = new FileSentinelProgram();
  await server.start(config);
  global.fileSentinel = server;
  console.log("TESTSUITE SETUP DONE");
};

export default setup;

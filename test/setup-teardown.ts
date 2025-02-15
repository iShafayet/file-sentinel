import { FileSentinelProgram } from "../src/index.js";
import { } from "./test-types.js";

const teardown = async () => {
  console.log("TESTSUITE TEARDOWN");
  if (global.fileSentinelList && global.fileSentinelList.length > 0) {
    for (const fileSentinel of global.fileSentinelList) {
      await fileSentinel.terminate();
    }
  }
  console.log("TESTSUITE TEARDOWN DONE");
};

export default teardown;

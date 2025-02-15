import { FileSentinelProgram } from "../src/index.js";

declare global {
  var fileSentinelList: FileSentinelProgram[];
}

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

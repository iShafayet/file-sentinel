import { join } from "path";
import { FileSentinelProgram } from "../src/index.js";
import { Config } from "../src/model/config.js";

describe("Basic: SET 1", (): void => {
  test("Tags should be created in the metadata directory", async (): Promise<void> => {
    const metadataDir = join(global.testDataDir, "set1-metadata");

    const config: Config = {
      operation: "tag-new-only",
      target: {
        dir: join(global.testDataDir, "set1"),
        metaDataDir: metadataDir
      },
      hashRecheckThresholdMillis: 0,
      verification: {
        mode: "size",
        hash: "sha256"
      },
      recovery: null,
      panicOnError: true
    };

    let fileSentinel = new FileSentinelProgram();
    await fileSentinel.start(config);
    await fileSentinel.terminate();
  });

  // eof
});

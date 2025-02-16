import { join } from "path";
import { FileSentinelProgram } from "../src/index.js";
import { Config } from "../src/model/config.js";
import { cpSync, statSync, utimesSync, writeFileSync } from "fs";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";
import { existsSync, unlinkSync } from "fs";
import { getMetaFilePath } from "../src/utility/meta-data-utils.js";
import { createSingleTestFile, createTestFiles, loadTestConfig } from "./test-utils.js";

loadTestConfig();

describe("Large file: SET 2", (): void => {

  test("setup should work", async (): Promise<void> => {
    createSingleTestFile("set2", "large-file.txt", global.largeFileSizeInBytes);
    cpSync(join(global.testDataDir, "set2"), join(global.testDataDir, "set2-mirror1"), { recursive: true, preserveTimestamps: true });
  });

  test("tag-new-only operation should work", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set2");
    const metadataDir = join(global.testDataDir, "set2-metadata");

    const config: Config = {
      operation: "tag-new-only",
      target: {
        dir: dataDir,
        metaDataDir: metadataDir
      },
      integrity: {
        skipTransparentlyModified: true,
        hashRecheckThresholdMillis: 0,
      },
      verification: {
        mode: "size",
        hash: "sha256"
      },
      recovery: null,
      panicOnError: true,
      verbose: true
    };

    let fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.tagAddedCount).toBe(1);
  });

  test("tag-new-only operation should work (mirror1)", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set2-mirror1");
    const metadataDir = join(global.testDataDir, "set2-mirror1-metadata");

    const config: Config = {
      operation: "tag-new-only",
      target: {
        dir: dataDir,
        metaDataDir: metadataDir
      },
      integrity: {
        skipTransparentlyModified: true,
        hashRecheckThresholdMillis: 0,
      },
      verification: {
        mode: "size",
        hash: "sha256"
      },
      recovery: null,
      panicOnError: true,
      verbose: true
    };

    let fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.tagAddedCount).toBe(1);
  });

  test("overwriting operation should work", async (): Promise<void> => {
    createSingleTestFile("set2", "large-file.txt", global.largeFileSizeInBytes);
  });

  test("verify-integrity should show 0 as passed, 1 as failed (skipTransparentlyModified: false)", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set2");
    const metadataDir = join(global.testDataDir, "set2-metadata");

    const config: Config = {
      operation: "verify-integrity",
      target: {
        dir: dataDir,
        metaDataDir: metadataDir
      },
      integrity: {
        skipTransparentlyModified: false,
        hashRecheckThresholdMillis: 0,
      },
      verification: {
        mode: "size",
        hash: "sha256"
      },
      recovery: null,
      panicOnError: true,
      verbose: true
    };

    let fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.verificationPassedCount).toBe(0);
    expect(executionResult.verificationFailedCount).toBe(1);
  });

  test("verify-and-recover should recover from mirror and verify successfully", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set2");
    const metadataDir = join(global.testDataDir, "set2-metadata");
    const mirrorDir = join(global.testDataDir, "set2-mirror1");
    const mirrorMetadataDir = join(global.testDataDir, "set2-mirror1-metadata");

    const config: Config = {
      operation: "verify-and-recover",
      target: {
        dir: dataDir,
        metaDataDir: metadataDir
      },
      integrity: {
        skipTransparentlyModified: false,
        hashRecheckThresholdMillis: 0,
      },
      verification: {
        mode: "size-and-hash",
        hash: "sha256"
      },
      recovery: {
        mirrorDir: mirrorDir,
        mirrorMetaDataDir: mirrorMetadataDir,
        mirrorModificationTakesPrecedence: true,
        verifyAfterRecovery: true
      },
      panicOnError: true,
      verbose: true
    };

    let fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.recoveredCount).toBe(1);
  }, 5 * 60 * 1000);


  // eof
});

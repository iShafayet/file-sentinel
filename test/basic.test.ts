import { join } from "path";
import { FileSentinelProgram } from "../src/index.js";
import { Config } from "../src/model/config.js";
import { cpSync, statSync, utimesSync, writeFileSync } from "fs";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";
import { existsSync, unlinkSync } from "fs";
import { getMetaFilePath } from "../src/utility/meta-data-utils.js";
import { createTestFiles } from "./test-utils.js";

describe("Basic: SET 1", (): void => {
  test("setup should work", async (): Promise<void> => {
    createTestFiles("set1");
    cpSync(join(global.testDataDir, "set1"), join(global.testDataDir, "set1-mirror1"), { recursive: true, preserveTimestamps: true });
  });

  test("tag-new-only operation should work", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

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
    expect(executionResult.tagAddedCount).toBe(sourceFiles.length);
  });

  test("Tags should be created in the metadata directory", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

    const testFiles: TestFile[] = sourceFiles;
    for (const file of testFiles) {
      const metadataPath = getMetaFilePath(file.path, dataDir, metadataDir);
      expect(existsSync(metadataPath)).toBe(true);
    }
  });

  test("tag-new-only operation should not add tags to existing files", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

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
    expect(executionResult.tagAddedCount).toBe(0);
  });

  test("Removing one metadata file should work", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

    // First file's metadata should not exist
    const firstFile = sourceFiles[0];
    const firstFileMetadata = getMetaFilePath(firstFile.path, dataDir, metadataDir);
    expect(existsSync(firstFileMetadata)).toBe(true);
    unlinkSync(firstFileMetadata);
    expect(existsSync(firstFileMetadata)).toBe(false);
  });

  test("tag-new-only operation should add 1 new tag", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

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

  test("tag-new-and-update-existing operation should add or update nothing", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

    const config: Config = {
      operation: "tag-new-and-update-existing",
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
    expect(executionResult.tagAddedCount).toBe(0);
    expect(executionResult.tagUpdatedCount).toBe(0);
  });

  test("we should be able to update a file", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");
    const firstTestFile = join(dataDir, sourceFiles[0].path);

    // Write random bytes to first test file
    const randomBytes = Buffer.from(new Uint8Array(sourceFiles[0].sizeInBytes));
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    writeFileSync(firstTestFile, randomBytes);
  });

  test("tag-new-and-update-existing operation should update 1 file", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

    const config: Config = {
      operation: "tag-new-and-update-existing",
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
    expect(executionResult.tagAddedCount).toBe(0);
    expect(executionResult.tagUpdatedCount).toBe(1);
  });

  test("mtime in set1 dir should match set1-mirror1 dir", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const mirrorDir = join(global.testDataDir, "set1-mirror1");

    const testFiles: TestFile[] = sourceFiles;
    for (const file of testFiles) {
      const originalPath = join(dataDir, file.path);
      const mirrorPath = join(mirrorDir, file.path);

      const originalStat = statSync(originalPath);
      let mirrorStat = statSync(mirrorPath);

      if (originalStat.mtime.getTime() !== mirrorStat.mtime.getTime()) {
        const mtime = originalStat.mtime;
        const atime = originalStat.atime;
        utimesSync(mirrorPath, atime, mtime);
        mirrorStat = statSync(mirrorPath);
      }

      expect(originalStat.mtime.getTime()).toBe(mirrorStat.mtime.getTime());
    }
  });

  test("tag-new-only operation should work (mirror1)", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1-mirror1");
    const metadataDir = join(global.testDataDir, "set1-mirror1-metadata");

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
    expect(executionResult.tagAddedCount).toBe(sourceFiles.length);
  });

  test("we should be able to update a file", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");
    const firstTestFile = join(dataDir, sourceFiles[0].path);

    // Write random bytes to first test file
    const randomBytes = Buffer.from(new Uint8Array(sourceFiles[0].sizeInBytes));
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
    writeFileSync(firstTestFile, randomBytes);
  });

  test("verify-integrity should show 9 as passed, 1 as skipped (skipTransparentlyModified: true)", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

    const config: Config = {
      operation: "verify-integrity",
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
    expect(executionResult.verificationPassedCount).toBe(9);
    expect(executionResult.verificationSkippedCount).toBe(1);
  });

  test("verify-integrity should show 9 as passed, 1 as failed (skipTransparentlyModified: false)", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");

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
    expect(executionResult.verificationPassedCount).toBe(9);
    expect(executionResult.verificationFailedCount).toBe(1);
  });

  test("verify-and-recover should recover from mirror and verify successfully", async (): Promise<void> => {
    const dataDir = join(global.testDataDir, "set1");
    const metadataDir = join(global.testDataDir, "set1-metadata");
    const mirrorDir = join(global.testDataDir, "set1-mirror1");
    const mirrorMetadataDir = join(global.testDataDir, "set1-mirror1-metadata");

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
    expect(executionResult.verificationPassedCount).toBe(9);
    expect(executionResult.recoverySuccessfulCount).toBe(1);
    expect(executionResult.recoveryFailedCount).toBe(0);
  });

  // eof
});

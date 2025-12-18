import { join } from "path";
import { FileSentinelProgram } from "../src/index.js";
import { DigestConfig, VerifyConfig, ReplicateConfig, HealConfig } from "../src/model/config.js";
import { cpSync, writeFileSync, existsSync, unlinkSync, readFileSync } from "fs";
import { TestFile } from "./test-types.js";
import { sourceFiles } from "./setup-paths.js";
import { createTestFiles, getDigestFilePath, getTestDirPath } from "./test-utils.js";

describe("Basic Digest Tests - v2", (): void => {
  test("setup should work", async (): Promise<void> => {
    createTestFiles("set1");
    cpSync(join(global.testDataDir, "set1"), join(global.testDataDir, "set1-mirror1"), {
      recursive: true,
      preserveTimestamps: true,
    });
  });

  test("digest operation should create digest for new directory", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    const config: DigestConfig = {
      command: "digest",
      inputDir: dataDir,
      digestFile: digestFile,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.filesAdded).toBe(sourceFiles.length);
    expect(executionResult.filesUpdated).toBe(0);
    expect(executionResult.filesUnchanged).toBe(0);
    expect(existsSync(digestFile)).toBe(true);
  });

  test("digest file should exist after first digest", async (): Promise<void> => {
    const digestFile = getDigestFilePath("set1");
    expect(existsSync(digestFile)).toBe(true);
  });

  test("digest operation should not add files again on second run", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    const config: DigestConfig = {
      command: "digest",
      inputDir: dataDir,
      digestFile: digestFile,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.errorCount).toBe(0);
    expect(executionResult.filesAdded).toBe(0);
    expect(executionResult.filesUnchanged).toBe(sourceFiles.length);
  });

  test("digest should detect modified file", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    // Modify first file
    const firstFile = sourceFiles[0];
    const firstFilePath = join(dataDir, firstFile.path);
    writeFileSync(firstFilePath, "modified content");

    const config: DigestConfig = {
      command: "digest",
      inputDir: dataDir,
      digestFile: digestFile,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesUpdated).toBe(1);
    expect(executionResult.filesUnchanged).toBe(sourceFiles.length - 1);
  });
});

describe("Basic Verify Tests - v2", (): void => {
  test("verify should pass for unchanged files", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    const config: VerifyConfig = {
      command: "verify",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesVerified).toBe(sourceFiles.length);
    expect(executionResult.filesFailed).toBe(0);
    expect(executionResult.filesMissing).toBe(0);
  });

  test("verify should detect corrupted file", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    // Corrupt second file
    const secondFile = sourceFiles[1];
    const secondFilePath = join(dataDir, secondFile.path);
    writeFileSync(secondFilePath, "corrupted");

    const config: VerifyConfig = {
      command: "verify",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      hashAlgorithm: "sha256",
      verbose: false,
      panicOnError: false,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(false);
    expect(executionResult.filesFailed).toBeGreaterThan(0);
  });

  test("verify should detect missing file", async (): Promise<void> => {
    const dataDir = getTestDirPath("set1");
    const digestFile = getDigestFilePath("set1");

    // Delete third file
    const thirdFile = sourceFiles[2];
    const thirdFilePath = join(dataDir, thirdFile.path);
    if (existsSync(thirdFilePath)) {
      unlinkSync(thirdFilePath);
    }

    const config: VerifyConfig = {
      command: "verify",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      hashAlgorithm: "sha256",
      verbose: false,
      panicOnError: false,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(false);
    expect(executionResult.filesMissing).toBeGreaterThan(0);
  });
});

describe("Basic Replicate Tests - v2", (): void => {
  test("setup replicate test", async (): Promise<void> => {
    // Create fresh set for replication tests
    createTestFiles("set2");

    // Create digest for source
    const sourceDir = getTestDirPath("set2");
    const sourceDigestFile = getDigestFilePath("set2");

    const config: DigestConfig = {
      command: "digest",
      inputDir: sourceDir,
      digestFile: sourceDigestFile,
      hashAlgorithm: "sha256",
      verbose: false,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
  });

  test("replicate should copy files to empty destination", async (): Promise<void> => {
    const sourceDir = getTestDirPath("set2");
    const sourceDigestFile = getDigestFilePath("set2");
    const destDir = getTestDirPath("set2-copy");
    const destDigestFile = getDigestFilePath("set2-copy");

    const config: ReplicateConfig = {
      command: "replicate",
      sourceDir: sourceDir,
      sourceDigestFile: sourceDigestFile,
      destDir: destDir,
      destDigestFile: destDigestFile,
      subdirectory: null,
      mirrors: [],
      permaDelete: false,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesCopied).toBe(sourceFiles.length);
    expect(existsSync(destDigestFile)).toBe(true);

    // Verify all files exist in destination
    for (const file of sourceFiles) {
      const destFilePath = join(destDir, file.path);
      expect(existsSync(destFilePath)).toBe(true);
    }
  });
});

describe("Basic Heal Tests - v2", (): void => {
  test("setup heal test with mirror", async (): Promise<void> => {
    // Create mirror with digest
    createTestFiles("set1-mirror1");
    const mirrorDir = getTestDirPath("set1-mirror1");
    const mirrorDigestFile = getDigestFilePath("set1-mirror1");

    const config: DigestConfig = {
      command: "digest",
      inputDir: mirrorDir,
      digestFile: mirrorDigestFile,
      hashAlgorithm: "sha256",
      verbose: false,
      panicOnError: true,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
  });

  test("heal should recover corrupted file from mirror", async (): Promise<void> => {
    const dataDir = getTestDirPath("set2-copy");
    const digestFile = getDigestFilePath("set2-copy");
    const mirrorDir = getTestDirPath("set2");
    const mirrorDigestFile = getDigestFilePath("set2");

    // Corrupt a file in destination
    const firstFile = sourceFiles[0];
    const corruptedFilePath = join(dataDir, firstFile.path);
    const originalContent = readFileSync(corruptedFilePath);
    writeFileSync(corruptedFilePath, "corrupted data");

    const config: HealConfig = {
      command: "heal",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      mirrors: [{ dir: mirrorDir, digestFile: mirrorDigestFile }],
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: false,
      dryRun: false,
      noTTY: false,
      ioTimeout: 30,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesRecovered).toBe(1);

    // Verify file was healed
    const healedContent = readFileSync(corruptedFilePath);
    expect(healedContent.length).toBe(originalContent.length);
  });
});

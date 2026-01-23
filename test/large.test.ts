import { join } from "path";
import { FileSentinelProgram } from "../src/index.js";
import { DigestConfig, VerifyConfig, ReplicateConfig } from "../src/model/config.js";
import { existsSync, writeFileSync } from "fs";
import { createSingleTestFile, getDigestFilePath, getTestDirPath } from "./test-utils.js";

describe("Large File Tests - v2", (): void => {
  const largeFileName = "large-file.bin";
  const largeFileSize = global.largeFileSizeInBytes;

  test("setup large file test", async (): Promise<void> => {
    console.log(
      `Creating large file: ${largeFileSize} bytes (${(largeFileSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`
    );
    createSingleTestFile("large", largeFileName, largeFileSize);
    const largeFilePath = join(getTestDirPath("large"), largeFileName);
    expect(existsSync(largeFilePath)).toBe(true);
  }, 600000); // 10 minute timeout

  test("digest large file", async (): Promise<void> => {
    const dataDir = getTestDirPath("large");
    const digestFile = getDigestFilePath("large");

    const config: DigestConfig = {
      command: "digest",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTty: true,
      ioTimeout: 300,
      compatibilityRiskStrategy: "abort",
      recencyThreshold: 0,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesAdded).toBe(1);
    expect(existsSync(digestFile)).toBe(true);
  }, 600000); // 10 minute timeout

  test("verify large file", async (): Promise<void> => {
    const dataDir = getTestDirPath("large");
    const digestFile = getDigestFilePath("large");

    const config: VerifyConfig = {
      command: "verify",
      inputDir: dataDir,
      digestFile: digestFile,
      subdirectory: null,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTty: true,
      ioTimeout: 300,
      recencyThreshold: 0,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesVerified).toBe(1);
    expect(executionResult.filesFailed).toBe(0);
  }, 600000); // 10 minute timeout

  test("replicate large file", async (): Promise<void> => {
    const sourceDir = getTestDirPath("large");
    const sourceDigestFile = getDigestFilePath("large");
    const destDir = getTestDirPath("large-copy");
    const destDigestFile = getDigestFilePath("large-copy");

    const config: ReplicateConfig = {
      command: "replicate",
      sourceDir: sourceDir,
      sourceDigestFile: sourceDigestFile,
      destDir: destDir,
      destDigestFile: destDigestFile,
      subdirectory: null,
      mirrors: [],
      permaDelete: false,
      validatePostCopy: true,
      hashAlgorithm: "sha256",
      verbose: true,
      panicOnError: true,
      dryRun: false,
      noTty: true,
      ioTimeout: 300,
      recencyThreshold: 0,
    };

    const fileSentinel = new FileSentinelProgram();
    const executionResult = await fileSentinel.execute(config);
    await fileSentinel.terminate();

    expect(executionResult.success).toBe(true);
    expect(executionResult.filesCopied).toBe(1);

    const copiedFilePath = join(destDir, largeFileName);
    expect(existsSync(copiedFilePath)).toBe(true);
  }, 600000); // 10 minute timeout
});

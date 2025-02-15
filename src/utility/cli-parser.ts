import { Command } from 'commander';
import { Config, ConfigSchema, Operation, VerificationMode } from '../model/config.js';

export const parseCommandLineArgs = (): Config | null => {
  const program = new Command();

  program
    .option('--config <path>', 'Config file path')
    .option('-o, --operation <type>', 'Operation type (untag|tag-new-only|tag-new-and-update|prune|verify-integrity|verify-and-recover)')
    .option('-d, --target-dir <path>', 'Target directory path')
    .option('-m, --target-metadata-dir <path>', 'Target metadata directory path')
    .option('--hash-recheck-threshold <milliseconds>', 'Hash recheck threshold in milliseconds', '3600000')
    .option('--verification-mode <mode>', 'Verification mode (size|size-and-hash)', 'size-and-hash')
    .option('--mirror-dir <path>', 'Mirror directory path for recovery')
    .option('--mirror-metadata-dir <path>', 'Mirror metadata directory path for recovery')
    .option('--mirror-precedence <bool>', 'Mirror modification takes precedence', 'false')
    .option('--verify-after-recovery <bool>', 'Verify after recovery', 'true')
    .option('--panic-on-error <bool>', 'Panic on error', 'false');

  program.parse();
  const options = program.opts();

  const config: Partial<Config> = {};

  if (options.operation) {
    config.operation = options.operation as Operation;
  }

  if (options.targetDir || options.targetMetadataDir) {
    config.target = {
      dir: options.targetDir,
      metaDataDir: options.targetMetadataDir || null
    };
  }

  if (options.hashRecheckThreshold) {
    config.hashRecheckThresholdMillis = parseInt(options.hashRecheckThreshold);
  }

  if (options.verificationMode) {
    config.verification = {
      mode: options.verificationMode as VerificationMode,
      hash: 'sha256'
    };
  }

  if (options.mirrorDir || options.mirrorMetadataDir) {
    config.recovery = {
      mirrorDir: options.mirrorDir,
      mirrorMetaDataDir: options.mirrorMetadataDir || null,
      mirrorModificationTakesPrecedence: options.mirrorPrecedence === 'true',
      verifyAfterRecovery: options.verifyAfterRecovery === 'true'
    };
  } else {
    config.recovery = null;
  }

  if (options.panicOnError) {
    config.panicOnError = options.panicOnError === 'true';
  }

  // If we have all required config from CLI, validate and return it
  if (config.operation && config.target) {
    const { error } = ConfigSchema.validate(config);
    if (!error) {
      return config as Config;
    } else {
      console.error("Invalid CLI configuration:", error);
    }
  }

  return null;
}; 
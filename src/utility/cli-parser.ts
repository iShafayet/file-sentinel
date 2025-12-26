import { Command } from "commander";
import { Config, DigestConfig, VerifyConfig, ReplicateConfig, HealConfig } from "../model/config.js";
import { parseInputOption } from "./path-utils.js";
import { getVersion } from "./misc-utils.js";

/**
 * Parses command line arguments and returns a Config object
 */
export function parseArgs(argv?: string[]): Config {
  const program = new Command();

  let parsedConfig: Config | null = null;

  program.name("file-sentinel").description("File integrity and replication tool").version(getVersion());

  // Digest command
  program
    .command("digest")
    .description("Create or update digest of a directory")
    .requiredOption(
      "-i, --input <dir::digest>",
      "Input directory and digest file (format: /path/to/dir::/path/to/digest.db)"
    )
    .option("-a, --hash-algorithm <algo>", "Hash algorithm", "sha256")
    .option("--verbose", "Verbose output", false)
    .option("--panic-on-error", "Exit on first error", false)
    .option("--dry-run", "Simulate without writing", false)
    .option("--no-tty", "Disable TTY mode (no colors, no interactive prompts)", true)
    .option("-t, --io-timeout <seconds>", "IO timeout in seconds", "30")
    .action((options) => {
      const { dir, digestFile } = parseInputOption(options.input);
      const config: DigestConfig = {
        command: "digest",
        inputDir: dir,
        digestFile: digestFile,
        hashAlgorithm: options.hashAlgorithm as "sha256",
        verbose: options.verbose,
        panicOnError: options.panicOnError,
        dryRun: options.dryRun,
        noTty: !options.tty, // Commander.js inverts --no-tty to options.tty
        ioTimeout: parseInt(options.ioTimeout, 10),
      };
      parsedConfig = config;
    });

  // Verify command
  program
    .command("verify")
    .description("Verify directory against digest")
    .requiredOption(
      "-i, --input <dir::digest>",
      "Input directory and digest file (format: /path/to/dir::/path/to/digest.db)"
    )
    .option("-s, --subdirectory <path>", "Subdirectory to verify")
    .option("-a, --hash-algorithm <algo>", "Hash algorithm", "sha256")
    .option("--verbose", "Verbose output", false)
    .option("--panic-on-error", "Exit on first error", false)
    .option("--dry-run", "Simulate without writing", false)
    .option("--no-tty", "Disable TTY mode (no colors, no interactive prompts)", true)
    .option("-t, --io-timeout <seconds>", "IO timeout in seconds", "30")
    .action((options) => {
      const { dir, digestFile } = parseInputOption(options.input);
      const config: VerifyConfig = {
        command: "verify",
        inputDir: dir,
        digestFile: digestFile,
        subdirectory: options.subdirectory || null,
        hashAlgorithm: options.hashAlgorithm as "sha256",
        verbose: options.verbose,
        panicOnError: options.panicOnError,
        dryRun: options.dryRun,
        noTty: !options.tty, // Commander.js inverts --no-tty to options.tty
        ioTimeout: parseInt(options.ioTimeout, 10),
      };
      parsedConfig = config;
    });

  // Replicate command
  program
    .command("replicate")
    .description("Replicate directory to destination")
    .requiredOption(
      "-i, --input <dir::digest>",
      "Source directory and digest file (format: /path/to/dir::/path/to/digest.db)"
    )
    .requiredOption(
      "-o, --output <dir::digest>",
      "Destination directory and digest file (format: /path/to/dir::/path/to/digest.db)"
    )
    .option("-s, --subdirectory <path>", "Subdirectory to replicate")
    .option(
      "--mirror <dir::digest>",
      "Mirror source (can be repeated, format: /path/to/dir::/path/to/digest.db)",
      collectMirrors,
      []
    )
    .option("--perma-delete", "Permanently delete instead of recycle", false)
    .option("--validate-post-copy", "Validate copied files after replication (default: enabled)", true)
    .option("--no-validate-post-copy", "Disable validation of copied files after replication", false)
    .option("-a, --hash-algorithm <algo>", "Hash algorithm", "sha256")
    .option("--verbose", "Verbose output", false)
    .option("--panic-on-error", "Exit on first error", false)
    .option("--dry-run", "Simulate without writing", false)
    .option("--no-tty", "Disable TTY mode (no colors, no interactive prompts)", true)
    .option("-t, --io-timeout <seconds>", "IO timeout in seconds", "30")
    .action((options: any) => {
      console.log(options);
      const source = parseInputOption(options.input);
      const dest = parseInputOption(options.output);
      const config: ReplicateConfig = {
        command: "replicate",
        sourceDir: source.dir,
        sourceDigestFile: source.digestFile,
        destDir: dest.dir,
        destDigestFile: dest.digestFile,
        subdirectory: options.subdirectory || null,
        mirrors: options.mirror,
        permaDelete: options.permaDelete,
        validatePostCopy: options.validatePostCopy ?? true, // Default to true
        hashAlgorithm: options.hashAlgorithm as "sha256",
        verbose: options.verbose,
        panicOnError: options.panicOnError,
        dryRun: options.dryRun,
        noTty: !options.tty, // Commander.js inverts --no-tty to options.tty
        ioTimeout: parseInt(options.ioTimeout, 10),
      };
      parsedConfig = config;
    });

  // Heal command
  program
    .command("heal")
    .description("Heal directory from mirrors")
    .requiredOption(
      "-i, --input <dir::digest>",
      "Directory and digest file to heal (format: /path/to/dir::/path/to/digest.db)"
    )
    .option("-s, --subdirectory <path>", "Subdirectory to heal")
    .requiredOption(
      "--mirror <dir::digest>",
      "Mirror source (can be repeated, at least one required, format: /path/to/dir::/path/to/digest.db)",
      collectMirrors,
      []
    )
    .option("--validate-post-copy", "Validate copied files after healing (default: enabled)", true)
    .option("--no-validate-post-copy", "Disable validation of copied files after healing", false)
    .option("-a, --hash-algorithm <algo>", "Hash algorithm", "sha256")
    .option("--verbose", "Verbose output", false)
    .option("--panic-on-error", "Exit on first error", false)
    .option("--dry-run", "Simulate without writing", false)
    .option("--no-tty", "Disable TTY mode (no colors, no interactive prompts)", true)
    .option("-t, --io-timeout <seconds>", "IO timeout in seconds", "30")
    .action((options: any) => {
      const { dir, digestFile } = parseInputOption(options.input);

      // Validate that at least one mirror is provided
      if (!options.mirror || options.mirror.length === 0) {
        console.error("Error: At least one --mirror must be provided for the heal command");
        process.exit(1);
      }

      const config: HealConfig = {
        command: "heal",
        inputDir: dir,
        digestFile: digestFile,
        subdirectory: options.subdirectory || null,
        mirrors: options.mirror,
        validatePostCopy: options.noValidatePostCopy ? false : (options.validatePostCopy ?? true), // Default to true unless --no-validate-post-copy is used
        hashAlgorithm: options.hashAlgorithm as "sha256",
        verbose: options.verbose,
        panicOnError: options.panicOnError,
        dryRun: options.dryRun,
        noTty: !options.tty, // Commander.js inverts --no-tty to options.tty
        ioTimeout: parseInt(options.ioTimeout, 10),
      };
      parsedConfig = config;
    });

  // Parse arguments
  if (argv) {
    program.parse(argv);
  } else {
    program.parse(process.argv);
  }

  // If no command was executed, show help and exit
  if (!parsedConfig) {
    program.help();
    process.exit(0);
  }

  return parsedConfig;
}

/**
 * Collector function for mirrors
 */
function collectMirrors(
  value: string,
  previous: Array<{ dir: string; digestFile: string }>
): Array<{ dir: string; digestFile: string }> {
  const parsed = parseInputOption(value);
  return [...previous, parsed];
}

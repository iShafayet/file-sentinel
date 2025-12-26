#!/usr/bin/env node

import { parseArgs } from "./utility/cli-parser.js";
import { FileSentinelProgram } from "./index.js";
import { logger } from "./lib/logger.js";
import { forceNonTTYMode } from "./utility/terminal-utils.js";

// Parse command line arguments
const config = parseArgs();

// Force non-TTY mode if requested
if (config.noTty) {
  forceNonTTYMode();
}

// Set logger verbosity
logger.setVerbosity(config.verbose);

// Handle SIGINT (Ctrl+C) to flush buffered logs before exiting
process.on("SIGINT", () => {
  const bufferedCount = logger.getBufferedLogCount();
  if (bufferedCount > 0) {
    console.log("\n");
    console.log("Interrupted by user. Flushing buffered logs...");
    logger.flushBufferedLogs();
  }
  process.exit(130); // Standard exit code for SIGINT
});

logger.debug("(start)> Configuration:", config);

// Execute program and handle exit code
new FileSentinelProgram()
  .execute(config)
  .then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  })
  .catch((error) => {
    logger.error(error);
    process.exit(1);
  });

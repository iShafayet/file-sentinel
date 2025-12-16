#!/usr/bin/env node

import { parseArgs } from "./utility/cli-parser.js";
import { FileSentinelProgram } from "./index.js";
import { logger } from "./lib/logger.js";

// Parse command line arguments
const config = parseArgs();

// Initialize logger
logger.init(config.verbose);

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

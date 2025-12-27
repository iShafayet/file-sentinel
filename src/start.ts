#!/usr/bin/env node

import { parseArgs } from "./utility/cli-parser.js";
import { FileSentinelProgram } from "./index.js";
import { logger } from "./lib/logger.js";
import { applyTtyAndVerbosityGlobally } from "./utility/misc-utils.js";

// Parse command line arguments
const config = parseArgs();

applyTtyAndVerbosityGlobally(config);

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

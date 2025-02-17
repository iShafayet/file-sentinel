#!/usr/bin/env node

import { Config } from "./model/config.js";
import {
  extractProcessParams,
  determineVerbosity,
  lookupAndLoadConfigAsync,
} from "./utility/startup-utils.js";
import { FileSentinelProgram } from "./index.js";
import { normalizePathsInConfig } from "./utility/config-utils.js";
import { logger } from "./lib/logger.js";

let commandLineParams = extractProcessParams();
const initialVerbosity = determineVerbosity(commandLineParams);
logger.init(initialVerbosity);

logger.debug("STARTUP Application parameters: ", commandLineParams);

let config: Config = lookupAndLoadConfigAsync(commandLineParams);
normalizePathsInConfig(config);

logger.setVerbosity(config.verbose);

logger.debug("STARTUP Config: ", config);

new FileSentinelProgram().execute(config);

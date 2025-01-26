#!/usr/bin/env node

import { Config } from "./model/config.js";
import {
  extractProcessParams,
  lookupAndLoadConfigAsync,
} from "./utility/startup-utils.js";
import { FileSentinelProgram } from "./index.js";

let commandLineParams = extractProcessParams();
console.log("STARTUP Application parameters: ", commandLineParams);

let config: Config = lookupAndLoadConfigAsync(commandLineParams);
new FileSentinelProgram().start(config);

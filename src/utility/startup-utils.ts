import { readFileSync } from "fs";
import { Config, ConfigSchema } from "../model/config.js";
import { parseCommandLineArgs } from "./cli-parser.js";
import { logger } from "../lib/logger.js";

export const extractProcessParams = () => {
  if (process.argv.length < 2) {
    throw new Error("Invalid number of arguments");
  }

  let index = process.argv.findIndex((arg) => {
    return arg.indexOf("start.js") > -1 || arg.indexOf("start-dev.js") > -1;
  });

  if (index === -1) {
    console.warn("Expected start.js or start-dev.js in process arguments.");
  } else {
    return process.argv.slice(index + 1);
  }

  return process.argv;
};

export const determineVerbosity = (commandLineParams: string[]) => {
  const index = commandLineParams.indexOf("--verbose");
  if (index === -1) {
    return false;
  }

  if (index === commandLineParams.length - 1) {
    return false;
  }

  const nextArg = commandLineParams[index + 1];

  return nextArg === "true";
};

const validateAndOptimizeConfig = (config: Config) => {
  const { error } = ConfigSchema.validate(config);
  if (error) {
    throw new Error(`Invalid config: ${error.message}`);
  }

  return config;
};

export const loadConfig = (path: string): Config => {
  logger.debug(`STARTUP trying to load configuration from: ${path}`);
  let content = readFileSync(<any>path, { encoding: "utf8" });
  logger.debug(`STARTUP loading config: ${content}`);
  const config = JSON.parse(content) as Config;
  validateAndOptimizeConfig(config);
  logger.debug(`STARTUP optimized config: ${JSON.stringify(config)}`);
  return config;
};

const ARG_CONFIG_LOCATION = "--config";
const ENVIRONMENT_CONFIG_LOCATION_KEY = "FILE_SENTINEL_CONFIG_LOCATION";

export const lookupAndLoadConfigAsync = (commandLineParams: string[], overrideConfigLocation?: string): Config => {
  // First try to load from command line arguments
  const cliConfig = parseCommandLineArgs();
  if (cliConfig) {
    return cliConfig;
  }

  // Otherwise fall back to config file. Process override from test suite (if any)
  if (overrideConfigLocation) {
    return loadConfig(overrideConfigLocation);
  }

  // Next priority is the command line parameter;
  if (commandLineParams.indexOf(ARG_CONFIG_LOCATION) > -1) {
    let index = commandLineParams.indexOf(ARG_CONFIG_LOCATION) + 1;
    let configLocation = commandLineParams[index];

    logger.debug(
      "STARTUP Config location (from command line): ",
      configLocation
    );
    return loadConfig(configLocation);
  }

  // Next priority is the environment variable;
  if (process.env[ENVIRONMENT_CONFIG_LOCATION_KEY]) {
    let configLocation = process.env[ENVIRONMENT_CONFIG_LOCATION_KEY];
    logger.debug(
      "STARTUP Config location (from environment variable): ",
      configLocation
    );
    return loadConfig(configLocation);
  }

  throw new Error("No valid configuration found from CLI args or config file");
};

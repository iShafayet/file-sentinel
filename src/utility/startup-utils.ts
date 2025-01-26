import { readFileSync } from "fs";
import { Config, ConfigSchema } from "../model/config.js";

export const extractProcessParams = () => {
  console.log("STARTUP extractProcessParams", process.argv);

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

const validateAndOptimizeConfig = (config: Config) => {
  const { error } = ConfigSchema.validate(config);
  if (error) {
    throw new Error(`Invalid config: ${error.message}`);
  }

  return config;
};

export const loadConfig = (path: string): Config => {
  console.log(`STARTUP trying to load configuration from: ${path}`);
  let content = readFileSync(<any>path, { encoding: "utf8" });
  console.log(`STARTUP loading config: ${content}`);
  const config = JSON.parse(content) as Config;
  validateAndOptimizeConfig(config);
  console.log(`STARTUP optimized config: ${JSON.stringify(config)}`);
  return config;
};

const ARG_CONFIG_LOCATION = "--config";
const ENVIRONMENT_CONFIG_LOCATION_KEY = "BLOBER_CONFIG_LOCATION";

export const lookupAndLoadConfigAsync = (commandLineParams: string[], overrideConfigLocation?: string) => {
  if (overrideConfigLocation) {
    return loadConfig(overrideConfigLocation);
  }

  // First priority is the command line parameter;
  if (commandLineParams.indexOf(ARG_CONFIG_LOCATION) > -1) {
    let index = commandLineParams.indexOf(ARG_CONFIG_LOCATION) + 1;
    let configLocation = commandLineParams[index];

    console.log(
      "STARTUP Config location (from command line): ",
      configLocation
    );
    return loadConfig(configLocation);
  }

  // Next priority is the environment variable;
  if (process.env[ENVIRONMENT_CONFIG_LOCATION_KEY]) {
    let configLocation = process.env[ENVIRONMENT_CONFIG_LOCATION_KEY];
    console.log(
      "STARTUP Config location (from environment variable): ",
      configLocation
    );
    return loadConfig(configLocation);
  }

  throw new Error("No config location found");
};

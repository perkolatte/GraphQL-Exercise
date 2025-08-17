// Utility for loading config and resolving query variables
//
// Design by Contract: Each function documents its expected input and output, and asserts preconditions.

const fs = require("fs");
const path = require("path");

/**
 * Loads the config file as a JS object.
 * @param {string} [configFile] - Path to config file (default: run-all-queries.config.json)
 * @returns {object} Parsed config object
 * @throws {Error} If config file is invalid JSON
 */
function loadConfig(configFile = "run-all-queries.config.json") {
  if (typeof configFile !== "string" || !configFile.endsWith(".json")) {
    throw new Error("configFile must be a .json filename string");
  }
  const configPath = path.resolve(process.cwd(), configFile);
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) || {};
  } catch (err) {
    throw new Error(`Invalid JSON in ${configFile}: ${err.message || err}`);
  }
}

/**
 * Resolves variables for a given query file from config, merged with defaults.
 * @param {object} config - Config object
 * @param {string} queryFile - Absolute path to query file
 * @param {object} [defaults] - Default variables
 * @returns {object} Variables object
 * @throws {Error} If config is not an object or queryFile is not a string
 */
function getQueryVariables(config, queryFile, defaults = {}) {
  if (typeof config !== "object" || config === null) {
    throw new Error("config must be an object");
  }
  if (typeof queryFile !== "string" || !queryFile.endsWith(".graphql")) {
    throw new Error("queryFile must be a .graphql filename string");
  }
  if (typeof defaults !== "object" || defaults === null) {
    throw new Error("defaults must be an object");
  }
  const relPath = path.relative(process.cwd(), queryFile).replace(/\\/g, "/");
  let vars =
    config[relPath] && typeof config[relPath] === "object"
      ? config[relPath]
      : {};
  return { ...defaults, ...vars };
}

module.exports = {
  loadConfig,
  getQueryVariables,
};

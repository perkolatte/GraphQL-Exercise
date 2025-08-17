// Utility for loading config and resolving query variables
const fs = require("fs");
const path = require("path");

function loadConfig(configFile = "run-all-queries.config.json") {
  const configPath = path.resolve(process.cwd(), configFile);
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) || {};
  } catch (err) {
    throw new Error(`Invalid JSON in ${configFile}: ${err.message || err}`);
  }
}

function getQueryVariables(config, queryFile, defaults = {}) {
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

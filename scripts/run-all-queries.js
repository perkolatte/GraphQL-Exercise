#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { executeQuery } = require("../lib/graphql-client");
const { findGraphqlFiles } = require("../lib/io");
const { sanitizeQuery } = require("../lib/sanitize-query");
const { getQueryVariables } = require("../lib/config");
const { prettyPrintResponse } = require("../lib/pretty-print");

// Utility to check if query contains required variables (simple heuristic)
function requiresRequiredVariables(query) {
  // Checks for $variable in query string
  return /\$[a-zA-Z_][a-zA-Z0-9_]*/.test(query);
}

const configPath = path.resolve(__dirname, "..", "run-all-queries.config.json");
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  // If config missing or invalid, fallback to empty config
  config = {};
}
const orderedQueryList = Array.isArray(config.order)
  ? config.order.map((q) => path.resolve(__dirname, "..", q))
  : [];

const scriptMapping = config.mapping || {};

const GRAPHQL_ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

// Parse CLI flags for this runner: support --raw to emit full JSON
// ...existing code...
// ...existing code...

// Removed incomplete async function main block. All logic is now in the async IIFE below.

(async () => {
  try {
    const queriesDir = path.resolve(__dirname, "..", "queries");
    if (!fs.existsSync(queriesDir)) {
      console.error("queries/ directory not found");
      process.exit(1);
    }

    const discoveredQueries = await findGraphqlFiles(queriesDir);
    // normalize discovery to absolute paths
    const discoveredSet = new Set(
      discoveredQueries.map((queryPath) => path.resolve(queryPath))
    );

    // if orderedQueryList provided, start with those entries (only if they exist)
    let queryFilesToRun = [];
    if (orderedQueryList.length) {
      for (const entry of orderedQueryList) {
        if (discoveredSet.has(entry)) {
          queryFilesToRun.push(entry);
          discoveredSet.delete(entry);
        } else if (fs.existsSync(entry)) {
          // allow running files outside queries/ if user provided full path
          queryFilesToRun.push(entry);
        }
      }
      // append any remaining discovered files in sorted order for determinism
      const remaining = Array.from(discoveredSet).sort();
      queryFilesToRun.push(...remaining);
    } else {
      queryFilesToRun = discoveredQueries;
    }

    if (!queryFilesToRun || queryFilesToRun.length === 0) {
      console.error("No .graphql files found under queries/");
      process.exit(1);
    }

    for (const queryFilePath of queryFilesToRun) {
      const relativeQueryPath = path.relative(process.cwd(), queryFilePath);
      process.stderr.write("\n=== " + relativeQueryPath + " ===\n");
      const queryText = fs.readFileSync(queryFilePath, "utf8");
      const sanitizedQuery = sanitizeQuery(queryText);
      if (!sanitizedQuery) {
        process.stderr.write(" (empty query)\n");
        continue;
      }
      // supply variables from config if present
      const resolvedVariables = getQueryVariables(config, queryFilePath);

      if (
        requiresRequiredVariables(sanitizedQuery) &&
        (!resolvedVariables || Object.keys(resolvedVariables).length === 0)
      ) {
        process.stderr.write(
          " (skipped: requires variables  add them to run-all-queries.config.json)\n"
        );
        continue;
      }

      try {
        // Prefer script output when mapping provided in config
        const normalizedRelKey = relativeQueryPath.replace(/\\/g, "/");
        if (scriptMapping[normalizedRelKey]) {
          const mappedScriptRel = scriptMapping[normalizedRelKey];
          const mappedScriptPath = path.resolve(process.cwd(), mappedScriptRel);
          if (fs.existsSync(mappedScriptPath)) {
            const { spawnSync } = require("child_process");
            const output = spawnSync(process.execPath, [mappedScriptPath], {
              encoding: "utf8",
            });
            if (output.error) {
              process.stderr.write(" (error running mapped script)\n");
              process.stderr.write(output.error.message + "\n");
            } else {
              process.stderr.write(output.stdout);
              process.stderr.write(output.stderr);
            }
            continue;
          } else {
            console.error(`Mapped script not found: ${mappedScriptPath}`);
          }
        }

        const graphqlResponse = await executeQuery(GRAPHQL_ENDPOINT, {
          query: sanitizedQuery,
          variables: resolvedVariables || {},
        });

        // Use dedicated formatters for custom output
        const {
          formatCharacterProfile,
          formatFilmCharacters,
          formatAggregateStats,
          printFormatted,
        } = require("../lib/formatters");
        if (
          normalizedRelKey.endsWith(
            "queries/complex/full-character-profile.graphql"
          ) &&
          graphqlResponse &&
          graphqlResponse.data &&
          graphqlResponse.data.person
        ) {
          printFormatted(formatCharacterProfile(graphqlResponse.data.person));
        } else if (
          normalizedRelKey.endsWith(
            "queries/advanced/characters-in-film.graphql"
          ) &&
          graphqlResponse &&
          graphqlResponse.data &&
          graphqlResponse.data.film
        ) {
          printFormatted(formatFilmCharacters(graphqlResponse.data.film));
        } else if (
          normalizedRelKey.endsWith(
            "queries/advanced/aggregate-film-stats.graphql"
          ) &&
          graphqlResponse &&
          graphqlResponse.data &&
          graphqlResponse.data.allFilms &&
          Array.isArray(graphqlResponse.data.allFilms.films)
        ) {
          printFormatted(
            formatAggregateStats(graphqlResponse.data.allFilms.films)
          );
        } else {
          prettyPrintResponse(graphqlResponse);
        }
      } catch (err) {
        throw err;
      }
    }
    return 0;
  } catch (err) {
    // For CLI, print error and return error object
    console.error(err && err.stack ? err.stack : err);
    return err;
  }
})();
// End of file

/* eslint-disable no-console */
const path = require("path");
const { readQueryFile, parseVariablesArg } = require("./lib/io");
const { executeQuery, printGraphQLErrors } = require("./lib/graphql");

/**
 * Exit codes:
 * 0 = success
 * 1 = usage / setup error (bad args, bad JSON, missing file)
 * 2 = GraphQL "errors" present
 * 3 = HTTP error (non-2xx)
 * 4 = network error / no response
 */
const DEFAULT_ENDPOINT = "https://swapi-graphql.netlify.app/graphql";

// ...IO and GraphQL helpers are in lib/*

const usage = () => {
  console.error(
    [
      "Usage:",
      "  node script.js <query.graphql|-> [variables-json|@vars.json] [operationName] [endpoint]",
      "",
      "Notes:",
      "  - Use '-' as the query path to read from stdin.",
      "  - Variables can be inline JSON or '@path/to/vars.json'.",
      "  - operationName is required if your .graphql has multiple operations.",
      "  - endpoint can also be provided via ENV: API_ENDPOINT.",
      "",
      "Examples:",
      "  node script.js query.graphql",
      '  node script.js query.graphql \'{"id":"cGVvcGxlOjE="}\'',
      "  node script.js query.graphql @vars.json GetPerson",
      "  API_ENDPOINT=https://example.com/graphql node script.js - @vars.json",
    ].join("\n")
  );
};

const main = async () => {
  const [queryArg, varsArg, opNameArg, endpointArg] = process.argv.slice(2);

  if (!queryArg) {
    usage();
    process.exit(1);
  }

  try {
    let query = await readQueryFile(queryArg);

    // If the .graphql file was copied from a Markdown document it may include
    // fenced code blocks (``` or ```graphql). Strip those so the server gets
    // a plain GraphQL document.
    if (query.startsWith("```")) {
      const lines = query.split(/\r?\n/);
      // drop opening fence
      if (lines[0].match(/^```/)) lines.shift();
      // drop trailing fence if present
      if (lines.length && lines[lines.length - 1].match(/```$/)) lines.pop();
      query = lines.join("\n").trim();
    }
    if (!query) {
      console.error(`Error: empty query from "${queryArg}".`);
      process.exit(1);
    }

    let variables = {};
    if (varsArg) {
      try {
        variables = await parseVariablesArg(varsArg);
      } catch (e) {
        console.error("Invalid variables input. Provide JSON or @file.json");
        console.error(e.message);
        process.exit(1);
      }
    }

    const endpoint =
      endpointArg || process.env.API_ENDPOINT || DEFAULT_ENDPOINT;

    console.log(`Executing against: ${endpoint}`);
    const result = await executeQuery(endpoint, {
      query,
      variables,
      operationName: opNameArg || undefined,
    });

    // Pretty-print successful data (and any extensions if present)
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e) {
    if (e.gqlErrors) {
      console.error("--- GraphQL Errors ---");
      printGraphQLErrors(e.gqlErrors);
      // Also print the returned partial data if any:
      if (e.data && e.data.data) {
        console.error("\n--- Partial Data ---");
        console.error(JSON.stringify(e.data.data, null, 2));
      }
      process.exit(e.exitCode || 2);
    }

    if (e.httpStatus) {
      console.error(`--- HTTP Error ${e.httpStatus} ---`);
      if (e.httpBody) console.error(e.httpBody);
      process.exit(e.exitCode || 3);
    }

    console.error(`--- ${e.message} ---`);
    process.exit(e.exitCode || 1);
  }
};

main();

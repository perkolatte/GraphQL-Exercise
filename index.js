#!/usr/bin/env node
const path = require("path");
const { readQueryFile, parseVariablesArg } = require("./lib/cli");
const { executeQuery, printGraphQLErrors } = require("./lib/graphql-client");

const DEFAULT_ENDPOINT = "https://star-wars-sb.netlify.app/graphql";

// resolvePath: supports dot paths and array mapping 'items[]'
const resolvePath = (value, path) => {
  if (!path) return value;
  const segs = path.split(".").filter(Boolean);

  const walk = (val, segments) => {
    if (val === null || val === undefined) return undefined;
    if (!segments.length) return val;
    const [head, ...rest] = segments;
    if (head.endsWith("[]")) {
      const key = head.slice(0, -2);
      const { prettyPrintResponse } = require("./lib/pretty-print");
      console.log(`${indent}      - ${sub}`);
    } else if (typeof sub === "object") {
      // ...existing code...
      const v = res.data[k];
      const heading = k[0].toUpperCase() + k.slice(1) + ":";
      console.log(heading);
      if (Array.isArray(v)) {
        // condense single-key arrays
        const singleKey = (() => {
          if (!v.length) return null;
          let kk = null;
          for (const it of v) {
            if (!it || typeof it !== "object") return null;
            const keys = Object.keys(it);
            if (keys.length !== 1) return null;
            if (kk === null) kk = keys[0];
            else if (kk !== keys[0]) return null;
          }
          return kk;
        })();
        if (singleKey) {
          for (const item of v) {
            const val = item && item[singleKey];
            if (val === null || val === undefined) continue;
            console.log(`  - ${String(val)}`);
          }
          console.log("");
          return;
        }
        for (const it of v) {
          if (typeof it === "object") prettyPrintObject(it, "  ");
          else console.log("  " + String(it));
        }
        console.log("");
        return;
      }
      if (typeof v === "object") {
        prettyPrintObject(v, "  ");
        console.log("");
        return;
      }
      console.log(String(v));
      console.log("");
      return;
    }
    prettyPrintObject(res.data, "");
    return;
  };

  console.log(JSON.stringify(res, null, 2));
};

const usage = () => {
  console.error(
    [
      "Usage:",
      "  node index.js <query.graphql|-> [variables-json|@vars.json] [operationName] [endpoint] [--select path] [--raw]",
      "",
      "Notes:",
      "  - Use '-' as the query path to read from stdin.",
      "  - Variables can be inline JSON or '@path/to/vars.json'.",
      "  - operationName is required if your .graphql has multiple operations.",
    ].join("\n")
  );
};

const main = async () => {
  const argv = process.argv.slice(2);
  let queryArg = argv[0];
  if (!queryArg) {
    usage();
    process.exit(1);
  }

  let idx = 1;
  const pickIfPositional = () => {
    if (idx < argv.length && !argv[idx].startsWith("--")) return argv[idx++];
    return undefined;
  };

  const varsArg = pickIfPositional();
  const opNameArg = pickIfPositional();
  const endpointArg = pickIfPositional();

  let selectArg;
  let labelArg;
  let rawFlag = false;
  while (idx < argv.length) {
    const a = argv[idx++];
    if (a === "--select" || a === "-s") selectArg = argv[idx++];
    else if (a === "--label" || a === "-l") labelArg = argv[idx++];
    else if (a === "--raw") rawFlag = true;
    else if (a.startsWith("--select=")) selectArg = a.split("=")[1];
    else if (a.startsWith("--label=")) labelArg = a.split("=")[1];
  }

  try {
    let query = await readQueryFile(queryArg);
    if (!query) {
      console.error(`Error: empty query from "${queryArg}".`);
      process.exit(1);
    }
    // strip fenced code block if present
    if (query.startsWith("```")) {
      const lines = query.split(/\r?\n/);
      if (lines[0].match(/^```/)) lines.shift();
      if (lines.length && lines[lines.length - 1].match(/```$/)) lines.pop();
      query = lines.join("\n").trim();
    }

    let variables = {};
    if (varsArg) {
      variables = await parseVariablesArg(varsArg);
    }

    const endpoint =
      endpointArg || process.env.API_ENDPOINT || DEFAULT_ENDPOINT;
    console.error(`Executing against: ${endpoint}`);
    const result = await executeQuery(endpoint, {
      query,
      variables,
      operationName: opNameArg || undefined,
    });

    if (selectArg) {
      printSelection(result, selectArg, labelArg, rawFlag);
    } else {
      prettyPrintResponse(result, { raw: rawFlag });
    }
    process.exit(0);
  } catch (e) {
    if (e && e.gqlErrors) {
      console.error("--- GraphQL Errors ---");
      printGraphQLErrors(e.gqlErrors);
      if (e.data && e.data.data) {
        console.error("\n--- Partial Data ---");
        console.error(JSON.stringify(e.data.data, null, 2));
      }
      process.exit(e.exitCode || 2);
    }
    if (e && e.httpStatus) {
      console.error(`--- HTTP Error ${e.httpStatus} ---`);
      if (e.httpBody) console.error(e.httpBody);
      process.exit(e.exitCode || 3);
    }
    console.error(`--- ${e && e.message ? e.message : String(e)} ---`);
    process.exit(e && e.exitCode ? e.exitCode : 1);
  }
};

main();

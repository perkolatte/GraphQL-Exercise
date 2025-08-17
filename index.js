const path = require("path");
const { readQueryFile, parseVariablesArg } = require("./lib/cli");
const { executeQuery, printGraphQLErrors } = require("./lib/graphql-client");
const { assert, assertString } = require("./lib/asserts");

// Helper: resolve a dot-path from a nested object. Supports array mapping via 'key[]'
// Contract: resolvePath(value, path) -> returns `undefined` when path not present; otherwise the selected value
const resolvePath = (value, path) => {
  if (!path) return value;
  const segs = path.split(".").filter(Boolean);

  const walk = (val, segments) => {
    if (val === null || val === undefined) return undefined;
    if (!segments.length) return val;
    const [head, ...rest] = segments;
    // handle map over arrays: 'items[]'
    if (head.endsWith("[]")) {
      const key = head.slice(0, -2);
      const arr = val[key];
      if (!Array.isArray(arr)) return [];
      return arr.map((it) => walk(it, rest)).flat();
    }
    // numeric index
    if (/^\d+$/.test(head)) {
      const idx = Number(head);
      return walk(val[idx], rest);
    }
    return walk(val[head], rest);
  };

  return walk(value, segs);
};

// Helper: print a selected value with optional heading. Keeps output formatting orthogonal.
// Contract: printSelection(result, selectPath, label) -> prints to stdout, one item per-line when array
const printSelection = (result, selectPath, label) => {
  const out = resolvePath(result, selectPath);
  if (out === undefined) return; // nothing found - intentionally silent (caller may decide to error)

  if (label) console.log(label);
  if (Array.isArray(out)) {
    out.forEach((v) => {
      if (v === null || v === undefined) return;
      if (typeof v === "object") console.log(JSON.stringify(v));
      else console.log(String(v));
    });
    return;
  }
  if (typeof out === "object") {
    console.log(JSON.stringify(out, null, 2));
  } else {
    console.log(String(out));
  }
};

/**
 * Exit codes:
 * 0 = success
 * 1 = usage / setup error (bad args, bad JSON, missing file)
 * 2 = GraphQL "errors" present
 * 3 = HTTP error (non-2xx)
 * 4 = network error / no response
 */
const DEFAULT_ENDPOINT = "https://star-wars-sb.netlify.app/graphql";

// ...IO and GraphQL helpers are in lib/*

const usage = () => {
  console.error(
    [
      "Usage:",
      "  node script.js <query.graphql|-> [variables-json|@vars.json] [operationName] [endpoint] [--select path]",
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
  // Basic positional args first; allow flags after them
  const argv = process.argv.slice(2);
  let queryArg = argv[0];
  if (!queryArg) {
    usage();
    process.exit(1);
  }

  // consume positionals unless they look like flags
  let idx = 1;
  const pickIfPositional = () => {
    if (idx < argv.length && !argv[idx].startsWith("--")) return argv[idx++];
    return undefined;
  };

  const varsArg = pickIfPositional();
  const opNameArg = pickIfPositional();
  const endpointArg = pickIfPositional();

  // simple flag parsing for --select or -s
  let selectArg;
  let labelArg;
  while (idx < argv.length) {
    const a = argv[idx++];
    if (a === "--select" || a === "-s") {
      selectArg = argv[idx++];
    } else if (a === "--label" || a === "-l") {
      labelArg = argv[idx++];
    } else if (a.startsWith("--select=")) {
      selectArg = a.split("=")[1];
    } else if (a.startsWith("--label=")) {
      labelArg = a.split("=")[1];
    } else {
      // ignore unknown flags for now
    }
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

    // parse variables if provided
    let variables = {};
    if (varsArg) {
      try {
        variables = await parseVariablesArg(varsArg);
      } catch (err) {
        console.error("Invalid variables input. Provide JSON or @file.json");
        console.error(err.message);
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

    // If a select path was provided, print only that path.
    const resolvePath = (value, path) => {
      if (!path) return value;
      const segs = path.split(".").filter(Boolean);

      const walk = (val, segments) => {
        if (val === null || val === undefined) return undefined;
        if (!segments.length) return val;
        const [head, ...rest] = segments;
        // handle map over arrays: 'items[]'
        if (head.endsWith("[]")) {
          const key = head.slice(0, -2);
          const arr = val[key];
          if (!Array.isArray(arr)) return [];
          return arr.map((it) => walk(it, rest)).flat();
        }
        // numeric index
        if (/^\d+$/.test(head)) {
          const idx = Number(head);
          return walk(val[idx], rest);
        }
        return walk(val[head], rest);
      };

      return walk(value, segs);
    };

    if (selectArg) {
      const out = resolvePath(result, selectArg);
      if (out === undefined) {
        // nothing found
        process.exit(0);
      }
      // If labelArg supplied, print it as a heading
      if (labelArg) {
        console.log(labelArg);
      }
      if (Array.isArray(out)) {
        // print each primitive or JSON for objects on its own line
        out.forEach((v) => {
          if (v === null || v === undefined) return;
          if (typeof v === "object") console.log(JSON.stringify(v));
          else console.log(String(v));
        });
      } else if (typeof out === "object") {
        // print heading + JSON
        console.log(JSON.stringify(out, null, 2));
      } else {
        // scalar - print on same line as label if provided, else alone
        console.log(String(out));
      }
    } else {
      // Pretty-print successful data (and any extensions if present)
      console.log(JSON.stringify(result, null, 2));
    }
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

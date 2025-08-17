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
      const arr = val[key];
      if (!Array.isArray(arr)) return [];
      return arr.map((it) => walk(it, rest)).flat();
    }
    if (/^\d+$/.test(head)) {
      const idx = Number(head);
      return walk(val[idx], rest);
    }
    return walk(val[head], rest);
  };

  return walk(value, segs);
};

const printSelection = (result, selectPath, label, raw) => {
  const out = resolvePath(result, selectPath);
  if (out === undefined) return;
  if (label) console.log(label);
  if (Array.isArray(out)) {
    out.forEach((v) => {
      if (v === null || v === undefined) return;
      if (typeof v === "object") {
        if (raw) console.log(JSON.stringify(v, null, 2));
        else console.log(JSON.stringify(v));
      } else console.log(String(v));
    });
    return;
  }
  if (typeof out === "object") {
    if (raw) console.log(JSON.stringify(out, null, 2));
    else console.log(JSON.stringify(out));
  } else {
    console.log(String(out));
  }
};

function prettyPrintResponse(res, opts = {}) {
  const raw = !!opts.raw;
  if (!res) return;
  if (raw) {
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  const prettyPrintObject = (obj, indent = "") => {
    if (obj === null || obj === undefined) {
      console.log(indent + "null");
      return;
    }
    if (typeof obj !== "object") {
      console.log(indent + String(obj));
      return;
    }

    const keys = Object.keys(obj);
    for (const k of keys) {
      const v = obj[k];
      const label = k[0].toUpperCase() + k.slice(1);
      if (v === null || v === undefined) {
        console.log(`${indent}${label}: ${v}`);
      } else if (Array.isArray(v)) {
        console.log(`${indent}${label}:`);
        if (v.length === 0) {
          console.log(`${indent}  (empty)`);
        } else {
          for (const item of v) {
            if (item === null || item === undefined) {
              console.log(`${indent}  - ${item}`);
              continue;
            }
            if (typeof item === "object") {
              const keysInner = Object.keys(item);
              let summary = null;
              let summaryKey = null;
              if (item.name) {
                summary = String(item.name);
                summaryKey = "name";
              } else if (item.title) {
                summary = String(item.title);
                summaryKey = "title";
              } else {
                for (const kk of keysInner) {
                  const vv = item[kk];
                  if (
                    vv === null ||
                    Array.isArray(vv) ||
                    typeof vv === "object"
                  )
                    continue;
                  summary = `${kk}: ${String(vv)}`;
                  summaryKey = kk;
                  break;
                }
              }
              if (!summary) {
                if (item.id) {
                  summary = String(item.id);
                  summaryKey = "id";
                } else {
                  summary = JSON.stringify(item).slice(0, 80);
                }
              }
              console.log(`${indent}  - ${summary}`);
              for (const kk of keysInner) {
                if (kk === summaryKey) continue;
                const vv = item[kk];
                const kkLabel = kk[0].toUpperCase() + kk.slice(1);
                if (vv === null || vv === undefined) {
                  console.log(`${indent}    ${kkLabel}: ${vv}`);
                } else if (Array.isArray(vv)) {
                  console.log(`${indent}    ${kkLabel}:`);
                  if (vv.length === 0) {
                    console.log(`${indent}      (empty)`);
                  } else {
                    for (const sub of vv) {
                      if (sub === null || sub === undefined) {
                        console.log(`${indent}      - ${sub}`);
                      } else if (typeof sub === "object") {
                        const subSummary =
                          sub.name ||
                          sub.title ||
                          sub.id ||
                          JSON.stringify(sub).slice(0, 60);
                        console.log(`${indent}      - ${subSummary}`);
                      } else {
                        console.log(`${indent}      - ${String(sub)}`);
                      }
                    }
                  }
                } else if (typeof vv === "object") {
                  console.log(`${indent}    ${kkLabel}:`);
                  prettyPrintObject(vv, indent + "      ");
                } else {
                  console.log(`${indent}    ${kkLabel}: ${String(vv)}`);
                }
              }
            } else {
              console.log(`${indent}  - ${String(item)}`);
            }
          }
        }
      } else if (typeof v === "object") {
        console.log(`${indent}${label}:`);
        prettyPrintObject(v, indent + "  ");
      } else {
        console.log(`${indent}${label}: ${String(v)}`);
      }
    }
  };

  // find arrays anywhere under res.data
  const findArrays = (obj, path = []) => {
    if (Array.isArray(obj)) return [{ path, arr: obj }];
    if (obj && typeof obj === "object") {
      return Object.keys(obj).flatMap((k) =>
        findArrays(obj[k], path.concat(k))
      );
    }
    return [];
  };

  if (res && res.data) {
    const arrays = findArrays(res.data);
    if (arrays.length === 1) {
      const arr = arrays[0].arr;
      const path = arrays[0].path || [];
      // detect if array items are single-key objects with same key
      const singleKey = (() => {
        if (!arr.length) return null;
        let k = null;
        for (const it of arr) {
          if (!it || typeof it !== "object") return null;
          const keys = Object.keys(it);
          if (keys.length !== 1) return null;
          if (k === null) k = keys[0];
          else if (k !== keys[0]) return null;
        }
        return k;
      })();

      const determineGroupLabel = (pathArr, key) => {
        const p = (pathArr || []).join(".").toLowerCase();
        if (/char|people|person/.test(p)) return "Characters:";
        if (/film/.test(p)) return "Films:";
        if (/planet/.test(p)) return "Planets:";
        if (/species/.test(p)) return "Species:";
        if (key === "name") return "Names:";
        return key ? key[0].toUpperCase() + key.slice(1) + ":" : "Items:";
      };

      if (singleKey) {
        console.log(determineGroupLabel(path, singleKey));
        for (const item of arr) {
          const val = item && item[singleKey];
          if (val === null || val === undefined) continue;
          console.log(`  - ${String(val)}`);
        }
        console.log("");
        return;
      }
      for (const item of arr) {
        if (item === null || item === undefined) continue;
        if (typeof item === "object") {
          prettyPrintObject(item, "");
        } else {
          console.log(String(item));
        }
        console.log("");
      }
      return;
    }
    if (arrays.length > 1) {
      for (const { path, arr } of arrays) {
        console.log(`# ${path.join(".")}`);
        for (const item of arr) {
          if (item === null || item === undefined) continue;
          if (typeof item === "object") {
            prettyPrintObject(item, "");
          } else {
            console.log(String(item));
          }
          console.log("");
        }
        console.log("");
      }
      return;
    }
  }
  // If there's top-level data but no arrays were printed earlier, try promoting
  // single-key top-level objects for friendlier output instead of dumping JSON.
  if (res && res.data) {
    const topKeys = Object.keys(res.data || {});
    if (topKeys.length === 1) {
      const k = topKeys[0];
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
  }

  console.log(JSON.stringify(res, null, 2));
}

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

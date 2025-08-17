#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

// simple CLI flag parsing for this runner: support --raw to emit full JSON
const RUNNER_ARGS = process.argv.slice(2);
const RUNNER_FLAG_RAW = RUNNER_ARGS.includes("--raw");

// optional config file to supply variables per-query (relative path -> variables object)
const { loadConfig, getQueryVariables } = require("../lib/config");
const VAR_CONFIG = loadConfig();
const MAPPING = VAR_CONFIG.mapping || {};
let ORDERED_LIST = [];
if (Array.isArray(VAR_CONFIG.order)) {
  ORDERED_LIST = VAR_CONFIG.order.map((p) => path.resolve(process.cwd(), p));
}

async function findGraphqlFiles(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...(await findGraphqlFiles(full)));
    } else if (e.isFile() && full.endsWith(".graphql")) {
      files.push(full);
    }
  }
  return files;
}

function sanitizeQuery(raw) {
  if (!raw) return "";
  let q = raw.trim();
  // strip fenced ```...``` blocks
  if (q.startsWith("```")) {
    const lines = q.split(/\r?\n/);
    if (lines[0].match(/^```/)) lines.shift();
    if (lines.length && lines[lines.length - 1].match(/```$/)) lines.pop();
    q = lines.join("\n").trim();
  }
  // drop leading > blockquote markers
  q = q
    .split(/\r?\n/)
    .map((l) => l.replace(/^>\s?/, ""))
    .join("\n");
  return q.trim();
}

function requiresRequiredVariables(query) {
  return /\$\w+\s*:\s*[^)\n]+!/.test(query);
}

function prettyPrintResponse(res) {
  if (!res) return;

  if (RUNNER_FLAG_RAW) {
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

  // fallback: print full pretty JSON
  console.log(JSON.stringify(res, null, 2));
}

(async function main() {
  try {
    const root = path.resolve(__dirname, "..", "queries");
    if (!fs.existsSync(root)) {
      console.error("queries/ directory not found");
      process.exit(1);
    }

    const discovered = await findGraphqlFiles(root);
    // normalize discovery to absolute paths
    const discoveredSet = new Set(discovered.map((p) => path.resolve(p)));

    // if ORDERED_LIST provided, start with those entries (only if they exist)
    let files = [];
    if (ORDERED_LIST.length) {
      for (const entry of ORDERED_LIST) {
        if (discoveredSet.has(entry)) {
          files.push(entry);
          discoveredSet.delete(entry);
        } else if (fs.existsSync(entry)) {
          // allow running files outside queries/ if user provided full path
          files.push(entry);
        }
      }
      // append any remaining discovered files in sorted order for determinism
      const remaining = Array.from(discoveredSet).sort();
      files.push(...remaining);
    } else {
      files = discovered;
    }

    if (!files || files.length === 0) {
      console.error("No .graphql files found under queries/");
      process.exit(1);
    }

    for (const f of files) {
      const rel = path.relative(process.cwd(), f);
      process.stderr.write("\n=== " + rel + " ===\n");
      const raw = fs.readFileSync(f, "utf8");
      const query = sanitizeQuery(raw);
      if (!query) {
        process.stderr.write(" (empty query)\n");
        continue;
      }
      // supply variables from config if present
      const vars = getQueryVariables(VAR_CONFIG, f);

      if (
        requiresRequiredVariables(query) &&
        (!vars || Object.keys(vars).length === 0)
      ) {
        process.stderr.write(
          " (skipped: requires variables — add them to run-all-queries.config.json)\n"
        );
        continue;
      }

      try {
        // Prefer script output when mapping provided in config
        const relKeyNormalized = rel.replace(/\\/g, "/");
        if (MAPPING[relKeyNormalized]) {
          const scriptRel = MAPPING[relKeyNormalized];
          const scriptPath = path.resolve(process.cwd(), scriptRel);
          if (fs.existsSync(scriptPath)) {
            const { spawnSync } = require("child_process");
            const out = spawnSync(process.execPath, [scriptPath], {
              encoding: "utf8",
            });
            if (out.error) {
              console.log("(error running script)");
              console.log(out.error.message || out.error);
            } else {
              process.stdout.write(out.stdout || "");
              process.stderr.write(out.stderr || "");
            }
            continue;
          } else {
            console.error(`Mapped script not found: ${scriptPath}`);
          }
        }

        const res = await executeQuery(ENDPOINT, {
          query,
          variables: vars || {},
        });

        // Use dedicated formatters for custom output
        const {
          formatCharacterProfile,
          formatFilmCharacters,
          formatAggregateStats,
        } = require("../lib/formatters");
        if (
          relKeyNormalized.endsWith(
            "queries/complex/full-character-profile.graphql"
          ) &&
          res &&
          res.data &&
          res.data.person
        ) {
          formatCharacterProfile(res.data.person);
        } else if (
          relKeyNormalized.endsWith(
            "queries/advanced/characters-in-film.graphql"
          ) &&
          res &&
          res.data &&
          res.data.film
        ) {
          formatFilmCharacters(res.data.film);
        } else if (
          relKeyNormalized.endsWith(
            "queries/advanced/aggregate-film-stats.graphql"
          ) &&
          res &&
          res.data &&
          res.data.allFilms &&
          Array.isArray(res.data.allFilms.films)
        ) {
          formatAggregateStats(res.data.allFilms.films);
        } else {
          prettyPrintResponse(res);
        }
      } catch (err) {
        process.stderr.write(" (error executing query)\n");
        process.stderr.write(
          err && err.message ? err.message + "\n" : String(err) + "\n"
        );
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();

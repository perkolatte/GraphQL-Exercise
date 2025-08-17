#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

// optional config file to supply variables per-query (relative path -> variables object)
const CONFIG_PATH = path.resolve(process.cwd(), "run-all-queries.config.json");
let VAR_CONFIG = {};
if (fs.existsSync(CONFIG_PATH)) {
  try {
    VAR_CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) || {};
  } catch (err) {
    console.error(
      "Invalid JSON in run-all-queries.config.json:",
      err.message || err
    );
    process.exit(1);
  }
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

(async function main() {
  try {
    const root = path.resolve(__dirname, "..", "queries");
    if (!fs.existsSync(root)) {
      console.error("queries/ directory not found");
      process.exit(1);
    }

    const files = await findGraphqlFiles(root);
    if (!files.length) {
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
      const relKey = rel;
      const vars =
        VAR_CONFIG[relKey] ||
        VAR_CONFIG["./" + relKey] ||
        VAR_CONFIG[path.relative(process.cwd(), f)] ||
        {};

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
        const res = await executeQuery(ENDPOINT, {
          query,
          variables: vars || {},
        });

        // Special formatting for vehicles->pilots query: show friendly message when no pilots
        if (
          /vehicles-pilots-species\.graphql$/.test(f) ||
          /pilotConnection/.test(query)
        ) {
          try {
            const vehicles =
              res &&
              res.data &&
              res.data.allVehicles &&
              res.data.allVehicles.vehicles;
            if (Array.isArray(vehicles)) {
              for (const v of vehicles) {
                const name = v && v.name;
                const pilots =
                  v &&
                  v.pilotConnection &&
                  (v.pilotConnection.pilots || v.pilotConnection.edges);
                if (!pilots || (Array.isArray(pilots) && pilots.length === 0)) {
                  console.log(`${name}: No pilots on record`);
                } else {
                  // pilots may be nodes or direct objects
                  const list = pilots
                    .map((p) => p && (p.node ? p.node : p))
                    .filter(Boolean);
                  for (const p of list) {
                    const pname = p.name || "(no-name)";
                    const sname =
                      p.species && p.species.name ? ` (${p.species.name})` : "";
                    console.log(`${name}: ${pname}${sname}`);
                  }
                }
              }
              continue; // already printed friendly output
            }
          } catch (fmtErr) {
            // fall back to printing full JSON
          }
        }

        console.log(JSON.stringify(res, null, 2));
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

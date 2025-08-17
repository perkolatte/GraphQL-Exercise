const path = require("path");
const fs = require("fs");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

(async function main() {
  try {
    // Load config for query IDs
    const configPath = path.resolve(
      process.cwd(),
      "run-all-queries.config.json"
    );
    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      } catch (err) {
        console.error(
          "Invalid JSON in run-all-queries.config.json:",
          err.message || err
        );
        process.exit(1);
      }
    }
    const queryRelPath = "queries/advanced/aggregate-film-stats.graphql";
    const qpath = path.resolve(__dirname, "..", queryRelPath);
    if (!fs.existsSync(qpath)) {
      console.error("Query file missing:", qpath);
      process.exit(1);
    }
    const query = fs.readFileSync(qpath, "utf8").trim();
    if (!query) {
      console.error("Empty query");
      process.exit(1);
    }

    // Get ID from config, fallback to null
    const queryId = (config[queryRelPath] && config[queryRelPath].id) || null;
    const variables = queryId ? { id: queryId } : {};
    const res = await executeQuery(ENDPOINT, { query, variables });
    // normalize a list of film objects regardless of edges/node wrapper
    let films = [];
    const allFilms = res && res.data && res.data.allFilms;
    if (Array.isArray(allFilms)) {
      films = allFilms;
    } else if (allFilms && Array.isArray(allFilms.edges)) {
      // map edges -> node if present
      films = allFilms.edges.map((it) => (it && it.node) || it).filter(Boolean);
    } else if (allFilms && typeof allFilms === "object") {
      // maybe already a single film-like object
      films = [allFilms];
    }

    // helper: scan an object for arrays of character-like objects (have id or name)
    const collectCharsFromFilm = (film) => {
      const found = [];
      if (!film || typeof film !== "object") return found;
      const seen = new Set();
      const stack = [film];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        for (const k of Object.keys(cur)) {
          const v = cur[k];
          if (Array.isArray(v)) {
            for (const item of v) {
              if (item && typeof item === "object") {
                // consider an item a character if it has id or name
                if (item.id || item.name) {
                  // prefer id for uniqueness, fallback to name
                  const key = item.id || `name:${item.name}`;
                  if (!seen.has(key)) {
                    seen.add(key);
                    found.push({ id: item.id, name: item.name });
                  }
                } else {
                  stack.push(item);
                }
              }
            }
          } else if (v && typeof v === "object") {
            stack.push(v);
          }
        }
      }
      return found;
    };

    // build a set of known people (if the API returned allPeople) so we only count actual people
    const personIds = new Set();
    const personNames = new Set();
    const allPeople = res && res.data && res.data.allPeople;
    if (allPeople && Array.isArray(allPeople.edges)) {
      for (const pe of allPeople.edges) {
        const p = pe && pe.node;
        if (p && p.id) personIds.add(p.id);
        if (p && p.name) personNames.add(p.name);
      }
    } else if (Array.isArray(allPeople)) {
      for (const p of allPeople) {
        if (p && p.id) personIds.add(p.id);
        if (p && p.name) personNames.add(p.name);
      }
    }

    // collect unique characters into a map keyed by id or name
    const uniqueMap = new Map();
    for (const film of films) {
      const chars = collectCharsFromFilm(film);
      for (const c of chars) {
        const cid = c && c.id;
        const cname = c && c.name;
        if (cid) {
          if (personIds.size) {
            if (!personIds.has(cid)) continue;
          } else {
            if (!/^cGVvcGxl/.test(cid)) continue;
          }
          if (!uniqueMap.has(cid))
            uniqueMap.set(cid, { id: cid, name: cname || null });
        } else if (cname) {
          if (personNames.size) {
            if (!personNames.has(cname)) continue;
          }
          const key = `name:${cname}`;
          if (!uniqueMap.has(key))
            uniqueMap.set(key, { id: null, name: cname });
        }
      }
    }

    console.log(`Unique characters across all films: ${uniqueMap.size}`);
    // print deduplicated list sorted by name
    const list = Array.from(uniqueMap.values()).sort((a, b) => {
      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      return na.localeCompare(nb);
    });
    for (const item of list) {
      if (item.id) console.log(`${item.name || "(no-name)"} - ${item.id}`);
      else console.log(`${item.name}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
})();

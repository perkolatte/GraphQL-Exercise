const path = require("path");
const fs = require("fs");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

async function main() {
  const qpath = path.resolve(
    __dirname,
    "..",
    "queries",
    "advanced",
    "multi-film-characters.graphql"
  );
  if (!fs.existsSync(qpath)) {
    console.error("Query file missing:", qpath);
    process.exit(1);
  }
  // sanitize query files that may contain markdown fences or leading '>' blockquote markers
  function sanitizeQuery(s) {
    if (!s || typeof s !== "string") return "";
    let out = s;
    // remove a leading fenced code block marker like ```graphql\n
    out = out.replace(/^\s*```(?:[a-zA-Z0-9-_]+)?\n/, "");
    // remove a trailing fenced code block (the closing ``` and anything after)
    out = out.replace(/\n```[\s\S]*$/m, "");
    // remove '>' blockquote markers at line starts
    out = out.replace(/^\s*>\s?/gm, "");
    return out.trim();
  }

  const raw = fs.readFileSync(qpath, "utf8");
  const query = sanitizeQuery(raw);
  if (!query) {
    console.error("Query file is empty after stripping fences:", qpath);
    process.exit(1);
  }

  const res = await executeQuery(ENDPOINT, { query });
  const data = res && res.data;

  // prefer people shape: allPeople.edges[].node.filmConnection.totalCount
  if (data && data.allPeople && Array.isArray(data.allPeople.edges)) {
    const people = data.allPeople.edges
      .map((e) => e && e.node)
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name: p.name,
        count: (p.filmConnection && p.filmConnection.totalCount) || 0,
      }));

    const multiPeople = people
      .filter((p) => p.count > 1)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    if (!multiPeople.length) {
      console.log("No characters found with filmConnection.totalCount > 1.");
      return;
    }

    console.log("Characters appearing in more than one film:");
    for (const m of multiPeople) {
      console.log(`- ${m.name} (${m.count})`);
    }
    return;
  }

  // fallback: films -> characters grouping
  const films = (data && data.allFilms && data.allFilms.edges) || [];

  // collect {id, name, film}
  const rows = [];
  for (const e of films) {
    const film = e.node;
    const title = film.title || "(unknown)";
    const chars = film.characters || [];
    for (const c of chars) {
      rows.push({ id: c.id, name: c.name, film: title });
    }
  }

  // group by id
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id))
      byId.set(r.id, { id: r.id, name: r.name, films: new Set() });
    byId.get(r.id).films.add(r.film);
  }

  const multi = Array.from(byId.values())
    .map((x) => ({ id: x.id, name: x.name, films: Array.from(x.films) }))
    .filter((x) => x.films.length > 1)
    .sort(
      (a, b) => b.films.length - a.films.length || a.name.localeCompare(b.name)
    );

  if (!multi.length) {
    console.log("No characters found in more than one film.");
    return;
  }

  console.log("Characters appearing in more than one film:");
  for (const m of multi) {
    console.log(`- ${m.name} (${m.films.length}): ${m.films.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

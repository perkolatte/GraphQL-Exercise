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
  // Helper: extract people nodes from various shapes
  const extractPeopleNodes = (allPeople) => {
    if (!allPeople) return [];
    if (Array.isArray(allPeople.people))
      return allPeople.people.filter(Boolean);
    if (Array.isArray(allPeople.edges))
      return allPeople.edges.map((e) => e && e.node).filter(Boolean);
    if (Array.isArray(allPeople)) return allPeople.filter(Boolean);
    return [];
  };

  // Try people-first approach: look for allPeople and filmConnection.totalCount
  const peopleNodes = extractPeopleNodes(data && data.allPeople);
  if (peopleNodes.length) {
    const people = peopleNodes.map((p) => {
      const count =
        (p && p.filmConnection && p.filmConnection.totalCount) ||
        (p &&
          p.filmConnection &&
          Array.isArray(p.filmConnection.films) &&
          p.filmConnection.films.length) ||
        0;
      return { id: p.id || null, name: p.name || null, count };
    });

    const multiPeople = people
      .filter((p) => p.count > 1)
      .sort(
        (a, b) =>
          b.count - a.count || (a.name || "").localeCompare(b.name || "")
      );
    if (multiPeople.length) {
      console.log("Characters appearing in more than one film:");
      for (const m of multiPeople)
        console.log(`- ${m.name || "(no-name)"} (${m.count})`);
      return;
    }
    // fallthrough to film-based grouping if no multi-film people found
  }

  // Fallback: examine films -> characters. Support multiple shapes for films and characters
  const extractFilms = (allFilms) => {
    if (!allFilms) return [];
    if (Array.isArray(allFilms.films)) return allFilms.films.filter(Boolean);
    if (Array.isArray(allFilms.edges))
      return allFilms.edges.map((e) => e && e.node).filter(Boolean);
    if (Array.isArray(allFilms)) return allFilms.filter(Boolean);
    return [];
  };

  const films = extractFilms(data && data.allFilms);

  // collect rows of appearance { key, id, name, film }
  const rows = [];
  for (const film of films) {
    const title = film && (film.title || film.name || "(unknown)");
    // possible character containers on a film:
    // film.characters (array)
    // film.characterConnection.characters (array)
    // film.characterConnection.edges[].node
    let chars = [];
    if (Array.isArray(film.characters)) chars = film.characters;
    else if (
      film.characterConnection &&
      Array.isArray(film.characterConnection.characters)
    )
      chars = film.characterConnection.characters;
    else if (
      film.characterConnection &&
      Array.isArray(film.characterConnection.edges)
    )
      chars = film.characterConnection.edges
        .map((e) => e && e.node)
        .filter(Boolean);
    else if (Array.isArray(film.people)) chars = film.people;

    for (const c of chars) {
      if (!c) continue;
      const id = c.id || null;
      const name = c.name || null;
      const key = id || `name:${name}`;
      rows.push({ key, id, name, film: title });
    }
  }

  // group by key (id preferred, else name)
  const grouped = new Map();
  for (const r of rows) {
    if (!grouped.has(r.key))
      grouped.set(r.key, { id: r.id, name: r.name, films: new Set() });
    grouped.get(r.key).films.add(r.film);
  }

  const multi = Array.from(grouped.values())
    .map((g) => ({ id: g.id, name: g.name, films: Array.from(g.films) }))
    .filter((g) => g.films.length > 1)
    .sort(
      (a, b) =>
        b.films.length - a.films.length ||
        (a.name || "").localeCompare(b.name || "")
    );

  if (!multi.length) {
    console.log("No characters found in more than one film.");
    return;
  }

  console.log("Characters appearing in more than one film:");
  for (const m of multi) {
    console.log(
      `- ${m.name || "(no-name)"} (${m.films.length}): ${m.films.join(", ")}`
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

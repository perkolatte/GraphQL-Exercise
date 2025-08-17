const path = require("path");
const fs = require("fs");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT =
  process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql";

/**
 * Main entry point for multi-film-characters script.
 * Loads config, reads query, executes, and prints results.
 * @throws {Error} If config or query file is missing/invalid
 */
async function main() {
  // Load config for query IDs
  const { loadConfig } = require("../lib/config");
  const config = loadConfig();
  const queryRelativePath = "queries/advanced/multi-film-characters.graphql";
  const queryFilePath = path.resolve(__dirname, "..", queryRelativePath);
  if (!fs.existsSync(queryFilePath)) {
    throw new Error(`Query file missing: ${queryFilePath}`);
  }
  // sanitize query files that may contain markdown fences or leading '>' blockquote markers
  const { sanitizeQuery } = require("../lib/sanitize-query");

  const raw = fs.readFileSync(queryFilePath, "utf8");
  const query = sanitizeQuery(raw);
  if (!query) {
    throw new Error(
      "Query file is empty after stripping fences: " + queryFilePath
    );
  }

  // Use shared variable resolution utility
  const { getQueryVariables } = require("../lib/config");
  const variables = getQueryVariables(config, queryFilePath);
  const res = await executeQuery(ENDPOINT, { query, variables });
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
      const { printFormatted } = require("../lib/formatters");
      let output = "Characters appearing in more than one film:\n";
      for (const m of multiPeople)
        output += `- ${m.name || "(no-name)"} (${m.count})\n`;
      printFormatted(output);
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
    const { printFormatted } = require("../lib/formatters");
    printFormatted("No characters found in more than one film.\n");
    return;
  }

  const { printFormatted } = require("../lib/formatters");
  let output = "Characters appearing in more than one film:\n";
  for (const m of multi) {
    output += `- ${m.name || "(no-name)"} (${m.films.length}): ${m.films.join(
      ", "
    )}\n`;
  }
  printFormatted(output);
}

main().catch((err) => {
  // ...existing code...

  // CLI wrapper
  const runCli = require("../lib/cli-wrapper");
  runCli(main);
});

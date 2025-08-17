const fs = require("fs");
const path = require("path");
const { readQueryFile } = require("../lib/cli");
const { executeQuery } = require("../lib/graphql-client");

(async () => {
  try {
    const qfile =
      process.argv[2] ||
      path.resolve(
        process.cwd(),
        "queries/advanced/multi-film-characters.graphql"
      );
    const q = await readQueryFile(qfile);

    // Load config and resolve query variables
    const { loadConfig, getQueryVariables } = require("../lib/config");
    const config = loadConfig();
    let vars = getQueryVariables(config, qfile);
    // If running full-character-profile, set default id if not present
    if (qfile.endsWith("queries/complex/full-character-profile.graphql")) {
      if (!vars.id) {
        vars = { ...vars, id: "cGVvcGxlOjE=" };
      }
    }

    const res = await executeQuery(
      process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql",
      { query: q, variables: vars }
    );

    // Use dedicated formatters for custom output
    const {
      formatCharacterProfile,
      formatFilmCharacters,
      formatAggregateStats,
    } = require("../lib/formatters");
    if (
      relPath.endsWith("queries/complex/full-character-profile.graphql") &&
      res &&
      res.data &&
      res.data.person
    ) {
      formatCharacterProfile(res.data.person);
    } else if (
      relPath.endsWith("queries/advanced/characters-in-film.graphql") &&
      res &&
      res.data &&
      res.data.film
    ) {
      formatFilmCharacters(res.data.film);
    } else if (
      relPath.endsWith("queries/advanced/aggregate-film-stats.graphql") &&
      res &&
      res.data &&
      res.data.allFilms &&
      Array.isArray(res.data.allFilms.films)
    ) {
      formatAggregateStats(res.data.allFilms.films);
    } else {
      const { prettyPrintResponse } = require("../lib/pretty-print");
      prettyPrintResponse(res);
    }
  } catch (e) {
    process.stderr.write("ERR " + (e.message || e) + "\n");
    process.exit(1);
  }
})();

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

    // Load config for query variables
    const configPath = path.resolve(
      process.cwd(),
      "run-all-queries.config.json"
    );
    let config = {};
    if (require("fs").existsSync(configPath)) {
      try {
        config = JSON.parse(require("fs").readFileSync(configPath, "utf8"));
      } catch (err) {
        process.stderr.write(
          "Invalid JSON in run-all-queries.config.json: " +
            (err.message || err) +
            "\n"
        );
        process.exit(1);
      }
    }
    // Get relative path for config lookup
    const relPath = path.relative(process.cwd(), qfile).replace(/\\/g, "/");
    let vars =
      config[relPath] && typeof config[relPath] === "object"
        ? config[relPath]
        : {};

    // If running full-character-profile, set default id if not present
    if (relPath.endsWith("queries/complex/full-character-profile.graphql")) {
      if (!vars.id) {
        vars = { ...vars, id: "cGVvcGxlOjE=" };
      }
    }

    const res = await executeQuery(
      process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql",
      { query: q, variables: vars }
    );

    // Use prettyPrintResponse for pretty output and grouping
    // Custom pretty output for full-character-profile
    if (
      relPath.endsWith("queries/complex/full-character-profile.graphql") &&
      res &&
      res.data &&
      res.data.person
    ) {
      const person = res.data.person;
      // Character name as heading
      if (person.name) {
        console.log(`Character: ${person.name}\n`);
      }
      // Group film titles
      if (person.filmConnection && Array.isArray(person.filmConnection.films)) {
        console.log("Films:");
        for (const film of person.filmConnection.films) {
          if (film && film.title) {
            console.log(`  - ${film.title}`);
          }
        }
        console.log("");
      }
      // Group starship names
      if (
        person.starshipConnection &&
        Array.isArray(person.starshipConnection.starships)
      ) {
        console.log("Starships:");
        for (const ship of person.starshipConnection.starships) {
          if (ship && ship.name) {
            console.log(`  - ${ship.name}`);
          }
        }
        console.log("");
      }
      // Show homeworld
      if (person.homeworld && person.homeworld.name) {
        console.log(`Homeworld: ${person.homeworld.name}\n`);
      }
    } else {
      const { prettyPrintResponse } = require("../lib/pretty-print");
      prettyPrintResponse(res);
    }
  } catch (e) {
    process.stderr.write("ERR " + (e.message || e) + "\n");
    process.exit(1);
  }
})();

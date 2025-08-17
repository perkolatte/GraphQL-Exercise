const fs = require("fs");
const path = require("path");
const { executeQuery } = require("../lib/graphql-client");

// Increase timeout for network calls
jest.setTimeout(30000);

const DEFAULT_ENDPOINT =
  process.env.API_ENDPOINT || "https://swapi-graphql.netlify.app/graphql";

const tasks = [
  {
    name: "Basic - List All Films",
    file: "queries/basic/list-all-films.graphql",
  },
  {
    name: "Basic - Fetch Specific Character",
    file: "queries/basic/fetch-specific-character.graphql",
  },
  {
    name: "Basic - Explore Planets (first 5)",
    file: "queries/basic/list-first-5-planets.graphql",
  },
  {
    name: "Basic - Starships info (3)",
    file: "queries/basic/list-3-starships.graphql",
  },

  {
    name: "Intermediate - Characters and their Starships (first 5)",
    file: "queries/intermediate/characters-starships.graphql",
  },
  {
    name: "Intermediate - Species and Languages (5)",
    file: "queries/intermediate/species-languages.graphql",
  },
  {
    name: "Intermediate - Planets and Climates (5)",
    file: "queries/intermediate/planets-climates.graphql",
  },
  {
    name: "Intermediate - Vehicles and Costs (3)",
    file: "queries/intermediate/vehicles-costs.graphql",
  },

  {
    name: "Advanced - Characters in a Film by ID",
    file: "queries/advanced/characters-in-film.graphql",
  },
  {
    name: "Advanced - Multi-Film Characters",
    file: "queries/advanced/multi-film-characters.graphql",
  },
  {
    name: "Advanced - Aggregate Film Statistics",
    file: "queries/advanced/aggregate-film-stats.graphql",
  },

  {
    name: "Complex - Full Character Profile",
    file: "queries/complex/full-character-profile.graphql",
  },
  {
    name: "Complex - Characters with Homeworlds (first 5)",
    file: "queries/complex/characters-with-planets.graphql",
  },
  {
    name: "Complex - Vehicles, Pilots and Pilots Species (3)",
    file: "queries/complex/vehicles-pilots-species.graphql",
  },
  {
    name: "Complex - Films and Related Entities (first 3)",
    file: "queries/complex/films-related-entities.graphql",
  },
];

describe("GraphQL task query files", () => {
  tasks.forEach((t) => {
    const abs = path.resolve(t.file);
    const exists = fs.existsSync(abs);
    if (!exists) {
      test.skip(`${t.name} - ${t.file} (missing)`, () => {});
      return;
    }

    const stat = fs.statSync(abs);
    if (stat.size === 0) {
      test.skip(`${t.name} - ${t.file} (empty)`, () => {});
      return;
    }

    // Load the query file synchronously so we can decide before creating the test
    const raw = fs.readFileSync(abs, "utf8");
    // strip fenced code blocks if present
    let query = raw;
    if (query.startsWith("```")) {
      const lines = query.split(/\r?\n/);
      if (lines[0].match(/^```/)) lines.shift();
      if (lines.length && lines[lines.length - 1].match(/```$/)) lines.pop();
      query = lines.join("\n").trim();
    }

      // Parse variable definitions and generate sensible defaults so tests can run
      const parseVariableDefs = (doc) => {
        const m = doc.match(/(?:query|mutation)\s+[^(]*\(([^)]*)\)/i);
        if (!m) return [];
        const inner = m[1].trim();
        if (!inner) return [];
        // split by commas that are not inside brackets
        const parts = inner.split(/,(?![^\[\]]*\])/).map((p) => p.trim()).filter(Boolean);
        return parts.map((p) => {
          // $name: Type = default
          const mm = p.match(/\$(\w+)\s*:\s*([^=\s]+)/);
          if (!mm) return null;
          const name = mm[1];
          const type = mm[2];
          const required = /!$/.test(type);
          return { name, type, required };
        }).filter(Boolean);
      };

      const varDefs = parseVariableDefs(query);

      const makeDefaultForType = (typeStr) => {
        const t = typeStr.replace(/[!\[\]\s]/g, "");
        if (/ID/i.test(t)) return "cGVvcGxlOjE="; // person:1 (safe default)
        if (/Int/i.test(t)) return 1;
        if (/Float/i.test(t)) return 1.0;
        if (/Boolean/i.test(t)) return false;
        if (/String/i.test(t)) return "";
        // fallback
        return null;
      };

      const variables = {};
      varDefs.forEach((d) => {
        const def = makeDefaultForType(d.type);
        if (def !== null) variables[d.name] = def;
      });

    test(`${t.name} - ${t.file} runs without GraphQL/HTTP errors`, async () => {
      expect(query).toEqual(expect.any(String));
      expect(query.trim().length).toBeGreaterThan(0);
      expect(/\b(query|mutation)\b/i.test(query)).toBe(true);

      // Execute against live endpoint; tests will fail if executeQuery throws
        await expect(
          executeQuery(DEFAULT_ENDPOINT, { query, variables })
        ).resolves.toBeDefined();
    });
  });
});

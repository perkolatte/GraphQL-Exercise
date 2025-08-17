const fs = require("fs");
const path = require("path");
const { executeQuery } = require("../lib/graphql-client");

// Increase timeout for network calls
jest.setTimeout(30000);

const DEFAULT_ENDPOINT =
  process.env.API_ENDPOINT || "https://swapi-graphql.netlify.app/graphql";

// optional config file to supply variables for tests
const TEST_CONFIG_PATH = path.resolve(
  process.cwd(),
  "run-all-queries.config.json"
);
let TEST_VAR_CONFIG = {};
if (fs.existsSync(TEST_CONFIG_PATH)) {
  try {
    TEST_VAR_CONFIG =
      JSON.parse(fs.readFileSync(TEST_CONFIG_PATH, "utf8")) || {};
  } catch (err) {
    // fallback to empty config
    TEST_VAR_CONFIG = {};
  }
}

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

// If run-all-queries.config.json supplies an ordered `order` array, use it to rearrange tasks
const ORDER_CONFIG_PATH = path.resolve(
  process.cwd(),
  "run-all-queries.config.json"
);
if (fs.existsSync(ORDER_CONFIG_PATH)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(ORDER_CONFIG_PATH, "utf8")) || {};
    if (Array.isArray(cfg.order) && cfg.order.length) {
      const orderMap = new Map(cfg.order.map((p, i) => [path.resolve(p), i]));
      tasks.sort((a, b) => {
        const aPath = path.resolve(a.file);
        const bPath = path.resolve(b.file);
        const ai = orderMap.has(aPath)
          ? orderMap.get(aPath)
          : Number.MAX_SAFE_INTEGER;
        const bi = orderMap.has(bPath)
          ? orderMap.get(bPath)
          : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return a.file.localeCompare(b.file);
      });
    }
  } catch (err) {
    // ignore parse errors and keep default ordering
  }
}

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

    // If the document requires variables (e.g. query Get($id: ID!)), try to supply them from test config
    const requiresRequiredVariables = /\$\w+\s*:\s*[^)\n]+!/.test(query);
    const providedVars =
      TEST_VAR_CONFIG[t.file] || TEST_VAR_CONFIG["./" + t.file] || {};
    if (
      requiresRequiredVariables &&
      (!providedVars || Object.keys(providedVars).length === 0)
    ) {
      test.skip(`${t.name} - ${t.file} (skipped: requires variables)`, () => {});
      return;
    }

    test(`${t.name} - ${t.file} runs without GraphQL/HTTP errors`, async () => {
      expect(query).toEqual(expect.any(String));
      expect(query.trim().length).toBeGreaterThan(0);
      expect(/\b(query|mutation)\b/i.test(query)).toBe(true);

      // Execute against live endpoint; tests will fail if executeQuery throws
      await expect(
        executeQuery(DEFAULT_ENDPOINT, { query, variables: providedVars || {} })
      ).resolves.toBeDefined();
    });
  });
});

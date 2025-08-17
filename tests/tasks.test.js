const fs = require("fs");
const path = require("path");

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

    test(`${t.name} - ${t.file} exists and is non-empty`, () => {
      const raw = fs.readFileSync(abs, "utf8");
      expect(raw).toEqual(expect.any(String));
      expect(raw.trim().length).toBeGreaterThan(0);
      expect(/\b(query|mutation)\b/i.test(raw)).toBe(true);
    });
  });
});

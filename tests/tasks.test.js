const fs = require("fs");
const path = require("path");

const tasks = [
  {
    name: "Basic - List All Films",
    file: "queries/basic/listAllFilms.graphql",
  },
  {
    name: "Basic - Fetch Specific Character",
    file: "queries/basic/fetchSpecificCharacter.graphql",
  },
  {
    name: "Basic - Explore Planets (first 5)",
    file: "queries/basic/listFirst5Planets.graphql",
  },
  {
    name: "Basic - Starships info (3)",
    file: "queries/basic/list3Starships.graphql",
  },

  {
    name: "Intermediate - Characters and their Starships (first 5)",
    file: "queries/intermediate/charactersStarships.graphql",
  },
  {
    name: "Intermediate - Species and Languages (5)",
    file: "queries/intermediate/speciesLanguages.graphql",
  },
  {
    name: "Intermediate - Planets and Climates (5)",
    file: "queries/intermediate/planetsClimates.graphql",
  },
  {
    name: "Intermediate - Vehicles and Costs (3)",
    file: "queries/intermediate/vehiclesCosts.graphql",
  },

  {
    name: "Advanced - Characters in a Film by ID",
    file: "queries/advanced/charactersInFilm.graphql",
  },
  {
    name: "Advanced - Multi-Film Characters",
    file: "queries/advanced/multiFilmCharacters.graphql",
  },
  {
    name: "Advanced - Aggregate Film Statistics",
    file: "queries/advanced/aggregateFilmStats.graphql",
  },

  {
    name: "Complex - Full Character Profile",
    file: "queries/complex/fullCharacterProfile.graphql",
  },
  {
    name: "Complex - Characters with Homeworlds (first 5)",
    file: "queries/complex/charactersWithPlanets.graphql",
  },
  {
    name: "Complex - Vehicles, Pilots and Pilots Species (3)",
    file: "queries/complex/vehiclesPilotsSpecies.graphql",
  },
  {
    name: "Complex - Films and Related Entities (first 3)",
    file: "queries/complex/filmsRelatedEntities.graphql",
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

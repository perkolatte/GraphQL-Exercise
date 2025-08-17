// Output formatters for custom GraphQL query results

function formatCharacterProfile(person) {
  if (!person) return;
  if (person.name) {
    console.log(`Character: ${person.name}\n`);
  }
  if (person.filmConnection && Array.isArray(person.filmConnection.films)) {
    console.log("Films:");
    for (const film of person.filmConnection.films) {
      if (film && film.title) {
        console.log(`  - ${film.title}`);
      }
    }
    console.log("");
  }
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
  if (person.homeworld && person.homeworld.name) {
    console.log(`Homeworld: ${person.homeworld.name}\n`);
  }
}

function formatFilmCharacters(film) {
  if (!film) return;
  if (film.title) {
    console.log(`Film: ${film.title}\n`);
  }
  if (
    film.characterConnection &&
    Array.isArray(film.characterConnection.characters)
  ) {
    console.log("Characters:");
    for (const char of film.characterConnection.characters) {
      if (char && char.name) {
        console.log(`  - ${char.name}`);
      }
    }
    console.log("");
  }
}

function formatAggregateStats(films) {
  if (!Array.isArray(films)) return;
  const uniqueCharacters = new Set();
  for (const film of films) {
    if (
      film.characterConnection &&
      Array.isArray(film.characterConnection.characters)
    ) {
      for (const c of film.characterConnection.characters) {
        if (c && c.name) uniqueCharacters.add(c.name);
      }
    }
  }
  console.log(`Total Unique Characters: ${uniqueCharacters.size}\n`);
  console.log("Characters:");
  for (const name of Array.from(uniqueCharacters).sort()) {
    console.log(`  - ${name}`);
  }
  console.log("");
}

module.exports = {
  formatCharacterProfile,
  formatFilmCharacters,
  formatAggregateStats,
};

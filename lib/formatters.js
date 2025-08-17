// Output formatters for custom GraphQL query results
//
// Design by Contract: Each function documents its expected input and output, and asserts preconditions.

/**
 * Formats a character profile result as a string.
 * @param {object} person - Character object with name, filmConnection, starshipConnection, homeworld
 * @returns {string}
 */
function formatCharacterProfile(person) {
  if (typeof person !== "object" || person === null) {
    throw new Error("formatCharacterProfile: person must be an object");
  }
  let output = "";
  if (person.name) {
    output += `Character: ${person.name}\n`;
  }
  if (person.filmConnection && Array.isArray(person.filmConnection.films)) {
    output += "Films:\n";
    for (const film of person.filmConnection.films) {
      if (film && film.title) {
        output += `  - ${film.title}\n`;
      }
    }
    output += "\n";
  }
  if (
    person.starshipConnection &&
    Array.isArray(person.starshipConnection.starships)
  ) {
    output += "Starships:\n";
    for (const ship of person.starshipConnection.starships) {
      if (ship && ship.name) {
        output += `  - ${ship.name}\n`;
      }
    }
    output += "\n";
  }
  if (person.homeworld && person.homeworld.name) {
    output += `Homeworld: ${person.homeworld.name}\n`;
  }
  return output;
}

/**
 * Formats a film and its characters as a string.
 * @param {object} film - Film object with title and characterConnection
 * @returns {string}
 */
function formatFilmCharacters(film) {
  if (typeof film !== "object" || film === null) {
    throw new Error("formatFilmCharacters: film must be an object");
  }
  let output = "";
  if (film.title) {
    output += `Film: ${film.title}\n`;
  }
  if (
    film.characterConnection &&
    Array.isArray(film.characterConnection.characters)
  ) {
    output += "Characters:\n";
    for (const char of film.characterConnection.characters) {
      if (char && char.name) {
        output += `  - ${char.name}\n`;
      }
    }
    output += "\n";
  }
  return output;
}

/**
 * Formats aggregate stats for a list of films as a string.
 * @param {Array<object>} films - Array of film objects
 * @returns {string}
 */
function formatAggregateStats(films) {
  if (!Array.isArray(films)) {
    throw new Error("formatAggregateStats: films must be an array");
  }
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
  let output = `Total Unique Characters: ${uniqueCharacters.size}\n`;
  output += "Characters:\n";
  for (const name of Array.from(uniqueCharacters).sort()) {
    output += `  - ${name}\n`;
  }
  output += "\n";
  return output;
}

/**
 * Utility to print formatted output (for CLI use)
 */
function printFormatted(str) {
  if (typeof str === "string") {
    process.stdout.write(str);
  }
}

module.exports = {
  formatCharacterProfile,
  formatFilmCharacters,
  formatAggregateStats,
  printFormatted,
};

GraphQL Exercise

Small CLI and test harness for exercising the SWAPI GraphQL endpoint and storing query files.

Prerequisites

- Node.js (14+ recommended)
- npm

Quick install

1. Install dependencies:

   npm install

Running queries

- Run a .graphql file with:

  npm run query -- <path/to/query.graphql> [variables-json|@vars.json] [operationName] [endpoint]

- Examples:

  npm run query -- queries/basic/list-all-films.graphql
  npm run query -- queries/basic/fetch-specific-character.graphql '{"id":"cGVvcGxlOjE="}'
  API_ENDPOINT=https://example.com/graphql npm run query -- - @vars.json

Notes

- Use `-` as the query path to read a GraphQL document from stdin.
- Variables may be passed inline as JSON or using `@file.json` to load a JSON file.
- If a `.graphql` file contains fenced code blocks (```), the CLI strips them before sending.
- Default endpoint: https://swapi-graphql.netlify.app/graphql (override with `API_ENDPOINT` or the fourth CLI arg)

File layout

- `index.js` — CLI entrypoint.
- `lib/cli.js` — helpers for reading query files and parsing variables.
- `lib/graphql-client.js` — GraphQL transport (`executeQuery`) and error printing helpers.
- `lib/asserts.js` — small assertion helpers used across the lib.
- `queries/` — GraphQL documents grouped by difficulty.
- `tests/tasks.test.js` — Jest suite that checks the presence and non-empty status of task `.graphql` files. The test intentionally skips any missing/empty files so the suite can be used during development.

Naming conventions

- Query filenames use kebab-case (e.g. `list-all-films.graphql`) to keep names cross-platform and shell-friendly. Operation names inside files should still follow GraphQL conventions (PascalCase or camelCase as appropriate).

Testing

- Run the test suite with:

  npm test

- The `tests/tasks.test.js` test will skip files that are missing or empty; add or fill query files to make tests exercise more cases.

Contributing / next steps

- Populate the placeholder query files in `queries/` to make the task tests exercise real GraphQL operations.
- Consider adding CI (GitHub Actions) to run `npm test` on PRs.

License

ISC

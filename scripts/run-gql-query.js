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
    const res = await executeQuery(
      process.env.API_ENDPOINT || "https://star-wars-sb.netlify.app/graphql",
      { query: q }
    );
    // write raw JSON to stdout
    process.stdout.write(JSON.stringify(res));
  } catch (e) {
    process.stderr.write("ERR " + (e.message || e) + "\n");
    process.exit(1);
  }
})();

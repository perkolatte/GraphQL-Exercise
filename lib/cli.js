const fs = require("fs").promises;
const path = require("path");
const { assertString } = require("./asserts");

const readStdin = async () => {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
};

const readQueryFile = async (queryArg) => {
  assertString(queryArg, "queryArg");
  if (queryArg === "-") return (await readStdin()).trim();
  const resolved = path.resolve(queryArg);
  const raw = await fs.readFile(resolved, "utf8");
  return raw.trim();
};

const parseVariablesArg = async (arg) => {
  if (!arg) return {};
  if (arg.startsWith("@")) {
    const file = arg.slice(1);
    const raw = await fs.readFile(path.resolve(file), "utf8");
    return JSON.parse(raw);
  }
  return JSON.parse(arg);
};

module.exports = { readStdin, readQueryFile, parseVariablesArg };

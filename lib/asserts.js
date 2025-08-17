function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertString(s, name) {
  assert(
    typeof s === "string" && s.trim().length > 0,
    `${name} must be a non-empty string`
  );
}

module.exports = { assert, assertString };

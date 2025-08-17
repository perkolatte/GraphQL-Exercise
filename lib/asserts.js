/**
 * Throws if condition is false.
 * @param {boolean} condition - Condition to assert
 * @param {string} message - Error message
 * @throws {Error} If condition is false
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Asserts that s is a non-empty string.
 * @param {string} s - String to check
 * @param {string} name - Variable name for error message
 * @throws {Error} If s is not a non-empty string
 */
function assertString(s, name) {
  assert(
    typeof s === "string" && s.trim().length > 0,
    `${name} must be a non-empty string`
  );
}

module.exports = { assert, assertString };

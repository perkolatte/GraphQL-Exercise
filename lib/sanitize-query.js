// Shared utility to sanitize GraphQL query text
// Removes code fences, blockquote markers, and trims whitespace

/**
 * Sanitizes a GraphQL query string by removing code fences and blockquote markers.
 * @param {string} queryText - Raw query string
 * @returns {string} Sanitized query string
 */
function sanitizeQuery(queryText) {
  if (!queryText || typeof queryText !== "string") return "";
  let sanitized = queryText.trim();
  // Remove leading fenced code block marker like ```graphql\n
  if (sanitized.startsWith("```")) {
    const lines = sanitized.split(/\r?\n/);
    if (lines[0].match(/^```/)) lines.shift();
    if (lines.length && lines[lines.length - 1].match(/```$/)) lines.pop();
    sanitized = lines.join("\n").trim();
  }
  // Remove trailing fenced code block (the closing ``` and anything after)
  sanitized = sanitized.replace(/\n```[\s\S]*$/m, "");
  // Remove '>' blockquote markers at line starts
  sanitized = sanitized.replace(/^>\s?/gm, "");
  return sanitized.trim();
}

module.exports = { sanitizeQuery };

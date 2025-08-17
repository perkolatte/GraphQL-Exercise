const axios = require("axios");
const { assertString } = require("./asserts");

// httpClient must match axios.post(url, body, opts)
const executeQuery = async (
  endpoint,
  { query, variables, operationName },
  httpClient = axios
) => {
  assertString(endpoint, "endpoint");
  try {
    const requestBody = JSON.stringify({
      query,
      variables:
        variables && Object.keys(variables).length ? variables : undefined,
      operationName,
    });

    const response = await httpClient.post(endpoint, requestBody, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
      // We’ll handle non-2xx ourselves so we can print body details:
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      // HTTP error: e.g. 400/500 with body
      const body =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data, null, 2);
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        httpStatus: response.status,
        httpBody: body,
        exitCode: 3,
      });
    }

    const data = response.data;
    if (data && data.errors && data.errors.length) {
      // GraphQL-level errors on a 200
      throw Object.assign(new Error("GraphQL errors"), {
        gqlErrors: data.errors,
        data,
        exitCode: 2,
      });
    }

    return data;
  } catch (err) {
    if (err.exitCode) throw err; // our custom error above

    if (err.response) {
      const body =
        typeof err.response.data === "string"
          ? err.response.data
          : JSON.stringify(err.response.data, null, 2);
      throw Object.assign(new Error(`HTTP ${err.response.status}`), {
        httpStatus: err.response.status,
        httpBody: body,
        exitCode: 3,
      });
    } else if (err.request) {
      throw Object.assign(new Error("Network error: no response from server"), {
        exitCode: 4,
      });
    }
    throw Object.assign(new Error(`Setup error: ${err.message}`), {
      exitCode: 1,
    });
  }
};

const printGraphQLErrors = (errors) => {
  errors.forEach((e, i) => {
    const loc = e.locations
      ? e.locations.map((l) => `${l.line}:${l.column}`).join(",")
      : "";
    const pathStr = e.path ? e.path.join(".") : "";
    console.error(`Error[${i}]: ${e.message}`);
    if (pathStr) console.error(`  path: ${pathStr}`);
    if (loc) console.error(`  at:   ${loc}`);
    if (e.extensions) console.error(`  ext:  ${JSON.stringify(e.extensions)}`);
  });
};

module.exports = { executeQuery, printGraphQLErrors };

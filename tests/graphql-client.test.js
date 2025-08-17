const nock = require("nock");
const { executeQuery } = require("../lib/graphql-client");

const ENDPOINT_HOST = "https://swapi-graphql.netlify.app";
const ENDPOINT_PATH = "/graphql";
const ENDPOINT = `${ENDPOINT_HOST}${ENDPOINT_PATH}`;

describe("lib/graphql-client executeQuery", () => {
  beforeAll(() => {
    // prevent real HTTP requests
    nock.disableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.enableNetConnect();
    nock.restore();
  });

  test("resolves with data on 200 and no errors", async () => {
    const resp = { data: { allFilms: { films: [{ title: "A New Hope" }] } } };
    nock(ENDPOINT_HOST).post(ENDPOINT_PATH).reply(200, resp);

    await expect(
      executeQuery(ENDPOINT, { query: "query {}" })
    ).resolves.toEqual(resp);
  });

  test("throws with gqlErrors when response contains errors", async () => {
    const gqlErr = [{ message: "Bad query" }];
    const body = { errors: gqlErr, data: null };
    nock(ENDPOINT_HOST).post(ENDPOINT_PATH).reply(200, body);

    await expect(
      executeQuery(ENDPOINT, { query: "query {}" })
    ).rejects.toMatchObject({ gqlErrors: expect.any(Array), exitCode: 2 });
  });

  test("throws with httpStatus/httpBody on non-2xx", async () => {
    const body = { message: "Bad Request" };
    nock(ENDPOINT_HOST).post(ENDPOINT_PATH).reply(400, body);

    await expect(
      executeQuery(ENDPOINT, { query: "query {}" })
    ).rejects.toMatchObject({
      httpStatus: 400,
      httpBody: expect.any(String),
      exitCode: 3,
    });
  });
});

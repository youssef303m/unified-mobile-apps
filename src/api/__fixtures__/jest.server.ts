// Jest setup for the api project: every request goes to the fixture servers through MSW.
import { setupServer } from "msw/node";

import { handlers, unhandledRequests } from "./msw";
import { resetScenario } from "./scenario";

import { resetTransport } from "../http";

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  resetScenario();
  resetTransport();
  const unexpected = unhandledRequests.splice(0);
  if (unexpected.length > 0)
    throw new Error(`Requests without a fixture:\n${unexpected.join("\n")}`);
});

afterAll(() => server.close());

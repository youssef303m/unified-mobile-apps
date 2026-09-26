// Routes a request to the fixture server that owns its host.
import { iboServer } from "./ibo";
import { m3uServer } from "./m3u";
import { servicesServer } from "./services";
import { stalkerServer } from "./stalker";
import {
  networkError,
  type FixtureRequest,
  type FixtureResponse,
  type FixtureServer,
} from "./types";
import { xtreamServer } from "./xtream";

/** Any `down.fixture.test` host is unreachable (connection refused). */
export const DOWN_HOST = "down.fixture.test";
const downServer: FixtureServer = (request) =>
  request.url.host === DOWN_HOST ? networkError() : undefined;

const servers: FixtureServer[] = [
  iboServer,
  xtreamServer,
  m3uServer,
  stalkerServer,
  servicesServer,
  downServer,
];

export function resolveFixture(request: FixtureRequest): FixtureResponse | undefined {
  for (const server of servers) {
    const response = server(request);
    if (response) return response;
  }
  return undefined;
}

export { resetScenario, scenario, setScenario } from "./scenario";

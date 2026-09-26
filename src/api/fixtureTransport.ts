// The "use fixtures" mode (04-build/testing.md §1): every request is answered by the fixture
// servers, in memory, so the whole app runs without any real server.
import { NetworkError } from "./errors";
import { resolveFixture } from "./__fixtures__/router";
import type { Transport } from "./http";
import { redactUrl } from "./log";

const LATENCY_MS = 150;

export const fixtureTransport: Transport = async (request) => {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(request.headers ?? {}))
    headers[key.toLowerCase()] = value;
  const fixture = resolveFixture({
    method: request.method,
    url: new URL(request.url),
    headers,
    body: request.body ?? "",
  });
  if (!fixture)
    throw new NetworkError(`No fixture for ${request.method} ${redactUrl(request.url)}`);
  if (fixture.status === 0) throw new NetworkError("Fixture network error");
  return {
    status: fixture.status,
    ok: fixture.status >= 200 && fixture.status < 300,
    headers: fixture.headers ?? {},
    text: fixture.body,
  };
};

// MSW handler that serves every request from the fixture servers. A request with no fixture is
// recorded and fails the test (jest.server.ts): tests never reach a real server.
import { http, HttpResponse } from "msw";

import { resolveFixture } from "./router";

export const unhandledRequests: string[] = [];

export const handlers = [
  http.all("*", async ({ request }) => {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const fixture = resolveFixture({
      method: request.method,
      url: new URL(request.url),
      headers,
      body: request.method === "GET" ? "" : await request.text(),
    });
    if (!fixture) {
      unhandledRequests.push(`${request.method} ${request.url}`);
      return HttpResponse.error();
    }
    if (fixture.status === 0) return HttpResponse.error();
    return new HttpResponse(fixture.body, { status: fixture.status, headers: fixture.headers });
  }),
];

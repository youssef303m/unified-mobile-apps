// Fixture servers are pure functions from a request to a response. The same functions serve
// MSW in tests (msw.ts) and the app's "use fixtures" mode (../fixtureTransport.ts).

export interface FixtureRequest {
  method: string;
  url: URL;
  headers: Record<string, string>;
  body: string;
}

export interface FixtureResponse {
  status: number;
  body: string;
  headers?: Record<string, string>;
}

export type FixtureServer = (request: FixtureRequest) => FixtureResponse | undefined;

export const json = (value: unknown, status = 200): FixtureResponse => ({
  status,
  body: JSON.stringify(value),
  headers: { "content-type": "application/json" },
});

export const text = (body: string, status = 200, contentType = "text/plain"): FixtureResponse => ({
  status,
  body,
  headers: { "content-type": contentType },
});

export const notFound = (): FixtureResponse => text("Not found", 404, "text/html");

/** Query parameters, from the URL or (for form POSTs) from the body. */
export function params(request: FixtureRequest): URLSearchParams {
  const query = new URLSearchParams(request.url.search);
  if (request.method !== "GET" && request.body && !request.body.startsWith("{")) {
    new URLSearchParams(request.body).forEach((value, key) => query.set(key, value));
  }
  return query;
}

/** status 0 = a transport failure (MSW: HttpResponse.error(); app: NetworkError). */
export const networkError = (): FixtureResponse => ({ status: 0, body: "" });

import {
  AuthError,
  CancelledError,
  NetworkError,
  ParseError,
  ServerError,
  TimeoutError,
} from "../errors";
import { expectOk, formEncode, fetchTransport, parseJson, send, setTransport } from "../http";
import { redactUrl } from "../log";
import { setScenario } from "../__fixtures__/scenario";

describe("formEncode (jQuery $.param)", () => {
  it("URL-encodes keys and values, writes spaces as +, null as empty", () => {
    expect(formEncode({ mac_address: "a1:b2", id: 7, empty: null, name: "a b&c=d" })).toBe(
      "mac_address=a1%3Ab2&id=7&empty=&name=a+b%26c%3Dd",
    );
  });

  it("percent-encodes + / = in an encrypted blob", () => {
    expect(formEncode({ data: "ab+c/d=" })).toBe("data=ab%2Bc%2Fd%3D");
  });
});

describe("send / expectOk", () => {
  it("returns error statuses as responses and maps them on expectOk", async () => {
    setTransport(async () => ({ status: 503, ok: false, headers: {}, text: "" }));
    const response = await send({ url: "http://x.fixture.test/" });
    expect(response.status).toBe(503);
    expect(() => expectOk(response)).toThrow(ServerError);
    expect(() => expectOk({ ...response, status: 401 })).toThrow(AuthError);
    expect(() => expectOk({ ...response, status: 404 })).toThrow(ServerError);
  });

  it("maps transport failures to NetworkError", async () => {
    setScenario({ agentsDown: true });
    await expect(
      send({ url: "https://babyeducate.com/api/playlist_info", method: "POST", body: "data=x" }),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it("times out with TimeoutError", async () => {
    const realFetch = global.fetch;
    global.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    try {
      await expect(
        fetchTransport({ url: "http://slow.fixture.test/", method: "GET", timeoutMs: 20 }),
      ).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      global.fetch = realFetch;
    }
  });

  it("reports a caller abort as CancelledError", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      send({ url: "http://x.fixture.test/", signal: controller.signal }),
    ).rejects.toBeInstanceOf(CancelledError);
  });

  it("parseJson throws ParseError on non-JSON", () => {
    expect(() => parseJson("<html>")).toThrow(ParseError);
  });
});

describe("redactUrl (never log credentials)", () => {
  it("hides Xtream credentials, tokens and MACs", () => {
    expect(redactUrl("http://h:8080/player_api.php?username=john&password=s3cret&action=x")).toBe(
      "http://h:8080/player_api.php?username=***&password=***&action=x",
    );
    expect(redactUrl("http://h/live/john/s3cret/1.ts")).toBe("http://h/live/***/***/1.ts");
    expect(redactUrl("http://p/load.php?mac=00%3A1A&token=abc")).toBe(
      "http://p/load.php?mac=***&token=***",
    );
    expect(redactUrl("cookie mac=00:1A:79:12:34:56")).toContain("**:**:**:**:**:**");
  });
});

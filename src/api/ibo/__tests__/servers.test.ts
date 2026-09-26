import { config } from "@/config";

import { FIXTURE_PANEL_DOMAINS } from "../../__fixtures__/hosts";
import { setScenario } from "../../__fixtures__/scenario";
import { memoryStore } from "../../store";
import {
  buildFailoverBases,
  buildPanelUrls,
  DOMAIN_LISTS_KEY,
  fetchDomainList,
  panelUrlFromManualInput,
} from "../servers";

const MAC = "3A:E3:1A:46:33:A5";

describe("agent playlist_info (ibo-api-reference.md #1)", () => {
  it("gets the panel domains from an agent and caches them as domain_lists", async () => {
    const store = memoryStore();
    const { list, source } = await fetchDomainList(MAC, store);
    expect(source).toBe("agent");
    expect(list.domains).toEqual(FIXTURE_PANEL_DOMAINS);
    expect(JSON.parse(store.get(DOMAIN_LISTS_KEY) ?? "{}")).toEqual(list);
  });

  it("Q-domain-cache: with every agent down, uses the cached list first", async () => {
    setScenario({ agentsDown: true });
    const store = memoryStore({
      [DOMAIN_LISTS_KEY]: JSON.stringify({ domains: ["cached.fixture.test"] }),
    });
    const { list, source } = await fetchDomainList(MAC, store);
    expect(source).toBe("cache");
    expect(list.domains).toEqual(["cached.fixture.test"]);
  });

  it("Q-panel-fallback: then config fallbackDomains (never the static panelUrls)", async () => {
    setScenario({ agentsDown: true });
    const { list, source } = await fetchDomainList(MAC, memoryStore());
    expect(source).toBe("fallback");
    expect(list.domains).toEqual(config.iboBackend.fallbackDomains.domains);
  });
});

describe("panel URL lists (overview.md §4.2-4.4)", () => {
  it("strips schemes and /api, keeps the agent order, puts a manual URL first", () => {
    expect(buildPanelUrls(["a.com", "https://b.com/api", "http://c.com"], "m.com")).toEqual([
      "https://m.com/api",
      "https://a.com/api",
      "https://b.com/api",
      "https://c.com/api",
    ]);
  });

  it("failover bases: manual URL first, no duplicates", () => {
    expect(buildFailoverBases(["https://a.com/api", "https://m.com/api"], "m.com/api/")).toEqual([
      "https://m.com/api",
      "https://a.com/api",
    ]);
  });

  it("manual input keeps an explicit scheme", () => {
    expect(panelUrlFromManualInput(" example.com/api/ ")).toBe("https://example.com/api");
    expect(panelUrlFromManualInput("http://example.com")).toBe("http://example.com/api");
  });
});

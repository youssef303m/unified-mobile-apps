import { KEYS, STORAGE_PREFIX, getString, prefixed, remove, setString } from "../kv";

describe("kv", () => {
  it("uses the TV app's storage prefix", () => {
    expect(STORAGE_PREFIX).toBe("gz3rYzUIC7_");
    expect(prefixed(KEYS.language)).toBe("gz3rYzUIC7_language");
  });

  it("stores, reads and removes strings", () => {
    setString(KEYS.language, "tr");
    expect(getString(KEYS.language)).toBe("tr");
    remove(KEYS.language);
    expect(getString(KEYS.language)).toBeUndefined();
  });
});

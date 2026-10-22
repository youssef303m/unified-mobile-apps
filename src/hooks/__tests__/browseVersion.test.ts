import { getBrowseVersion, refreshBrowse, subscribeBrowseVersion } from "../queryClient";

describe("browse version", () => {
  it("notifies subscribers on every refresh, so render-time reads see new progress", () => {
    const listener = jest.fn();
    const before = getBrowseVersion();
    const off = subscribeBrowseVersion(listener);
    refreshBrowse("p1");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getBrowseVersion()).toBe(before + 1);
    off();
    refreshBrowse("p1");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

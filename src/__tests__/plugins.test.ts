// The prebuild patches (D-066, D-078) against the installed library sources: they apply once,
// are idempotent, and fail loudly when the code they expect is gone.
import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "..", "..");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ts = require("../../plugins/withTsExtractorFlags") as { patchSource: (s: string) => string };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dl = require("../../plugins/withInAppDownloader") as { patchSource: (s: string) => string };

const read = (path: string) => readFileSync(join(root, "node_modules", path), "utf8");

describe("prebuild patches", () => {
  it("D-066: react-native-video's progressive factories get the TS extractor flags", () => {
    const source = read(
      "react-native-video/android/src/main/java/com/brentvatne/exoplayer/ReactExoplayerView.java",
    );
    const patched = ts.patchSource(source);
    expect(patched.match(/setTsExtractorFlags\(/g)).toHaveLength(2);
    expect(ts.patchSource(patched)).toBe(patched);
    expect(() => ts.patchSource("class Nothing {}")).toThrow(/withTsExtractorFlags/);
  });

  it("D-078: the background downloader never falls back to DownloadManager for a new download", () => {
    const source = read(
      "@kesha-antonov/react-native-background-downloader/android/src/main/java/com/eko/RNBackgroundDownloaderModuleImpl.kt",
    );
    const patched = dl.patchSource(source);
    expect(patched).toContain("DownloadManager disabled by the app");
    expect(patched).not.toContain("if (Build.VERSION.SDK_INT >= 36) {");
    expect(dl.patchSource(patched)).toBe(patched);
    expect(() => dl.patchSource("class Nothing")).toThrow(/withInAppDownloader/);
  });
});

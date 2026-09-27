// What the native player plays in fixture mode: it cannot reach the `.fixture.test` hosts, so
// fixture stream URLs become public test streams, by kind (04-build/testing.md §1).
import { FIXTURE_BROKEN_CHANNEL, FIXTURE_TS_CHANNEL, TEST_STREAMS } from "./hosts";

const FIXTURE_TLD = ".fixture.test";

function lastId(path: string): string {
  const segment = path.split("/").pop() ?? "";
  return segment.split(".")[0] ?? "";
}

/** The test stream for a fixture URL; undefined for any other URL. */
export function fixtureStreamFor(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (!parsed.hostname.endsWith(FIXTURE_TLD)) return undefined;
  const path = parsed.pathname.toLowerCase();
  if (path.includes("timeshift")) return TEST_STREAMS.hls;
  if (path.includes("/live/")) {
    const id = parsed.searchParams.get("stream") ?? lastId(path);
    if (id === FIXTURE_BROKEN_CHANNEL) return TEST_STREAMS.broken;
    if (id === FIXTURE_TS_CHANNEL) return TEST_STREAMS.ts;
    return TEST_STREAMS.live;
  }
  if (path.endsWith(".m3u8")) return TEST_STREAMS.hls;
  if (path.includes("/series/")) return TEST_STREAMS.hls;
  if (path.endsWith(".mkv")) return TEST_STREAMS.mkv;
  return TEST_STREAMS.mp4;
}

/**
 * Downloads (N-03) need a file, never HLS: fixture movies and episodes become the MP4 or MKV test
 * file by their container. Undefined for any other URL.
 */
export function fixtureDownloadFor(url: string): string | undefined {
  if (!fixtureStreamFor(url)) return undefined;
  return url.toLowerCase().split("?")[0]?.endsWith(".mkv") ? TEST_STREAMS.mkv : TEST_STREAMS.mp4;
}

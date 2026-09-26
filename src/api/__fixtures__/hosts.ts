// Fake hosts for the fixture servers. `.test` is a reserved TLD, so nothing here can ever
// resolve to a real server.
export const FIXTURE_PANEL_DOMAINS = ["panel1.fixture.test", "panel2.fixture.test"];
export const XTREAM_HOST = "xtream.fixture.test:8080";
export const XTREAM_BIG_HOST = "xtream-big.fixture.test";
export const M3U_HOST = "m3u.fixture.test";
export const STALKER_HOST = "stalker.fixture.test";

export const XTREAM_URL = `http://${XTREAM_HOST}`;
export const XTREAM_BIG_URL = `http://${XTREAM_BIG_HOST}`;
export const M3U_URL = `http://${M3U_HOST}/playlist.m3u`;
export const STALKER_PORTAL_URL = `http://${STALKER_HOST}/c/`;

/** Fake credentials (never real ones, AGENTS.md rule 7). */
export const XTREAM_USER = "fixture_user";
export const XTREAM_PASS = "fixture_pass";
export const STALKER_MAC = "00:1A:79:12:34:56";

// Public test streams, so the player can be exercised end to end (04-build/testing.md §1).
export const TEST_STREAMS = {
  hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  mp4: "https://storage.googleapis.com/exoplayer-test-media-1/mp4/android-screens-10s.mp4",
};

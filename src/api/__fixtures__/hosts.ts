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
  /** HLS VOD, about 10 minutes (Big Buck Bunny). */
  hls: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  /** MP4, about 10 minutes. */
  mp4: "https://storage.googleapis.com/exoplayer-test-media-0/BigBuckBunny_320x180.mp4",
  /** MKV (H.264 + AAC). */
  mkv: "https://storage.googleapis.com/exoplayer-test-media-1/mkv/android-screens-lavf-56.36.100-aac-avc-main-1280x720.mkv",
  /** A real live HLS stream. */
  live: "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
  /** Raw MPEG-TS over HTTP (a 10 s segment, played as progressive TS). */
  ts: "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/gear1/fileSequence0.ts",
  /** Answers 403: the error states. */
  broken: "https://storage.googleapis.com/exoplayer-test-media-1/mp4/does-not-exist.mp4",
};

/** Fixture live channels that play the MPEG-TS file and the broken URL. */
export const FIXTURE_TS_CHANNEL = "10001";
export const FIXTURE_BROKEN_CHANNEL = "10002";

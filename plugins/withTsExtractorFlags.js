// Media3 TS extractor flags for IPTV streams (01-product/player.md §2.6 point 4): raw MPEG-TS over
// HTTP is the default for live channels, and FLAG_ALLOW_NON_IDR_KEYFRAMES | FLAG_DETECT_ACCESS_UNITS
// lets playback start quickly on them. react-native-video 6.19.3 builds its progressive sources with
// the default extractors and offers no option, so this plugin patches its Java source at prebuild
// (docs/decisions.md D-066). It fails the build loudly if the code it expects has changed.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const FACTORY =
  "new androidx.media3.extractor.DefaultExtractorsFactory().setTsExtractorFlags(" +
  "androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES | " +
  "androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS)";

const PATTERN =
  /new ProgressiveMediaSource\.Factory\(\s*(mediaDataSourceFactory|RNVSimpleCache\.INSTANCE\.getCacheFactory\(buildHttpDataSourceFactory\(true\)\))\s*\)/g;

function patchSource(source) {
  if (source.includes("setTsExtractorFlags(")) return source;
  const matches = source.match(PATTERN) ?? [];
  if (matches.length !== 2) {
    throw new Error(
      `withTsExtractorFlags: expected 2 progressive source factories in ReactExoplayerView.java, found ${matches.length}. ` +
        "react-native-video changed; update plugins/withTsExtractorFlags.js.",
    );
  }
  return source.replace(
    PATTERN,
    (_, dataSource) => `new ProgressiveMediaSource.Factory(${dataSource}, ${FACTORY})`,
  );
}

function withTsExtractorFlags(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const pkg = require.resolve("react-native-video/package.json", {
        paths: [cfg.modRequest.projectRoot],
      });
      const file = path.join(
        path.dirname(pkg),
        "android/src/main/java/com/brentvatne/exoplayer/ReactExoplayerView.java",
      );
      const source = fs.readFileSync(file, "utf8");
      const patched = patchSource(source);
      if (patched !== source) fs.writeFileSync(file, patched);
      return cfg;
    },
  ]);
}

module.exports = withTsExtractorFlags;
module.exports.patchSource = patchSource;

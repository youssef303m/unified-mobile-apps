// Downloads never go through Android's system DownloadManager (01-product/player.md §8.3): it
// keeps every download URL in a system database, and Xtream URLs hold the account's username and
// password. @kesha-antonov/react-native-background-downloader 4.6.3 already uses its in-app
// downloader on Android 14+ (a user-initiated job) and 16+; below 14 it hands new downloads to
// DownloadManager. This plugin patches its Kotlin source at prebuild so every Android version
// takes the in-app path (a foreground service below 14; docs/decisions.md D-078). It fails the
// build loudly if the code it expects has changed.
const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const FILE = "android/src/main/java/com/eko/RNBackgroundDownloaderModuleImpl.kt";
const BEFORE = `    if (Build.VERSION.SDK_INT >= 36) {
      logD(NAME, "Android 16+ detected: Using ResumableDownloader to avoid DownloadManager path restrictions")
      startWithResumableDownloader()
      return
    }`;
const AFTER = `    // Patched by plugins/withInAppDownloader.js: the in-app downloader on every Android version.
    if (true) {
      logD(NAME, "Using ResumableDownloader (DownloadManager disabled by the app)")
      startWithResumableDownloader()
      return
    }`;

function patchSource(source) {
  if (source.includes("DownloadManager disabled by the app")) return source;
  const count = source.split(BEFORE).length - 1;
  if (count !== 1) {
    throw new Error(
      `withInAppDownloader: expected the Android 16+ branch once in ${FILE}, found ${count}. ` +
        "The background downloader changed; update plugins/withInAppDownloader.js.",
    );
  }
  return source.replace(BEFORE, AFTER);
}

function withInAppDownloader(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const pkg = require.resolve(
        "@kesha-antonov/react-native-background-downloader/package.json",
        {
          paths: [cfg.modRequest.projectRoot],
        },
      );
      const file = path.join(path.dirname(pkg), FILE);
      const source = fs.readFileSync(file, "utf8");
      const patched = patchSource(source);
      if (patched !== source) fs.writeFileSync(file, patched);
      return cfg;
    },
  ]);
}

module.exports = withInAppDownloader;
module.exports.patchSource = patchSource;

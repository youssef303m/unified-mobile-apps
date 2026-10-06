// Local release builds (docs/decisions.md D-087): when credentials.json (downloaded with
// `npx eas-cli credentials -p android` → credentials.json → Download) is in the project root, the
// release build type is signed with the EAS keystore, so a locally built APK installs over the
// cloud-built app. Without the file nothing changes. EAS cloud builds never see the file (it is
// git-ignored, so not uploaded) and sign with their own credentials. The passwords are read at
// build time and never written into the generated project.
const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// withLocalReleaseSigning";

const SIGNING = `
    ${MARKER}
    def localCredentials = rootProject.file("../credentials.json")
    if (localCredentials.exists()) {
        def keystore = new groovy.json.JsonSlurper().parse(localCredentials).android.keystore
        signingConfigs {
            localRelease {
                storeFile rootProject.file("../" + keystore.keystorePath)
                storePassword keystore.keystorePassword
                keyAlias keystore.keyAlias
                keyPassword keystore.keyPassword
            }
        }
        buildTypes.release.signingConfig signingConfigs.localRelease
    }
`;

function patchBuildGradle(source) {
  if (source.includes(MARKER)) return source;
  // After the android { … } block's buildTypes, so the release build type exists.
  const anchor = "    packagingOptions {";
  if (!source.includes(anchor)) {
    throw new Error(
      "withLocalReleaseSigning: packagingOptions not found in app/build.gradle; " +
        "update plugins/withLocalReleaseSigning.js.",
    );
  }
  return source.replace(anchor, `${SIGNING}\n${anchor}`);
}

function withLocalReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withLocalReleaseSigning;
module.exports.patchBuildGradle = patchBuildGradle;
